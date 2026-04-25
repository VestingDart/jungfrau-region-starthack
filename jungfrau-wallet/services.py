"""
Business logic for the wallet system.

Three modules of logic, kept in one file for hackathon simplicity:

  - wallet_service:  top-up flow and credit additions to wallet balance
  - redemption_service:  the critical /redeem transaction (replay-safe, atomic)
  - refund_service:  reversing a redemption before it settles

Design rules (these must not be relaxed):

  1. Every money-moving function takes an idempotency_key.
  2. Every money operation uses transaction() (BEGIN IMMEDIATE) to acquire the
     write lock atomically.
  3. wallet_transactions, redemptions, merchant_ledger inserts are append-only.
     Status flips are the only mutations allowed on the latter two, and only via
     the explicit refund/settlement code paths.
  4. The QR jti is the security boundary against replay. The UNIQUE constraint
     on redemptions.qr_token_jti is what makes a screenshot of a QR worthless.
"""
import sqlite3
from datetime import datetime, timezone, timedelta
from typing import Optional

from db import (
    transaction, get_connection, new_id, utcnow_iso,
    chf_to_rappen, rappen_to_chf,
)


# Custom exceptions ----------------------------------------------------------

class WalletError(Exception):
    """Base class. Each subclass maps to an HTTP status code in app.py."""
    status_code = 400


class InsufficientFunds(WalletError):
    status_code = 402  # Payment Required


class NotFound(WalletError):
    status_code = 404


class Conflict(WalletError):
    status_code = 409  # used for idempotency replay + double-redeem


class Forbidden(WalletError):
    status_code = 403


# Idempotency helpers --------------------------------------------------------

def _check_idempotency(conn, table: str, key: str) -> Optional[dict]:
    """
    Returns the existing row if this idempotency_key was already used.
    Caller should return that row's response instead of re-executing the op.
    """
    row = conn.execute(
        f"SELECT * FROM {table} WHERE idempotency_key = ?", (key,)
    ).fetchone()
    return dict(row) if row else None


# ============================================================================
# WALLET SERVICE: top-ups and balance management
# ============================================================================

def initiate_topup(
    guest_id: str,
    amount_chf: float,
    payment_method: str,
    idempotency_key: str,
) -> dict:
    """
    Step 1 of top-up: record the intent. Real top-up money lands later via
    complete_topup() once the payment provider webhook fires.
    """
    amount_rappen = chf_to_rappen(amount_chf)
    if amount_rappen <= 0:
        raise WalletError("amount must be positive")
    if payment_method not in ("twint", "card", "cash_at_desk"):
        raise WalletError(f"invalid payment_method: {payment_method}")

    with transaction() as conn:
        existing = _check_idempotency(conn, "topups", idempotency_key)
        if existing:
            return existing

        if not conn.execute("SELECT 1 FROM guests WHERE id = ?", (guest_id,)).fetchone():
            raise NotFound("guest not found")

        topup_id = new_id()
        conn.execute(
            """INSERT INTO topups (id, guest_id, amount_rappen, payment_method,
                                   status, idempotency_key, created_at)
               VALUES (?, ?, ?, ?, 'pending', ?, ?)""",
            (topup_id, guest_id, amount_rappen, payment_method, idempotency_key, utcnow_iso()),
        )
        return dict(conn.execute("SELECT * FROM topups WHERE id = ?", (topup_id,)).fetchone())


