"""
End-to-end test using Flask's test client. Exercises every critical flow.

Run: python tests/test_e2e.py
"""
import os
import sys
import json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Use a separate test database so we don't clobber demo data
os.environ["WALLET_DB"] = "test_wallet.db"
os.environ["PAIN001_DIR"] = "test_pain001_files"

import db
import seed
from app import app


PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"


def check(name, condition, detail=""):
    if condition:
        print(f"  {PASS} {name}")
    else:
        print(f"  {FAIL} {name}  {detail}")
        global FAILED
        FAILED += 1


FAILED = 0


def main():
    global FAILED

    print("\n=== Setup ===")
    info = seed.seed()
    client = app.test_client()
    admin_key = "admin-dev-key"

    guest = info["guests"][0]
    partner_baeckerei = next(p for p in info["partners"]
                             if p["api_key"] == "key-baeckerei")
    partner_outdoor = next(p for p in info["partners"]
                           if p["api_key"] == "key-outdoor")

    # Look up offer IDs
    conn = db.get_connection()
    offer_lunch_priced = dict(conn.execute(
        "SELECT * FROM offers WHERE title LIKE '%Lunch sandwich%'"
    ).fetchone())
    offer_coffee_entitlement = dict(conn.execute(
        "SELECT * FROM offers WHERE title LIKE '%Welcome coffee%'"
    ).fetchone())
    offer_rafting = dict(conn.execute(
        "SELECT * FROM offers WHERE title LIKE '%rafting%'"
    ).fetchone())
    conn.close()

    print(f"  guest:    {guest['guest_card_id']}")
    print(f"  partner1: {partner_baeckerei['name']}")
    print(f"  partner2: {partner_outdoor['name']}")

    # ------------------------------------------------------------------------
    print("\n=== 1. Wallet starts empty, has entitlements ===")
    r = client.get(f"/api/wallet/{guest['id']}")
    data = r.get_json()
    check("wallet endpoint returns 200", r.status_code == 200)
    check("balance starts at 0 CHF", data["balance_chf"] == 0)
    check("entitlements were auto-issued at seed",
          len(data["entitlements"]) > 0,
          f"got {len(data['entitlements'])}")

    # ------------------------------------------------------------------------
    print("\n=== 2. Top-up flow: initiate -> webhook -> balance ===")
    r = client.post(
        f"/api/wallet/{guest['id']}/topup",
        headers={"Idempotency-Key": "topup-test-1"},
        json={"amount_chf": 200.00, "payment_method": "twint"},
    )
    check("topup initiated", r.status_code == 200, r.get_data(as_text=True))
    topup_id = r.get_json()["topup"]["id"]

    # idempotency: same key returns same topup row, no duplicates
    r = client.post(
        f"/api/wallet/{guest['id']}/topup",
        headers={"Idempotency-Key": "topup-test-1"},
        json={"amount_chf": 200.00, "payment_method": "twint"},
    )
    check("topup idempotency works", r.get_json()["topup"]["id"] == topup_id)

    # provider webhook: complete the topup
    r = client.post("/api/webhooks/payment", json={
        "topup_id": topup_id,
        "payment_provider_ref": "TWINT-TEST-1",
        "fee_chf": 0.80,
    })
    check("webhook completed topup", r.status_code == 200, r.get_data(as_text=True))

    # webhook idempotency: replay
    r2 = client.post("/api/webhooks/payment", json={
        "topup_id": topup_id,
        "payment_provider_ref": "TWINT-TEST-1",
        "fee_chf": 0.80,
    })
    check("webhook replay is idempotent", r2.status_code == 200)

    # balance should be 200
    r = client.get(f"/api/wallet/{guest['id']}")
    check("wallet balance is 200 CHF after topup",
          r.get_json()["balance_chf"] == 200.00,
          f"got {r.get_json()['balance_chf']}")

    # ------------------------------------------------------------------------
    print("\n=== 3. Wallet-spend redemption (priced offer) ===")
    # Generate QR for the priced lunch sandwich (CHF 12)
    r = client.post("/api/qr/generate", json={
        "guest_id": guest["id"],
        "offer_id": offer_lunch_priced["id"],
    })
    check("QR generated for priced offer", r.status_code == 200)
    qr_token = r.get_json()["qr_token"]

    # Partner Bäckerei scans
    r = client.post(
        "/api/redeem",
        headers={
            "X-API-Key": "key-baeckerei",
            "Idempotency-Key": "redeem-test-1",
        },
        json={"qr_token": qr_token},
    )
    check("redemption succeeded", r.status_code == 200, r.get_data(as_text=True))
    redemption_id = r.get_json()["redemption_id"]

    # Balance should be 200 - 12 = 188
    r = client.get(f"/api/wallet/{guest['id']}")
    check("wallet debited correctly to 188 CHF",
          r.get_json()["balance_chf"] == 188.00,
          f"got {r.get_json()['balance_chf']}")

    # ------------------------------------------------------------------------
    print("\n=== 4. Replay protection: same QR fails on second scan ===")
    r = client.post(
        "/api/redeem",
        headers={
            "X-API-Key": "key-baeckerei",
            "Idempotency-Key": "redeem-test-replay",  # different key, same QR
        },
        json={"qr_token": qr_token},
    )
    check("second scan of same QR is blocked",
          r.status_code == 409,
          f"got {r.status_code}: {r.get_data(as_text=True)}")

    # Idempotency key replay should return original response, not error
    r = client.post(
        "/api/redeem",
        headers={
            "X-API-Key": "key-baeckerei",
            "Idempotency-Key": "redeem-test-1",  # original key
        },
        json={"qr_token": qr_token},
    )
    check("idempotency key replay returns original (not error)",
          r.status_code == 200,
          f"got {r.status_code}")

    # ------------------------------------------------------------------------
    print("\n=== 5. Wrong partner scanning a QR is rejected ===")
    r = client.post("/api/qr/generate", json={
        "guest_id": guest["id"],
        "offer_id": offer_lunch_priced["id"],
    })
    qr_token2 = r.get_json()["qr_token"]
    # outdoor partner tries to redeem a Bäckerei offer
    r = client.post(
        "/api/redeem",
        headers={"X-API-Key": "key-outdoor", "Idempotency-Key": "wrong-partner-1"},
        json={"qr_token": qr_token2},
    )
    check("wrong partner is blocked",
          r.status_code == 403,
          f"got {r.status_code}")

    # ------------------------------------------------------------------------
    print("\n=== 6. Entitlement redemption (no money debit) ===")
    r = client.get(f"/api/wallet/{guest['id']}")
    wallet = r.get_json()
    coffee_ent = next(
        e for e in wallet["entitlements"]
        if e["offer_id"] == offer_coffee_entitlement["id"]
    )

    r = client.post("/api/qr/generate", json={
        "guest_id": guest["id"],
        "entitlement_id": coffee_ent["id"],
    })
    check("entitlement QR generated", r.status_code == 200)
    qr_ent = r.get_json()["qr_token"]

    r = client.post(
        "/api/redeem",
        headers={"X-API-Key": "key-baeckerei", "Idempotency-Key": "redeem-ent-1"},
        json={"qr_token": qr_ent},
    )
    check("entitlement redeemed", r.status_code == 200, r.get_data(as_text=True))

    # Balance unchanged (entitlements are bundled with booking, not paid from wallet)
    r = client.get(f"/api/wallet/{guest['id']}")
    check("balance unchanged after entitlement redemption",
          r.get_json()["balance_chf"] == 188.00)
    check("entitlement removed from active list",
          all(e["id"] != coffee_ent["id"] for e in r.get_json()["entitlements"]))

    # ------------------------------------------------------------------------
    print("\n=== 7. Partner dashboard shows pending payout ===")
    r = client.get("/api/partner/dashboard", headers={"X-API-Key": "key-baeckerei"})
    dash = r.get_json()
    expected_pending = 12.00 + 6.50  # priced lunch + coffee entitlement payout
    check("partner pending payout matches",
          dash["pending_chf"] == expected_pending,
          f"expected {expected_pending}, got {dash['pending_chf']}")
    check("partner sees 2 pending redemptions", dash["pending_count"] == 2)

    # ------------------------------------------------------------------------
    print("\n=== 8. Refund flow ===")
    r = client.post(
        "/api/partner/refund",
        headers={"X-API-Key": "key-baeckerei", "Idempotency-Key": "refund-1"},
        json={"redemption_id": redemption_id, "reason": "wrong order"},
    )
    check("refund succeeded", r.status_code == 200, r.get_data(as_text=True))

    # Balance should be back to 200
    r = client.get(f"/api/wallet/{guest['id']}")
    check("balance refunded to 200 CHF",
          r.get_json()["balance_chf"] == 200.00,
          f"got {r.get_json()['balance_chf']}")

    # Pending payout dropped
    r = client.get("/api/partner/dashboard", headers={"X-API-Key": "key-baeckerei"})
    check("partner pending dropped to 6.50 (only entitlement remains)",
          r.get_json()["pending_chf"] == 6.50,
          f"got {r.get_json()['pending_chf']}")

    # ------------------------------------------------------------------------
    print("\n=== 9. Insufficient funds is rejected at QR generation ===")
    r = client.post("/api/qr/generate", json={
        "guest_id": guest["id"],
        "offer_id": offer_rafting["id"],  # CHF 95 - rafting is CHF 95, balance is 200, fits
    })
    check("can generate QR for affordable priced offer", r.status_code == 200)

    # Now drain the wallet via another redemption
    r = client.post("/api/qr/generate", json={
        "guest_id": guest["id"],
        "offer_id": offer_rafting["id"],
    })
    qr_drain = r.get_json()["qr_token"]
    r = client.post(
        "/api/redeem",
        headers={"X-API-Key": "key-outdoor", "Idempotency-Key": "drain-1"},
        json={"qr_token": qr_drain},
    )
    check("rafting redemption succeeded (200 - 95 = 105)", r.status_code == 200)

    # Try to redeem 140 CHF canyoning - should fail at QR generation (balance 105)
    conn = db.get_connection()
    canyoning = dict(conn.execute("SELECT * FROM offers WHERE title LIKE '%Canyoning%'").fetchone())
    conn.close()

    r = client.post("/api/qr/generate", json={
        "guest_id": guest["id"],
        "offer_id": canyoning["id"],
    })
    check("QR generation rejects insufficient funds",
          r.status_code == 402,
          f"got {r.status_code}")

    # ------------------------------------------------------------------------
    print("\n=== 10. Settlement run produces real pain.001 XML ===")
    r = client.post(
        "/api/admin/settlement/run",
        headers={"X-Admin-Key": admin_key},
        json={"period_start": "2020-01-01", "period_end": "2099-12-31"},
    )
    check("settlement run succeeded", r.status_code == 200, r.get_data(as_text=True))
    sett = r.get_json()
    check("pain.001 file was generated",
          sett["pain001_file"] and os.path.exists(sett["pain001_file"]),
          f"path: {sett.get('pain001_file')}")
    check("at least one batch was created",
          len(sett["batches"]) >= 1,
          f"got {len(sett['batches'])}")

    # Inspect the XML
    with open(sett["pain001_file"]) as f:
        xml_content = f.read()
    check("pain.001 has correct namespace",
          "urn:iso:std:iso:20022:tech:xsd:pain.001.001.09" in xml_content)
    check("pain.001 contains CHF currency", 'Ccy="CHF"' in xml_content)
    check("pain.001 contains an IBAN", "<IBAN" in xml_content or ":IBAN" in xml_content)
    check("pain.001 contains initiator name",
          "Jungfrau Region Tourismus AG" in xml_content)

    # Confirm one batch
    batch_to_confirm = sett["batches"][0]
    r = client.post(
        "/api/admin/settlement/confirm",
        headers={"X-Admin-Key": admin_key},
        json={
            "batch_id": batch_to_confirm["batch_id"],
            "bank_transaction_ref": "SIC-2026-04-25-9999",
        },
    )
    check("batch confirmation succeeded", r.status_code == 200)

    # Partner dashboard now reflects settled status
    api_key = next(p["api_key"] for p in info["partners"]
                   if p["id"] == batch_to_confirm["partner_id"])
    r = client.get("/api/partner/dashboard", headers={"X-API-Key": api_key})
    dash = r.get_json()
    check("settled CHF is non-zero on partner dashboard",
          dash["settled_chf"] > 0,
          f"got {dash['settled_chf']}")

    # ------------------------------------------------------------------------
    print("\n=== 11. Wallet balance invariant ===")
    # Sum of wallet_transactions must equal the cached wallet balance
    conn = db.get_connection()
    wallet = dict(conn.execute(
        "SELECT * FROM guest_wallets WHERE guest_id = ?", (guest["id"],)
    ).fetchone())
    sum_row = conn.execute(
        "SELECT SUM(amount_rappen) AS s FROM wallet_transactions WHERE guest_id = ?",
        (guest["id"],),
    ).fetchone()
    conn.close()
    check("balance == sum of all wallet_transactions",
          wallet["balance_rappen"] == sum_row["s"],
          f"balance={wallet['balance_rappen']}, sum={sum_row['s']}")

    # ------------------------------------------------------------------------
    print("\n=== Summary ===")
    if FAILED == 0:
        print(f"\n{PASS} all checks passed\n")
        return 0
    else:
        print(f"\n{FAIL} {FAILED} check(s) failed\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
