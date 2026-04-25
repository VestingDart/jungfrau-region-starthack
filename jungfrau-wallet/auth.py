"""
Authentication helpers.

Two distinct auth mechanisms:

1. QR tokens (JWT, HS256, 60s TTL) - signed proof a guest authorized a redemption.
   The `jti` is the anti-replay key, enforced by a UNIQUE constraint on
   redemptions.qr_token_jti at the database layer.

2. Partner API keys (simple bearer tokens) - partner identifies itself to the
   /redeem and /partner/* endpoints. Production would replace this with OIDC
   or session cookies; the API-key model is fine for the hackathon prototype.
"""
import os
import jwt  # PyJWT
from datetime import datetime, timezone, timedelta
from typing import Optional
from db import new_id, get_connection

# In production: from a secret store. For hackathon: env var with a sane default.
JWT_SECRET = os.environ.get("WALLET_JWT_SECRET", "hackathon-dev-secret-do-not-use-in-prod")
JWT_ALG = "HS256"
QR_TTL_SECONDS = 60


def mint_qr_token(
    guest_id: str,
    offer_id: str,
    type_: str,                  # 'entitlement' or 'wallet_spend'
    amount_rappen: int,
    entitlement_id: Optional[str] = None,
) -> tuple[str, str]:
    """
    Returns (jwt_string, jti). The jti is what we'll later look up in
    redemptions.qr_token_jti to prove single-use.
    """
    if type_ not in ("entitlement", "wallet_spend"):
        raise ValueError("type must be 'entitlement' or 'wallet_spend'")
    if type_ == "entitlement" and not entitlement_id:
        raise ValueError("entitlement_id required for entitlement type")

    jti = new_id()
    now = datetime.now(timezone.utc)
    payload = {
        "jti": jti,
        "guest_id": guest_id,
        "offer_id": offer_id,
        "type": type_,
        "amount_rappen": amount_rappen,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=QR_TTL_SECONDS)).timestamp()),
    }
    if entitlement_id:
        payload["entitlement_id"] = entitlement_id

    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)
    return token, jti


def verify_qr_token(token: str) -> dict:
    """
    Returns the decoded payload. Raises:
      - jwt.ExpiredSignatureError if past exp
      - jwt.InvalidTokenError for any other invalidity
    Caller is responsible for the anti-replay check (DB unique on jti).
    """
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])


def authenticate_partner(api_key: str) -> Optional[dict]:
    """
    Look up a partner by API key. Returns partner row dict or None.
    Hackathon-grade auth - swap for proper OIDC in production.
    """
    if not api_key:
        return None
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM partners WHERE api_key = ? AND status = 'active'",
            (api_key,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()