def complete_topup(
    topup_id: str,
    payment_provider_ref: str,
    fee_chf: float = 0,
) -> dict:
    """
    Step 2 of top-up: payment provider webhook confirms funds received.
    Atomically: marks topup completed, appends wallet_transaction, updates wallet balance.
    Idempotent on payment_provider_ref - re-entry returns the existing wtx.
    """
    fee_rappen = chf_to_rappen(fee_chf)

    with transaction() as conn:
        topup = conn.execute("SELECT * FROM topups WHERE id = ?", (topup_id,)).fetchone()
        if not topup:
            raise NotFound("topup not found")
        topup = dict(topup)

        # Idempotency: already completed by a previous webhook delivery
        if topup["status"] == "completed":
            wtx = conn.execute(
                "SELECT * FROM wallet_transactions WHERE related_topup_id = ?", (topup_id,)
            ).fetchone()
            return {"topup": topup, "wallet_transaction": dict(wtx) if wtx else None}

        if topup["status"] != "pending":
            raise Conflict(f"topup is in status '{topup['status']}', cannot complete")

        # Lock the wallet row (or create if first ever credit)
        guest_id = topup["guest_id"]
        wallet = conn.execute(
            "SELECT * FROM guest_wallets WHERE guest_id = ?", (guest_id,)
        ).fetchone()
        if wallet is None:
            conn.execute(
                """INSERT INTO guest_wallets (guest_id, balance_rappen, version, updated_at)
                   VALUES (?, 0, 0, ?)""",
                (guest_id, utcnow_iso()),
            )
            current_balance = 0
            current_version = 0
        else:
            current_balance = wallet["balance_rappen"]
            current_version = wallet["version"]

        amount = topup["amount_rappen"]
        new_balance = current_balance + amount

        # Append-only ledger row
        wtx_id = new_id()
        conn.execute(
            """INSERT INTO wallet_transactions
               (id, guest_id, type, amount_rappen, running_balance_rappen,
                related_topup_id, external_ref, idempotency_key, created_at)
               VALUES (?, ?, 'topup', ?, ?, ?, ?, ?, ?)""",
            (wtx_id, guest_id, amount, new_balance, topup_id,
             payment_provider_ref, f"wtx-topup-{topup_id}", utcnow_iso()),
        )

        # Update cached wallet balance (optimistic version bump)
        result = conn.execute(
            """UPDATE guest_wallets
               SET balance_rappen = ?, version = version + 1, updated_at = ?
               WHERE guest_id = ? AND version = ?""",
            (new_balance, utcnow_iso(), guest_id, current_version),
        )
        if result.rowcount != 1:
            raise Conflict("wallet version mismatch - concurrent modification detected")

        # Update topup record
        conn.execute(
            """UPDATE topups
               SET status = 'completed', payment_provider_ref = ?, fee_rappen = ?,
                   completed_at = ?
               WHERE id = ?""",
            (payment_provider_ref, fee_rappen, utcnow_iso(), topup_id),
        )

        topup_after = dict(conn.execute("SELECT * FROM topups WHERE id = ?", (topup_id,)).fetchone())
        wtx_after = dict(conn.execute("SELECT * FROM wallet_transactions WHERE id = ?", (wtx_id,)).fetchone())
        return {"topup": topup_after, "wallet_transaction": wtx_after}


def get_wallet(guest_id: str) -> dict:
    """Read-only: balance + entitlements + recent transactions."""
    conn = get_connection()
    try:
        guest = conn.execute("SELECT * FROM guests WHERE id = ?", (guest_id,)).fetchone()
        if not guest:
            raise NotFound("guest not found")

        wallet = conn.execute(
            "SELECT * FROM guest_wallets WHERE guest_id = ?", (guest_id,)
        ).fetchone()
        balance_rappen = wallet["balance_rappen"] if wallet else 0

        entitlements = conn.execute(
            """SELECT e.*, o.title, o.description, o.partner_id, p.name AS partner_name
               FROM entitlements e
               JOIN offers o ON o.id = e.offer_id
               JOIN partners p ON p.id = o.partner_id
               WHERE e.guest_id = ? AND e.status = 'issued'
               ORDER BY e.issued_at DESC""",
            (guest_id,),
        ).fetchall()

        offers = conn.execute(
            """SELECT o.*, p.name AS partner_name
               FROM offers o JOIN partners p ON p.id = o.partner_id
               WHERE o.type = 'priced' AND o.active = 1
               ORDER BY p.name, o.title""",
        ).fetchall()

        recent_tx = conn.execute(
            """SELECT * FROM wallet_transactions WHERE guest_id = ?
               ORDER BY created_at DESC LIMIT 20""",
            (guest_id,),
        ).fetchall()

        return {
            "guest": dict(guest),
            "balance_chf": rappen_to_chf(balance_rappen),
            "entitlements": [dict(e) for e in entitlements],
            "available_priced_offers": [dict(o) for o in offers],
            "recent_transactions": [dict(t) for t in recent_tx],
        }
    finally:
        conn.close()


