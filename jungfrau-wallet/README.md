# Jungfrau Region Digital Wallet — Hackathon Backend

A working prototype of a closed-loop digital guest wallet for the Jungfrau Region.
Guests pre-load CHF and entitlements, partners redeem via QR scan with zero per-transaction
card fees, and the destination organization batches payouts to partners via real ISO 20022
SIC bank transfers.

**Stack:** Flask · SQLite · PyJWT · vanilla HTML/JS. No blockchain, no fintech license.

---

## Quick start

```bash
pip install -r requirements.txt
python seed.py            # creates wallet.db with demo partners + offers + guests
python app.py             # starts on http://localhost:5000
```

Open three browser tabs:

| URL | Role | What you do here |
|---|---|---|
| `http://localhost:5000/` | **Guest** | Top up wallet, view entitlements, generate QRs |
| `http://localhost:5000/partner` | **Partner** | Paste QR token, redeem, see pending payout |
| `http://localhost:5000/admin` | **Destination** | Run settlement, view pain.001 XML, confirm payouts |

---

## End-to-end demo script (the live walkthrough)

1. **Guest tab** → Pick a guest. Click **Top up via TWINT** for CHF 200, complete the mock payment in the popup. Refresh to see balance.

2. **Guest tab** → Click **Use** on the *Welcome coffee + croissant* entitlement. A QR appears with a 60-second countdown. Click **Copy token**.

3. **Partner tab** → Sign in as **Bäckerei Müller Grindelwald**. Paste the token. Click **Redeem**. ✓ Approved, no money moved from the wallet but the partner is owed CHF 6.50.

4. **Guest tab** → Refresh. The entitlement is gone, balance unchanged. Click **Buy** on the *Lunch sandwich CHF 12*. Generate QR.

5. **Partner tab** → Paste, redeem. Wallet debits CHF 12, pending payout becomes CHF 18.50.

6. **Guest tab** → Try to redeem the same lunch QR again (paste it back). ✗ Rejected — *"this QR has already been redeemed"*. The `qr_token_jti` UNIQUE constraint at the database layer is what blocks it.

7. **Admin tab** → Click **Run settlement now**. Real `pain.001.001.09` ISO 20022 XML is generated. Click **View XML** on the Bäckerei batch. Show judges the file the bank actually accepts.

8. **Admin tab** → Click **Mark paid**, enter a fake SIC reference. The batch flips to confirmed.

9. **Partner tab** → Refresh. Pending → Settled. Partner sees the bank reference.

That's the full lifecycle in two minutes.

---

## Run the test suite

```bash
python tests/test_e2e.py
```

Exercises 30 checks across all critical flows: top-up idempotency, both redemption types, replay protection, wrong-partner rejection, refund, insufficient funds, settlement, balance invariant.

---

## Architecture summary

### Why no blockchain
The brief asks for justification *if* blockchain is used. Every "preferred characteristic"
(low energy, low cost, simple UX, easy partner onboarding) points away from it. We use a
**centralized append-only ledger** in SQLite — same auditability and immutability as a chain,
zero gas fees, zero crypto-wallet learning curve for small partners.

### The three things that matter
1. **`wallet_transactions`** is the immutable money ledger. `guest_wallets.balance_rappen`
   is a cached view of the sum. A nightly invariant check verifies they match.
2. **`redemptions.qr_token_jti UNIQUE`** is the security boundary against QR replay.
   A second scan of the same QR causes a `sqlite3.IntegrityError` and the entire transaction
   rolls back atomically.
3. **`merchant_ledger`** tracks what we owe each partner. The settlement job groups pending
   rows into per-partner batches and produces real ISO 20022 pain.001 XML.

### Money flows (Model 2: closed-loop voucher)
```
Guest  --[TWINT/card]-->  Wallet balance (CHF, in our DB)
                               |
                               | redemption (no card fee)
                               v
                         Partner is owed
                               |
                               | weekly/monthly batch
                               v
                         pain.001 XML  ->  Bank  ->  Partner IBAN
```

The card fee happens **once** at top-up, not at every redemption. That's where the partner
fee savings come from. Architecturally, no cash-out — partners settle in CHF, guests
spend within the network only — which keeps us inside the limited-network exemption and
out of FINMA payment licensing for v1.

---

## Project layout

```
jungfrau-wallet/
├── app.py              Flask routes + error handling
├── db.py               SQLite schema, connection helpers, money utilities
├── auth.py             JWT signing for QR codes + partner API-key lookup
├── services.py         Business logic: top-up, redemption transaction, refund
├── settlement.py       Batch settlement job + pain.001.001.09 XML generation
├── seed.py             Demo data: 5 partners, 10 offers, 2 guests
├── requirements.txt    Flask + PyJWT
├── tests/
│   └── test_e2e.py     End-to-end integration test (30 checks)
├── static/
│   ├── guest.html      Guest wallet UI
│   ├── partner.html    Partner scanner UI
│   └── admin.html      Destination/settlement console
└── README.md
```

---

## API reference

All money endpoints require an `Idempotency-Key` header. Partner endpoints require
`X-API-Key`. Admin endpoints require `X-Admin-Key`.

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/api/checkin` | Create guest, issue entitlements | none (booking-system) |
| GET | `/api/wallet/<id>` | Wallet balance + entitlements + tx history | none (guest) |
| POST | `/api/wallet/<id>/topup` | Initiate top-up | Idempotency-Key |
| POST | `/api/webhooks/payment` | Mock payment provider callback | (signature in prod) |
| POST | `/api/qr/generate` | Mint 60s redemption JWT | none (guest) |
| POST | `/api/redeem` | Partner scans QR, redeems | X-API-Key + Idempotency-Key |
| POST | `/api/partner/refund` | Reverse a redemption | X-API-Key + Idempotency-Key |
| GET | `/api/partner/dashboard` | Pending/batched/settled summary | X-API-Key |
| POST | `/api/admin/settlement/run` | Build batches + pain.001 | X-Admin-Key |
| POST | `/api/admin/settlement/confirm` | Mark batch confirmed by bank | X-Admin-Key |
| GET | `/api/admin/settlement/batches` | List all batches | X-Admin-Key |
| GET | `/api/admin/settlement/pain001/<batch_id>` | Download pain.001 XML | X-Admin-Key |
| POST | `/api/admin/seed` | Reset & reseed demo data | X-Admin-Key |

---

## Production swap-ins (what you'd do for a real launch)

| Demo | Production |
|---|---|
| SQLite | Postgres with proper `SERIALIZABLE` isolation |
| Mock TWINT page | Real TWINT integration via Wallee/Datatrans |
| Pain.001 written to disk | Direct submission via bank API (UBS/Raiffeisen/PostFinance bLink) |
| API-key partner auth | OIDC via partner SSO |
| Admin static key | Proper RBAC with audit log |
| Guest tied to demo guest_card_id | Real Jungfrau Region guest-card system integration |
| Public QR render via api.qrserver.com | Local QR rendering (qrcode.js) |

---

## What this earns at the hackathon

| Criterion | Weight | How this codebase earns it |
|---|---|---|
| Problem–Solution Fit | 25% | Concrete guest + partner flows that work end-to-end |
| Feasibility & Technical Architecture | 25% | Real schema, real ISO 20022 XML, real concurrency rules |
| Creativity & Innovation | 20% | Anti-blockchain stance + the closed-loop legal framing |
| User Experience & Visual Design | 15% | Clean Swiss-aesthetic guest + partner UIs |
| Business Value & Rollout Logic | 15% | ~85% transactional fee reduction (math in the spec doc) |
