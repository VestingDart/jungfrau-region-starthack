"""
Seed data for the demo.

Modeled on real Jungfrau Region partner types: mountain railway, ski school,
ski rental, restaurants in the resort villages, plus a sustainability reward.
"""
import db
from db import new_id, utcnow_iso, chf_to_rappen


PARTNERS = [
    {
        "name": "Jungfraubahnen",
        "legal_entity": "Jungfraubahnen Holding AG",
        "iban": "CH3608387000001080173", "bic": "POFICHBEXXX",
        "payout_schedule": "weekly", "api_key": "key-jungfraubahnen",
    },
    {
        "name": "Bäckerei Müller Grindelwald",
        "legal_entity": "Müller Bäckerei GmbH",
        "iban": "CH5604835012345678901", "bic": "CRESCHZZ80A",
        "payout_schedule": "monthly", "api_key": "key-baeckerei",
    },
    {
        "name": "Outdoor Interlaken",
        "legal_entity": "Outdoor Interlaken AG",
        "iban": "CH9300762011623852957", "bic": "POFICHBEXXX",
        "payout_schedule": "weekly", "api_key": "key-outdoor",
    },
    {
        "name": "Wengen Ski Rental",
        "legal_entity": "Wengen Sport AG",
        "iban": "CH4408401234567890123", "bic": "MIGRCHZZXXX",
        "payout_schedule": "weekly", "api_key": "key-skirental",
    },
    {
        "name": "Restaurant Bergblick Mürren",
        "legal_entity": "Bergblick GmbH",
        "iban": "CH3304835098765432109", "bic": "CRESCHZZ80A",
        "payout_schedule": "monthly", "api_key": "key-bergblick",
    },
]


# Offers: mix of bundled entitlements (paid via booking) and priced wallet items.
# Format per partner key (matches PARTNERS[i]["api_key"]):
#   (title, type, guest_price_chf, partner_payout_chf, description)
OFFERS_BY_PARTNER = {
    "key-jungfraubahnen": [
        ("Cable car day pass (50% off)", "entitlement", 0, 35.00,
         "One-time 50%-off day pass on the Männlichen-Grindelwald cable car"),
        ("First Cliff Walk admission", "entitlement", 0, 12.00,
         "Free admission to the First Cliff Walk experience"),
    ],
    "key-baeckerei": [
        ("Welcome coffee + croissant", "entitlement", 0, 6.50,
         "Free morning coffee and butter croissant, once per stay"),
        ("Lunch sandwich CHF 12", "priced", 12.00, 12.00,
         "Pay from wallet: signature alpine sandwich + drink"),
    ],
    "key-outdoor": [
        ("River rafting (priced)", "priced", 95.00, 95.00,
         "3-hour Lütschine river rafting experience, paid from wallet"),
        ("Canyoning intro", "priced", 140.00, 140.00,
         "Half-day canyoning trip with all gear included"),
    ],
    "key-skirental": [
        ("Ski rental day (15% off)", "entitlement", 0, 38.00,
         "15% off one day of standard ski + boots rental"),
        ("Helmet rental", "priced", 10.00, 10.00,
         "Single-day helmet rental from wallet"),
    ],
    "key-bergblick": [
        ("Fondue dinner CHF 35", "priced", 35.00, 35.00,
         "Traditional fondue dinner per person, panoramic terrace seating"),
        ("Welcome rösti", "entitlement", 0, 18.00,
         "Free Bergblick rösti on arrival, valid lunch only"),
    ],
}


GUESTS = [
    {
        "guest_card_id": "JFR-2026-A0001",
        "email": "anna.example@demo.ch",
        "booking_ref": "BOOK-001",
        "check_in": "2026-04-25",
        "check_out": "2026-04-29",
    },
    {
        "guest_card_id": "JFR-2026-A0002",
        "email": "marco.example@demo.it",
        "booking_ref": "BOOK-002",
        "check_in": "2026-04-26",
        "check_out": "2026-04-30",
    },
]


def seed() -> dict:
    """Idempotent-ish: wipes and recreates everything."""
    db.reset_db()
    conn = db.get_connection()
    try:
        partner_id_by_key = {}
        for p in PARTNERS:
            pid = new_id()
            partner_id_by_key[p["api_key"]] = pid
            conn.execute(
                """INSERT INTO partners (id, name, legal_entity, iban, bic,
                                         payout_schedule, status, api_key, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)""",
                (pid, p["name"], p["legal_entity"], p["iban"], p["bic"],
                 p["payout_schedule"], p["api_key"], utcnow_iso()),
            )

        offer_summaries = []
        for api_key, offers in OFFERS_BY_PARTNER.items():
            partner_id = partner_id_by_key[api_key]
            for title, type_, guest_price_chf, partner_payout_chf, descr in offers:
                oid = new_id()
                conn.execute(
                    """INSERT INTO offers (id, partner_id, title, description, type,
                                           guest_price_rappen, partner_payout_rappen,
                                           active, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)""",
                    (oid, partner_id, title, descr, type_,
                     chf_to_rappen(guest_price_chf), chf_to_rappen(partner_payout_chf),
                     utcnow_iso()),
                )
                offer_summaries.append({"id": oid, "title": title, "type": type_})

        guest_summaries = []
        for g in GUESTS:
            gid = new_id()
            conn.execute(
                """INSERT INTO guests (id, guest_card_id, email, booking_ref,
                                       check_in, check_out, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (gid, g["guest_card_id"], g["email"], g["booking_ref"],
                 g["check_in"], g["check_out"], utcnow_iso()),
            )
            guest_summaries.append({
                "id": gid,
                "guest_card_id": g["guest_card_id"],
                "email": g["email"],
            })
            # Issue entitlements at "check-in"
            import services
            services.issue_entitlements_for_guest(gid, conn=conn)

        return {
            "partners": [{"name": p["name"], "api_key": p["api_key"],
                          "id": partner_id_by_key[p["api_key"]]} for p in PARTNERS],
            "offers": offer_summaries,
            "guests": guest_summaries,
            "admin_key": "admin-dev-key",
        }
    finally:
        conn.close()


if __name__ == "__main__":
    info = seed()
    print("Seeded.")
    print(f"  {len(info['partners'])} partners, {len(info['offers'])} offers, {len(info['guests'])} guests.")
    print("\nPartners (X-API-Key values):")
    for p in info["partners"]:
        print(f"  {p['name']:40s}  api_key={p['api_key']}")
    print("\nGuests:")
    for g in info["guests"]:
        print(f"  {g['guest_card_id']:20s}  id={g['id']}")
    print(f"\nAdmin key (X-Admin-Key): {info['admin_key']}")
