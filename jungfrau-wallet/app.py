"""
Flask HTTP layer. Wires service functions to endpoints.

Endpoint groups:
  - /api/checkin                  (admin/booking-system)
  - /api/wallet/*                 (guest)
  - /api/qr/generate              (guest)
  - /api/redeem                   (partner, requires X-API-Key)
  - /api/partner/*                (partner, requires X-API-Key)
  - /api/admin/settlement/*       (admin, requires X-Admin-Key)
  - /api/webhooks/payment         (mock payment provider callback)

Demo UIs served as static HTML:
  /                  -> guest demo
  /partner           -> partner scanner
  /admin             -> settlement console
"""
import os
import jwt
from flask import Flask, request, jsonify, send_from_directory, abort

import db
import auth
import services
import settlement


ADMIN_KEY = os.environ.get("WALLET_ADMIN_KEY", "admin-dev-key")

app = Flask(__name__, static_folder="static", static_url_path="")


# ---- Error handler ----------------------------------------------------------

@app.errorhandler(services.WalletError)
def handle_wallet_error(e):
    return jsonify({"error": str(e), "type": type(e).__name__}), e.status_code


@app.errorhandler(404)
def handle_404(e):
    return jsonify({"error": "not found"}), 404


# ---- Tiny helpers -----------------------------------------------------------

def _require_idempotency_key():
    key = request.headers.get("Idempotency-Key")
    if not key:
        abort(400, description="Idempotency-Key header is required")
    return key


def _require_partner():
    api_key = request.headers.get("X-API-Key", "")
    p = auth.authenticate_partner(api_key)
    if not p:
        abort(401, description="invalid or missing X-API-Key")
    return p


def _require_admin():
    if request.headers.get("X-Admin-Key") != ADMIN_KEY:
        abort(401, description="invalid or missing X-Admin-Key")


# ---- Static demo pages ------------------------------------------------------

@app.route("/")
def root():
    return send_from_directory("static", "guest.html")


@app.route("/partner")
def partner_page():
    return send_from_directory("static", "partner.html")


@app.route("/admin")
def admin_page():
    return send_from_directory("static", "admin.html")


# ---- Guest endpoints --------------------------------------------------------

