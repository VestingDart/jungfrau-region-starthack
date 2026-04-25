# Jungfrau Region — Digital Guest Wallet

A digital wallet platform for hotel guests in the Jungfrau Region. Combines a Next.js frontend with a Flask backend to manage guest passes, bundled perks, wallet top-ups, and partner payouts via ISO 20022 payment files.

---

## What it does

- Guest wallet with prepaid balance and QR-based payments at partner venues
- Bundled perks included with every booking — activated with a single tap
- Top up wallet balance via a simulated TWINT payment flow
- Partners scan guest QR codes to redeem entitlements or charge the wallet
- Partners create new offers that require admin approval before going live
- Admin console to manage partners, approve offers, run settlements, and generate ISO 20022 pain.001 XML files
- Full demo mode with seeded guests, partners, and offers out of the box

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript |
| Backend | Python, Flask 3, SQLite |
| Auth | JWT (QR tokens), localStorage (session) |
| Payments | ISO 20022 pain.001.001.09 |

---

## Project Structure

```
Jungfrau Region Starthack/
├── frontend/
│   ├── app/
│   │   ├── admin/page.tsx        # Admin console
│   │   ├── guest/page.tsx        # Guest wallet
│   │   ├── partner/page.tsx      # Partner console
│   │   ├── login/page.tsx        # Login page
│   │   ├── register/page.tsx     # Guest registration
│   │   └── globals.css           # Design tokens & shared styles
│   ├── lib/
│   │   ├── auth.ts               # Session management & localStorage auth
│   │   └── seedData.ts           # Demo credentials & seed data
│   └── next.config.ts            # API proxy to Flask (localhost:5000)
└── jungfrau-wallet/
    ├── app.py                    # Flask routes
    ├── db.py                     # SQLite schema & connection helpers
    ├── services.py               # Business logic (topup, redeem, refund)
    ├── settlement.py             # ISO 20022 settlement & pain.001 generation
    ├── auth.py                   # QR token minting & verification (JWT)
    ├── seed.py                   # Database seeding script
    └── wallet.db                 # SQLite database (auto-created)
```

---

## Requirements

- Node.js 18+
- Python 3.10+
- pip

---

## Setup & Start

### 1 — Backend

```bash
cd jungfrau-wallet
pip install -r requirements.txt
python seed.py
python app.py
```

Backend runs at `http://localhost:5000`.

> Run `python seed.py` again at any time to reset all demo data.

### 2 — Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`.

---

## Demo Logins

### Guests

| Name | Username | Password |
|---|---|---|
| Anna Müller | `anna_tokyo` | `welcome1` |
| James Chen | `james_ldn` | `welcome2` |
| Marie Dubois | `marie_paris` | `welcome3` |
| Lucas Weber | `lucas_berlin` | `welcome4` |
| Yuki Tanaka | `yuki_osaka` | `welcome5` |

### Partners

| Partner | Username | Password |
|---|---|---|
| Harder Kulm Mountain Railway | `harderkulm` | `partner123` |
| Lake Thun Cruise | `thuncruise` | `partner456` |
| BOB Railway | `bobrailway` | `partner789` |

### Admin

| Username | Password |
|---|---|
| `admin` | `admin123` |

---

## Backend API

### Guest

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/checkin` | Check in a guest by card ID |
| `GET` | `/api/wallet/:guestId` | Get balance, entitlements, and offers |
| `POST` | `/api/wallet/:guestId/topup` | Initiate a wallet top-up |
| `POST` | `/api/qr/generate` | Generate a QR token for a perk or payment |

### Partner

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/redeem` | Redeem a scanned QR token |
| `GET` | `/api/partner/dashboard` | Pending, batched, and settled earnings |
| `GET` | `/api/partner/offers` | List own offers |
| `POST` | `/api/partner/offers` | Submit a new offer (starts as pending) |
| `DELETE` | `/api/partner/offers/:offerId` | Deactivate an offer |
| `POST` | `/api/partner/refund` | Reverse a redemption |

### Admin

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/offers/pending` | List offers awaiting approval |
| `POST` | `/api/admin/offers/:offerId/approve` | Approve a pending offer |
| `POST` | `/api/admin/offers/:offerId/reject` | Reject a pending offer |
| `POST` | `/api/admin/settlement/run` | Run settlement and generate pain.001 |
| `GET` | `/api/admin/settlement/batches` | List settlement batches |
| `POST` | `/api/admin/settlement/confirm` | Mark a batch as paid |
| `POST` | `/api/admin/seed` | Wipe and reseed the database |

---

## Notes

- The frontend manages sessions via localStorage — no server-side auth needed for the demo
- QR tokens expire after 60 seconds and are single-use (replay-protected via JWT `jti`)
- The wallet top-up popup communicates back to the parent window via `postMessage` so the balance updates instantly on confirmation
- pain.001 files are saved to `jungfrau-wallet/pain001_files/`

---

## Team

**one more epoch** — START Hack 2026
