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


@app.route("/api/partner/offers", methods=["GET"])
def partner_list_offers():
    partner = _require_partner()
    conn = db.get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM offers WHERE partner_id = ? ORDER BY created_at DESC",
            (partner["id"],),
        ).fetchall()
        return jsonify({"offers": [dict(r) for r in rows]})
    finally:
        conn.close()


@app.route("/api/partner/offers", methods=["POST"])
def partner_create_offer():
    partner = _require_partner()
    body = request.get_json(force=True)
    title = (body.get("title") or "").strip()
    if not title:
        abort(400, description="title is required")
    offer_type = body.get("type", "priced")
    if offer_type not in ("entitlement", "priced"):
        abort(400, description="type must be 'entitlement' or 'priced'")
    price_chf = float(body.get("price_chf") or 0)
    orig_chf = body.get("original_price_chf")
    orig_rappen = db.chf_to_rappen(float(orig_chf)) if orig_chf else None
    description = (body.get("description") or "").strip() or None
    image_hint = (body.get("image_hint") or "").strip() or None

    conn = db.get_connection()
    try:
        offer_id = db.new_id()
        conn.execute(
            """INSERT INTO offers (id, partner_id, title, description, type,
                                   guest_price_rappen, partner_payout_rappen,
                                   original_price_rappen, image_hint,
                                   active, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)""",
            (offer_id, partner["id"], title, description, offer_type,
             db.chf_to_rappen(price_chf), db.chf_to_rappen(price_chf),
             orig_rappen, image_hint, db.utcnow_iso()),
        )
        return jsonify({"ok": True, "offer_id": offer_id}), 201
    finally:
        conn.close()