@app.route("/api/checkin", methods=["POST"])
def checkin():
    """
    Idempotent check-in. Looks up guest by guest_card_id; if missing creates
    one. Then issues all entitlement-type offers.
    """
    body = request.get_json(force=True)
    required = ("guest_card_id", "check_in", "check_out")
    for f in required:
        if f not in body:
            abort(400, description=f"missing field: {f}")

    conn = db.get_connection()
    try:
        existing = conn.execute(
            "SELECT * FROM guests WHERE guest_card_id = ?", (body["guest_card_id"],)
        ).fetchone()
        if existing:
            guest = dict(existing)
        else:
            guest_id = db.new_id()
            conn.execute(
                """INSERT INTO guests (id, guest_card_id, email, booking_ref,
                                       check_in, check_out, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (guest_id, body["guest_card_id"], body.get("email"),
                 body.get("booking_ref"), body["check_in"], body["check_out"],
                 db.utcnow_iso()),
            )
            guest = dict(conn.execute(
                "SELECT * FROM guests WHERE id = ?", (guest_id,)
            ).fetchone())

        issued = services.issue_entitlements_for_guest(guest["id"], conn=conn)
        return jsonify({"guest": guest, "issued_entitlements": issued})
    finally:
        conn.close()


@app.route("/api/wallet/<guest_id>", methods=["GET"])
def get_wallet(guest_id):
    return jsonify(services.get_wallet(guest_id))


@app.route("/api/wallet/<guest_id>/topup", methods=["POST"])
def initiate_topup(guest_id):
    body = request.get_json(force=True)
    key = _require_idempotency_key()
    topup = services.initiate_topup(
        guest_id=guest_id,
        amount_chf=body["amount_chf"],
        payment_method=body["payment_method"],
        idempotency_key=key,
    )
    return jsonify({"topup": topup, "checkout_url": f"/mock-pay/{topup['id']}"})


@app.route("/api/qr/generate", methods=["POST"])
def generate_qr():
    """
    Mint a 60s JWT for either a priced offer (wallet_spend) or an entitlement.

    Body:
      { guest_id, offer_id }              for priced
      { guest_id, entitlement_id }        for entitlement
    """
    body = request.get_json(force=True)
    guest_id = body["guest_id"]

    conn = db.get_connection()
    try:
        if "entitlement_id" in body:
            ent = conn.execute(
                """SELECT e.*, o.partner_payout_rappen, o.id AS offer_id
                   FROM entitlements e JOIN offers o ON o.id = e.offer_id
                   WHERE e.id = ? AND e.guest_id = ? AND e.status = 'issued'""",
                (body["entitlement_id"], guest_id),
            ).fetchone()
            if not ent:
                abort(404, description="entitlement not found, not yours, or not redeemable")
            token, jti = auth.mint_qr_token(
                guest_id=guest_id,
                offer_id=ent["offer_id"],
                type_="entitlement",
                amount_rappen=ent["partner_payout_rappen"],
                entitlement_id=ent["id"],
            )
        else:
            offer = conn.execute(
                "SELECT * FROM offers WHERE id = ? AND active = 1 AND type = 'priced'",
                (body["offer_id"],),
            ).fetchone()
            if not offer:
                abort(404, description="priced offer not found")

            wallet = conn.execute(
                "SELECT balance_rappen FROM guest_wallets WHERE guest_id = ?", (guest_id,)
            ).fetchone()
            balance = wallet["balance_rappen"] if wallet else 0
            if balance < offer["partner_payout_rappen"]:
                raise services.InsufficientFunds("insufficient wallet balance")

            token, jti = auth.mint_qr_token(
                guest_id=guest_id,
                offer_id=offer["id"],
                type_="wallet_spend",
                amount_rappen=offer["partner_payout_rappen"],
            )

        return jsonify({"qr_token": token, "jti": jti, "expires_in_seconds": auth.QR_TTL_SECONDS})
    finally:
        conn.close()


# ---- Partner endpoints ------------------------------------------------------

@app.route("/api/redeem", methods=["POST"])
def redeem():
    """
    The critical endpoint. Partner sends the scanned QR string + idempotency key.
    """
    partner = _require_partner()
    body = request.get_json(force=True)
    key = _require_idempotency_key()

    qr = body.get("qr_token")
    if not qr:
        abort(400, description="missing qr_token")

    try:
        payload = auth.verify_qr_token(qr)
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "QR code expired - ask guest to refresh"}), 410
    except jwt.InvalidTokenError as e:
        return jsonify({"error": f"invalid QR: {e}"}), 400

    redemption = services.execute_redemption(
        qr_payload=payload,
        partner_id=partner["id"],
        idempotency_key=key,
    )

    # Look up offer title for friendly partner UI message
    conn = db.get_connection()
    try:
        offer = conn.execute(
            "SELECT title FROM offers WHERE id = ?", (redemption["offer_id"],)
        ).fetchone()
        offer_title = offer["title"] if offer else "Offer"
    finally:
        conn.close()

    return jsonify({
        "ok": True,
        "redemption_id": redemption["id"],
        "offer_title": offer_title,
        "amount_chf": db.rappen_to_chf(redemption["amount_rappen"]),
        "type": redemption["type"],
        "message": f"Approved: {offer_title} (CHF {db.rappen_to_chf(redemption['amount_rappen']):.2f} to partner)",
    })


@app.route("/api/partner/refund", methods=["POST"])
def partner_refund():
    partner = _require_partner()
    body = request.get_json(force=True)
    key = _require_idempotency_key()
    out = services.refund_redemption(
        redemption_id=body["redemption_id"],
        partner_id=partner["id"],
        reason=body.get("reason", ""),
        idempotency_key=key,
    )
    return jsonify(out)


@app.route("/api/partner/dashboard", methods=["GET"])
def partner_dashboard():
    partner = _require_partner()
    return jsonify(settlement.get_partner_dashboard(partner["id"]))


# ---- Mock payment provider --------------------------------------------------

@app.route("/api/webhooks/payment", methods=["POST"])
def payment_webhook():
    """
    Mock payment provider callback. In production this would verify the provider's
    signature; for the demo we just accept the payload.
    """
    body = request.get_json(force=True)
    out = services.complete_topup(
        topup_id=body["topup_id"],
        payment_provider_ref=body["payment_provider_ref"],
        fee_chf=body.get("fee_chf", 0),
    )
    return jsonify(out)


@app.route("/mock-pay/<topup_id>", methods=["GET", "POST"])
def mock_pay(topup_id):
    """
    Mock 'TWINT' page. GET shows a form; POST simulates the provider firing
    its webhook with success.
    """
    if request.method == "GET":
        return f"""
        <html><body style="font-family:system-ui;padding:2rem;max-width:480px">
          <h2>Mock TWINT Payment</h2>
          <p>Topup id: <code>{topup_id}</code></p>
          <form method="post">
            <label>Provider reference: <input name="ref" value="TWINT-{topup_id[:8]}" required></label><br><br>
            <label>Provider fee (CHF): <input name="fee" value="0.80" type="number" step="0.01"></label><br><br>
            <button type="submit">Confirm Payment</button>
          </form>
        </body></html>
        """

    ref = request.form.get("ref", f"TWINT-{topup_id[:8]}")
    fee = float(request.form.get("fee", 0))
    services.complete_topup(topup_id=topup_id, payment_provider_ref=ref, fee_chf=fee)
    return f"""
    <html><body style="font-family:system-ui;padding:2rem">
      <h2>✓ Payment confirmed</h2>
      <p>Wallet credited. <a href="/">Back to wallet</a></p>
    </body></html>
    """


# ---- Admin / settlement -----------------------------------------------------

@app.route("/api/admin/settlement/run", methods=["POST"])
def admin_run_settlement():
    _require_admin()
    body = request.get_json(force=True) or {}
    period_start = body.get("period_start", "1900-01-01T00:00:00")
    period_end   = body.get("period_end",   "9999-12-31T23:59:59")
    return jsonify(settlement.run_settlement(period_start, period_end))


@app.route("/api/admin/settlement/confirm", methods=["POST"])
def admin_confirm_settlement():
    _require_admin()
    body = request.get_json(force=True)
    return jsonify(settlement.confirm_settlement(
        batch_id=body["batch_id"],
        bank_transaction_ref=body["bank_transaction_ref"],
    ))


@app.route("/api/admin/settlement/batches", methods=["GET"])
def admin_list_batches():
    _require_admin()
    conn = db.get_connection()
    try:
        rows = conn.execute(
            """SELECT sb.*, p.name AS partner_name
               FROM settlement_batches sb JOIN partners p ON p.id = sb.partner_id
               ORDER BY sb.created_at DESC LIMIT 100"""
        ).fetchall()
        return jsonify({"batches": [dict(r) for r in rows]})
    finally:
        conn.close()


@app.route("/api/admin/settlement/pain001/<batch_id>", methods=["GET"])
def admin_get_pain001(batch_id):
    """Download the pain.001 file for a batch (for the live demo's wow moment)."""
    _require_admin()
    conn = db.get_connection()
    try:
        row = conn.execute(
            "SELECT pain001_file_path FROM settlement_batches WHERE id = ?", (batch_id,)
        ).fetchone()
        if not row or not row["pain001_file_path"]:
            abort(404)
        path = row["pain001_file_path"]
        with open(path, "rb") as f:
            content = f.read()
        from flask import Response
        return Response(content, mimetype="application/xml",
                        headers={"Content-Disposition": f"inline; filename={os.path.basename(path)}"})
    finally:
        conn.close()


@app.route("/api/admin/seed", methods=["POST"])
def admin_reseed():
    """Convenience for the demo: wipe and reseed the database."""
    _require_admin()
    import seed
    db.reset_db()
    info = seed.seed()
    return jsonify(info)


# ---- Bootstrap --------------------------------------------------------------

@app.route("/api/health")
def health():
    return jsonify({"ok": True, "now": db.utcnow_iso()})


if __name__ == "__main__":
    db.init_db()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
