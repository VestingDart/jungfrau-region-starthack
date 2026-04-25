"""
Database layer for the Jungfrau Region wallet.

Money is stored as INTEGER rappen (1 CHF = 100 rappen) throughout the database
to avoid floating-point arithmetic bugs. The API converts to/from CHF at the edges.
"""
import sqlite3
import os
import json
import uuid
from datetime import datetime, timezone
from contextlib import contextmanager

DB_PATH = os.environ.get("WALLET_DB", "wallet.db")


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id() -> str:
    return str(uuid.uuid4())


def chf_to_rappen(chf: float) -> int:
    return round(float(chf) * 100)


def rappen_to_chf(rappen: int) -> float:
    return round(rappen / 100, 2)


def get_connection() -> sqlite3.Connection:
    """Returns a connection with foreign keys ON and rows as dicts."""
    conn = sqlite3.connect(DB_PATH, isolation_level=None, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


@contextmanager
def transaction():
    """
    Context manager for atomic transactions. Uses BEGIN IMMEDIATE so the write
    lock is acquired up front - critical for the redemption transaction where
    we cannot tolerate phantom reads on guest_wallets.
    """
    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        yield conn
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


SCHEMA = """
-- Identity & catalog ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS guests (
    id              TEXT PRIMARY KEY,
    guest_card_id   TEXT UNIQUE NOT NULL,
    email           TEXT,
    booking_ref     TEXT,
    check_in        TEXT NOT NULL,        -- ISO date
    check_out       TEXT NOT NULL,        -- ISO date
    created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS partners (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    legal_entity     TEXT NOT NULL,
    iban             TEXT NOT NULL,
    bic              TEXT NOT NULL,
    payout_schedule  TEXT NOT NULL CHECK (payout_schedule IN ('weekly','monthly')),
    status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
    api_key          TEXT UNIQUE NOT NULL, -- simple bearer auth for partner endpoints (hackathon)
    created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS offers (
    id                   TEXT PRIMARY KEY,
    partner_id           TEXT NOT NULL REFERENCES partners(id),
    title                TEXT NOT NULL,
    description          TEXT,
    type                 TEXT NOT NULL CHECK (type IN ('entitlement','priced')),
    guest_price_rappen   INTEGER NOT NULL DEFAULT 0 CHECK (guest_price_rappen >= 0),
    partner_payout_rappen INTEGER NOT NULL CHECK (partner_payout_rappen >= 0),
    eligibility_rules    TEXT NOT NULL DEFAULT '{}',  -- JSON
    redemption_rules     TEXT NOT NULL DEFAULT '{}',  -- JSON
    active               INTEGER NOT NULL DEFAULT 1,
    created_at           TEXT NOT NULL
);

-- Wallet & money ledger -------------------------------------------------------

CREATE TABLE IF NOT EXISTS guest_wallets (
    guest_id        TEXT PRIMARY KEY REFERENCES guests(id),
    balance_rappen  INTEGER NOT NULL DEFAULT 0 CHECK (balance_rappen >= 0),
    version         INTEGER NOT NULL DEFAULT 0,
    updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id                       TEXT PRIMARY KEY,
    guest_id                 TEXT NOT NULL REFERENCES guests(id),
    type                     TEXT NOT NULL CHECK (type IN ('topup','spend','refund','earn','adjustment')),
    amount_rappen            INTEGER NOT NULL,         -- signed: + inflow, - outflow
    running_balance_rappen   INTEGER NOT NULL,
    related_topup_id         TEXT,
    related_redemption_id    TEXT,
    related_refund_id        TEXT,
    external_ref             TEXT,
    idempotency_key          TEXT UNIQUE NOT NULL,
    created_at               TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_wtx_guest_time ON wallet_transactions(guest_id, created_at DESC);

-- Topups, entitlements, redemptions ------------------------------------------

CREATE TABLE IF NOT EXISTS topups (
    id                       TEXT PRIMARY KEY,
    guest_id                 TEXT NOT NULL REFERENCES guests(id),
    amount_rappen            INTEGER NOT NULL CHECK (amount_rappen > 0),
    payment_method           TEXT NOT NULL CHECK (payment_method IN ('twint','card','cash_at_desk')),
    payment_provider_ref     TEXT,
    fee_rappen               INTEGER NOT NULL DEFAULT 0,
    status                   TEXT NOT NULL CHECK (status IN ('pending','completed','failed','refunded')),
    idempotency_key          TEXT UNIQUE NOT NULL,
    created_at               TEXT NOT NULL,
    completed_at             TEXT
);

CREATE TABLE IF NOT EXISTS entitlements (
    id              TEXT PRIMARY KEY,
    guest_id        TEXT NOT NULL REFERENCES guests(id),
    offer_id        TEXT NOT NULL REFERENCES offers(id),
    status          TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','redeemed','expired','revoked')),
    issued_at       TEXT NOT NULL,
    redeemed_at     TEXT,
    redemption_id   TEXT,
    expires_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_entitlements_guest ON entitlements(guest_id, status);

CREATE TABLE IF NOT EXISTS redemptions (
    id                       TEXT PRIMARY KEY,
    guest_id                 TEXT NOT NULL REFERENCES guests(id),
    partner_id               TEXT NOT NULL REFERENCES partners(id),
    offer_id                 TEXT NOT NULL REFERENCES offers(id),
    type                     TEXT NOT NULL CHECK (type IN ('entitlement','wallet_spend')),
    entitlement_id           TEXT REFERENCES entitlements(id),
    wallet_transaction_id    TEXT REFERENCES wallet_transactions(id),
    amount_rappen            INTEGER NOT NULL,
    qr_token_jti             TEXT UNIQUE NOT NULL,    -- the security boundary against replay
    idempotency_key          TEXT UNIQUE NOT NULL,
    reversed                 INTEGER NOT NULL DEFAULT 0,
    created_at               TEXT NOT NULL,
    CHECK (
        (type = 'entitlement' AND entitlement_id IS NOT NULL AND wallet_transaction_id IS NULL)
        OR
        (type = 'wallet_spend' AND wallet_transaction_id IS NOT NULL AND entitlement_id IS NULL)
    )
);
CREATE INDEX IF NOT EXISTS ix_redemptions_partner ON redemptions(partner_id, created_at DESC);

-- Merchant payout ledger ------------------------------------------------------

CREATE TABLE IF NOT EXISTS settlement_batches (
    id                  TEXT PRIMARY KEY,
    partner_id          TEXT NOT NULL REFERENCES partners(id),
    period_start        TEXT NOT NULL,
    period_end          TEXT NOT NULL,
    total_rappen        INTEGER NOT NULL,
    redemption_count    INTEGER NOT NULL,
    payment_reference   TEXT NOT NULL UNIQUE,
    pain001_file_path   TEXT,
    bank_transaction_ref TEXT,
    status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','confirmed','failed')),
    created_at          TEXT NOT NULL,
    submitted_at        TEXT,
    confirmed_at        TEXT
);

CREATE TABLE IF NOT EXISTS merchant_ledger (
    id              TEXT PRIMARY KEY,
    partner_id      TEXT NOT NULL REFERENCES partners(id),
    redemption_id   TEXT NOT NULL UNIQUE REFERENCES redemptions(id),
    amount_rappen   INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','batched','settled','disputed','reversed')),
    batch_id        TEXT REFERENCES settlement_batches(id),
    created_at      TEXT NOT NULL,
    settled_at      TEXT
);
CREATE INDEX IF NOT EXISTS ix_ml_partner_status ON merchant_ledger(partner_id, status);
"""


def init_db():
    """Create all tables. Idempotent."""
    conn = get_connection()
    try:
        conn.executescript(SCHEMA)
    finally:
        conn.close()


def reset_db():
    """Wipe and recreate. Used by tests and seed."""
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    # Also remove WAL/SHM sidecars
    for ext in ("-wal", "-shm"):
        sidecar = DB_PATH + ext
        if os.path.exists(sidecar):
            os.remove(sidecar)
    init_db()


# Convenience: row -> dict with money fields converted to CHF for API responses

def row_to_dict(row, money_fields=()) -> dict:
    if row is None:
        return None
    d = dict(row)
    for f in money_fields:
        if f.endswith("_rappen") and f in d:
            chf_field = f.replace("_rappen", "_chf")
            d[chf_field] = rappen_to_chf(d[f])
            del d[f]
    return d