# ============================================================================
# REDEMPTION SERVICE: the critical transaction
# ============================================================================

def execute_redemption(
    qr_payload: dict,
    partner_id: str,
    idempotency_key: str,
) -> dict:
    """
    The single most important function in the system.

    Called by the partner's POST /redeem after they've scanned the QR. The JWT
    has already been signature-verified and expiry-checked by the caller.

    Atomicity contract:
      Either the entire flow happens (entitlement consumed OR wallet debited,
      redemption recorded, merchant_ledger entry created) or none of it does.

    Replay safety:
      The qr_token_jti UNIQUE constraint is the line of defense. A second scan
      of the same QR causes an IntegrityError on INSERT INTO redemptions, which
      rolls back the whole transaction.
    """
    jti = qr_payload["jti"]
    guest_id = qr_payload["guest_id"]
    offer_id = qr_payload["offer_id"]
    redemption_type = qr_payload["type"]
    amount_rappen = qr_payload["amount_rappen"]
    entitlement_id = qr_payload.get("entitlement_id")

    with transaction() as conn:
        # Idempotency replay (different from JTI replay - same client, retried HTTP call)
        existing = _check_idempotency(conn, "redemptions", idempotency_key)
        if existing:
            return existing

        # Validate offer + partner consistency
        offer = conn.execute(
            "SELECT * FROM offers WHERE id = ? AND active = 1", (offer_id,)
        ).fetchone()
        if not offer:
            raise NotFound("offer not found or inactive")
        if offer["partner_id"] != partner_id:
            raise Forbidden("this offer does not belong to your partner account")
        # 'priced' offers redeem via 'wallet_spend' QRs;
        # 'entitlement' offers redeem via 'entitlement' QRs.
        expected_qr_type = "wallet_spend" if offer["type"] == "priced" else "entitlement"
        if expected_qr_type != redemption_type:
            raise WalletError("offer/QR type mismatch")
        if offer["partner_payout_rappen"] != amount_rappen:
            raise WalletError("amount in QR does not match offer")

        redemption_id = new_id()
        wtx_id = None

        if redemption_type == "wallet_spend":
            # ---- Wallet-spend path -------------------------------------------
            wallet = conn.execute(
                "SELECT * FROM guest_wallets WHERE guest_id = ?", (guest_id,)
            ).fetchone()
            if not wallet:
                raise InsufficientFunds("no wallet for guest")
            balance = wallet["balance_rappen"]
            version = wallet["version"]

            if balance < amount_rappen:
                raise InsufficientFunds(
                    f"balance {rappen_to_chf(balance)} CHF < required {rappen_to_chf(amount_rappen)} CHF"
                )

            new_balance = balance - amount_rappen

            # Append spend to ledger
            wtx_id = new_id()
            conn.execute(
                """INSERT INTO wallet_transactions
                   (id, guest_id, type, amount_rappen, running_balance_rappen,
                    related_redemption_id, idempotency_key, created_at)
                   VALUES (?, ?, 'spend', ?, ?, ?, ?, ?)""",
                (wtx_id, guest_id, -amount_rappen, new_balance,
                 redemption_id, f"wtx-spend-{redemption_id}", utcnow_iso()),
            )

            # Update cached balance with version guard
            result = conn.execute(
                """UPDATE guest_wallets
                   SET balance_rappen = ?, version = version + 1, updated_at = ?
                   WHERE guest_id = ? AND version = ?""",
                (new_balance, utcnow_iso(), guest_id, version),
            )
            if result.rowcount != 1:
                raise Conflict("wallet version mismatch - concurrent modification")

        elif redemption_type == "entitlement":
            # ---- Entitlement path --------------------------------------------
            ent = conn.execute(
                "SELECT * FROM entitlements WHERE id = ?", (entitlement_id,)
            ).fetchone()
            if not ent:
                raise NotFound("entitlement not found")
            if ent["guest_id"] != guest_id or ent["offer_id"] != offer_id:
                raise Forbidden("entitlement does not match QR claims")
            if ent["status"] != "issued":
                raise Conflict(f"entitlement is in status '{ent['status']}', cannot redeem")

            # Race-safe status flip: check status in WHERE clause
            result = conn.execute(
                """UPDATE entitlements
                   SET status = 'redeemed', redeemed_at = ?, redemption_id = ?
                   WHERE id = ? AND status = 'issued'""",
                (utcnow_iso(), redemption_id, entitlement_id),
            )
            if result.rowcount != 1:
                raise Conflict("entitlement was concurrently redeemed")

        # Insert the redemption row.
        # The UNIQUE on qr_token_jti will fire here if this QR was already used.
        try:
            conn.execute(
                """INSERT INTO redemptions
                   (id, guest_id, partner_id, offer_id, type, entitlement_id,
                    wallet_transaction_id, amount_rappen, qr_token_jti,
                    idempotency_key, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (redemption_id, guest_id, partner_id, offer_id, redemption_type,
                 entitlement_id if redemption_type == "entitlement" else None,
                 wtx_id if redemption_type == "wallet_spend" else None,
                 amount_rappen, jti, idempotency_key, utcnow_iso()),
            )
        except sqlite3.IntegrityError as e:
            if "qr_token_jti" in str(e):
                raise Conflict("this QR code has already been redeemed")
            raise

        # Tell the merchant ledger we owe the partner
        conn.execute(
            """INSERT INTO merchant_ledger
               (id, partner_id, redemption_id, amount_rappen, status, created_at)
               VALUES (?, ?, ?, ?, 'pending', ?)""",
            (new_id(), partner_id, redemption_id, amount_rappen, utcnow_iso()),
        )

        return dict(conn.execute(
            "SELECT * FROM redemptions WHERE id = ?", (redemption_id,)
        ).fetchone())


# ============================================================================
# REFUND SERVICE: reverse a redemption before settlement
# ============================================================================

def refund_redemption(
    redemption_id: str,
    partner_id: str,
    reason: str,
    idempotency_key: str,
) -> dict:
    """
    Reverse a redemption. Only allowed if merchant_ledger entry is still 'pending'
    (i.e. not yet batched for settlement). After settlement, refunds become
    next-batch debit adjustments instead - that path is out of scope for v1.
    """
    with transaction() as conn:
        # idempotency on wallet_transactions for the reversal entry
        existing = conn.execute(
            "SELECT * FROM wallet_transactions WHERE idempotency_key = ?",
            (idempotency_key,),
        ).fetchone()
        if existing:
            return {"already_refunded": True, "wallet_transaction": dict(existing)}

        red = conn.execute(
            "SELECT * FROM redemptions WHERE id = ?", (redemption_id,)
        ).fetchone()
        if not red:
            raise NotFound("redemption not found")
        red = dict(red)
        if red["partner_id"] != partner_id:
            raise Forbidden("not your redemption")
        if red["reversed"]:
            raise Conflict("already reversed")

        ml = conn.execute(
            "SELECT * FROM merchant_ledger WHERE redemption_id = ?", (redemption_id,)
        ).fetchone()
        if not ml or ml["status"] != "pending":
            raise Conflict(
                f"refund window closed (ledger status: {ml['status'] if ml else 'missing'})"
            )

        amount = red["amount_rappen"]
        wtx = None

        if red["type"] == "wallet_spend":
            # Credit the guest wallet back
            wallet = conn.execute(
                "SELECT * FROM guest_wallets WHERE guest_id = ?", (red["guest_id"],)
            ).fetchone()
            new_balance = wallet["balance_rappen"] + amount
            version = wallet["version"]

            wtx_id = new_id()
            conn.execute(
                """INSERT INTO wallet_transactions
                   (id, guest_id, type, amount_rappen, running_balance_rappen,
                    related_redemption_id, idempotency_key, created_at)
                   VALUES (?, ?, 'refund', ?, ?, ?, ?, ?)""",
                (wtx_id, red["guest_id"], amount, new_balance,
                 redemption_id, idempotency_key, utcnow_iso()),
            )
            r = conn.execute(
                """UPDATE guest_wallets
                   SET balance_rappen = ?, version = version + 1, updated_at = ?
                   WHERE guest_id = ? AND version = ?""",
                (new_balance, utcnow_iso(), red["guest_id"], version),
            )
            if r.rowcount != 1:
                raise Conflict("wallet version mismatch on refund")
            wtx = dict(conn.execute(
                "SELECT * FROM wallet_transactions WHERE id = ?", (wtx_id,)
            ).fetchone())
        else:
            # Restore the entitlement so guest can use it again
            conn.execute(
                """UPDATE entitlements
                   SET status = 'issued', redeemed_at = NULL, redemption_id = NULL
                   WHERE id = ?""",
                (red["entitlement_id"],),
            )

        # Mark redemption + merchant_ledger as reversed
        conn.execute("UPDATE redemptions SET reversed = 1 WHERE id = ?", (redemption_id,))
        conn.execute(
            "UPDATE merchant_ledger SET status = 'reversed' WHERE redemption_id = ?",
            (redemption_id,),
        )

        return {
            "redemption_id": redemption_id,
            "reason": reason,
            "wallet_transaction": wtx,
            "type": red["type"],
        }


# ============================================================================
# ENTITLEMENT ISSUANCE: called at check-in
# ============================================================================

def issue_entitlements_for_guest(guest_id: str, conn=None) -> list[dict]:
    """
    Issues all entitlement-type offers to the guest based on eligibility rules.
    Called from /checkin. For the hackathon we issue every active entitlement
    offer; production would parse offer.eligibility_rules JSON.
    """
    own_conn = conn is None
    if own_conn:
        conn = get_connection()
    try:
        guest = conn.execute("SELECT * FROM guests WHERE id = ?", (guest_id,)).fetchone()
        if not guest:
            raise NotFound("guest not found")

        offers = conn.execute(
            "SELECT * FROM offers WHERE type = 'entitlement' AND active = 1"
        ).fetchall()

        issued = []
        # Expire at check-out + 1 day for safety
        check_out = datetime.fromisoformat(guest["check_out"])
        expires_at = (check_out + timedelta(days=1)).isoformat()

        for offer in offers:
            # Skip if already issued for this stay
            existing = conn.execute(
                """SELECT 1 FROM entitlements
                   WHERE guest_id = ? AND offer_id = ? AND status IN ('issued','redeemed')""",
                (guest_id, offer["id"]),
            ).fetchone()
            if existing:
                continue

            ent_id = new_id()
            conn.execute(
                """INSERT INTO entitlements
                   (id, guest_id, offer_id, status, issued_at, expires_at)
                   VALUES (?, ?, ?, 'issued', ?, ?)""",
                (ent_id, guest_id, offer["id"], utcnow_iso(), expires_at),
            )
            issued.append({"id": ent_id, "offer_title": offer["title"]})
        return issued
    finally:
        if own_conn:
            conn.close()