@app.route("/api/partner/offers/<offer_id>", methods=["DELETE"])
def partner_deactivate_offer(offer_id):
    partner = _require_partner()
    conn = db.get_connection()
    try:
        result = conn.execute(
            "UPDATE offers SET active = 0 WHERE id = ? AND partner_id = ?",
            (offer_id, partner["id"]),
        )
        if result.rowcount == 0:
            abort(404, description="offer not found or not yours")
        return jsonify({"ok": True})
    finally:
        conn.close()


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
    PAGE_STYLE = """
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #F2EFE8;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }
      .navbar {
        position: fixed; top: 0; left: 0; right: 0; height: 56px;
        background: rgba(14,28,46,.96);
        display: flex; align-items: center; padding: 0 1.5rem;
        border-bottom: 1px solid rgba(255,255,255,.07);
      }
      .nav-logo { font-size: .88rem; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; color: #fff; }
      .nav-logo em { font-style: normal; color: #C4950E; }
      .nav-badge { margin-left: .75rem; padding: .15rem .55rem; background: rgba(196,149,14,.18); color: #C4950E; border-radius: 4px; font-size: .6rem; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; }
      .card {
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 8px 40px rgba(14,28,46,.14);
        width: 100%;
        max-width: 420px;
        overflow: hidden;
        margin-top: 56px;
        animation: rise .35s cubic-bezier(.4,0,.2,1) both;
      }
      @keyframes rise { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
      .header {
        background: linear-gradient(135deg, #0E1C2E 0%, #1B3259 100%);
        padding: 2rem 2rem 1.75rem;
        text-align: center;
        color: #fff;
      }
      .logo-line { font-size: .75rem; font-weight: 900; letter-spacing: .18em; text-transform: uppercase; color: rgba(255,255,255,.45); margin-bottom: 1rem; }
      .header-title { font-size: 1.4rem; font-weight: 900; letter-spacing: -.02em; }
      .header-sub { font-size: .78rem; color: rgba(255,255,255,.5); margin-top: .3rem; letter-spacing: .03em; }
      .body { padding: 1.75rem; }
      .amount-box {
        background: #F2EFE8;
        border-radius: 12px;
        padding: 1.25rem;
        text-align: center;
        margin-bottom: 1.5rem;
        border: 1px solid #DDD9D2;
      }
      .amount-label { font-size: .65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .09em; color: #64748B; margin-bottom: .4rem; }
      .amount-value { font-size: 2.4rem; font-weight: 900; color: #0E1C2E; letter-spacing: -.03em; line-height: 1; }
      .amount-currency { font-size: 1rem; font-weight: 700; color: #64748B; margin-right: .3rem; vertical-align: super; font-size: 1.1rem; }
      .field { margin-bottom: 1rem; }
      .field label { display: block; font-size: .68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #64748B; margin-bottom: .4rem; }
      .field input {
        width: 100%;
        padding: .72rem 1rem;
        border: 1.5px solid #DDD9D2;
        border-radius: 10px;
        font-size: .88rem;
        color: #1C1C2E;
        background: #F2EFE8;
        transition: border-color .15s, background .15s;
        font-family: inherit;
      }
      .field input:focus { outline: none; border-color: #1B3259; background: #fff; }
      .ref-hint { font-size: .68rem; color: #94a3b8; margin-top: .3rem; }
      .btn-pay {
        width: 100%;
        padding: .9rem;
        background: #1B3259;
        color: #fff;
        border: none;
        border-radius: 10px;
        font-size: .95rem;
        font-weight: 800;
        cursor: pointer;
        margin-top: .5rem;
        transition: background .15s, transform .1s;
        font-family: inherit;
        letter-spacing: .01em;
      }
      .btn-pay:hover { background: #2D5396; }
      .btn-pay:active { transform: scale(.98); }
      .secure-badge {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: .35rem;
        font-size: .68rem;
        color: #94a3b8;
        margin-top: 1.1rem;
      }
      .footer-note { text-align: center; font-size: .68rem; color: #94a3b8; margin-top: 1rem; font-family: ui-monospace, monospace; }
    </style>
    """

    if request.method == "GET":
        conn = db.get_connection()
        try:
            row = conn.execute("SELECT amount_rappen FROM topups WHERE id = ?", (topup_id,)).fetchone()
            amount_str = f"{row['amount_rappen'] / 100:.2f}" if row else "–.–"
        finally:
            conn.close()
        return f"""<!DOCTYPE html><html><head>{PAGE_STYLE}<title>Top Up · Jungfrau Wallet</title></head><body>
        <nav class="navbar">
          <div class="nav-logo">Jungfrau<em>.</em>Wallet</div>
          <span class="nav-badge">Secure Pay</span>
        </nav>
        <div class="card">
          <div class="header">
            <div class="logo-line">Jungfrau Region · Payment</div>
            <div class="header-title">Wallet Top-Up</div>
            <div class="header-sub">Simulated payment · demo environment</div>
          </div>
          <div class="body">
            <div class="amount-box">
              <div class="amount-label">Amount to credit</div>
              <div class="amount-value"><span class="amount-currency">CHF</span>{amount_str}</div>
            </div>
            <form method="post">
              <div class="field">
                <label>Transaction reference</label>
                <input name="ref" value="JFR-PAY-{topup_id[:8].upper()}" required>
                <div class="ref-hint">Auto-generated · editable for demo</div>
              </div>
              <div class="field">
                <label>Provider fee (CHF)</label>
                <input name="fee" value="0.80" type="number" step="0.01" min="0">
              </div>
              <button class="btn-pay" type="submit">Confirm &amp; Credit Wallet</button>
            </form>
            <div class="secure-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              256-bit SSL · Demo environment
            </div>
          </div>
        </div>
        </body></html>"""

    ref = request.form.get("ref", f"JFR-PAY-{topup_id[:8].upper()}")
    fee = float(request.form.get("fee", 0))
    services.complete_topup(topup_id=topup_id, payment_provider_ref=ref, fee_chf=fee)
    return f"""<!DOCTYPE html><html><head>{PAGE_STYLE}<title>Payment confirmed · Jungfrau Wallet</title></head><body>
    <nav class="navbar">
      <div class="nav-logo">Jungfrau<em>.</em>Wallet</div>
      <span class="nav-badge">Secure Pay</span>
    </nav>
    <div class="card">
      <div class="header" style="background:linear-gradient(135deg,#1f4d35 0%,#3D7252 100%);padding:2.5rem 2rem;">
        <div style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;margin:0 auto .85rem;">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div class="header-title">Payment confirmed</div>
        <div class="header-sub" style="margin-top:.35rem;">Your wallet has been credited</div>
      </div>
      <div class="body" style="text-align:center;">
        <p style="color:#64748B;font-size:.875rem;line-height:1.7;margin-bottom:1.5rem;">
          The top-up was processed successfully.<br>Close this window and return to your wallet.
        </p>
        <button onclick="if(window.opener){{window.opener.postMessage('topup_complete','*');}} window.close();" style="display:block;width:100%;padding:.9rem;background:#1B3259;color:#fff;border:none;border-radius:10px;font-weight:800;text-decoration:none;font-size:.95rem;cursor:pointer;font-family:inherit;">
          Back to Wallet
        </button>
        <div class="footer-note" style="margin-top:1rem;">Ref: {ref}</div>
      </div>
    </div>
    </body></html>"""


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
