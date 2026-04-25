"""
Settlement: the merchant payout pipeline.

Two-phase flow:

  Phase 1 (run_settlement):
     Aggregate all 'pending' merchant_ledger rows, group by partner, create one
     settlement_batches row per partner, link the ledger rows. Generate a real
     ISO 20022 pain.001.001.09 XML file the destination's finance team uploads
     to their e-banking portal.

  Phase 2 (confirm_settlement):
     Once the bank confirms execution, mark the batch 'confirmed' and flip all
     linked merchant_ledger rows to 'settled'. Partner dashboard now shows
     "Settled CHF X on {date}, ref {bank_transaction_ref}".

The pain.001 XML produced here is the actual format Swiss banks accept in
production - that is the demo's "this is real" moment.
"""
import os
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from xml.dom import minidom

from db import (
    transaction, get_connection, new_id, utcnow_iso, rappen_to_chf,
)


# Destination organization details. Production: load from config.
INITIATOR = {
    "name": "Jungfrau Region Tourismus AG",
    "iban": "CH9300762011623852957",   # demo IBAN
    "bic": "POFICHBEXXX",               # PostFinance
}

PAIN001_DIR = os.environ.get("PAIN001_DIR", "pain001_files")


def run_settlement(period_start: str, period_end: str) -> dict:
    """
    Phase 1. Build batches for every partner with pending redemptions in window,
    generate a single pain.001 file containing all credit transfers, return the
    summary for the admin UI.

    period_start, period_end: ISO date strings (YYYY-MM-DD).
    """
    os.makedirs(PAIN001_DIR, exist_ok=True)
    batches_created = []

    with transaction() as conn:
        # Find every (partner_id, total, count) with pending ledger entries
        rows = conn.execute(
            """SELECT partner_id, SUM(amount_rappen) AS total, COUNT(*) AS n
               FROM merchant_ledger
               WHERE status = 'pending'
                 AND created_at >= ?
                 AND created_at < ?
               GROUP BY partner_id""",
            (period_start, period_end),
        ).fetchall()

        if not rows:
            return {"batches": [], "pain001_file": None, "message": "no pending redemptions"}

        for row in rows:
            partner_id = row["partner_id"]
            total = row["total"]
            count = row["n"]

            partner = dict(conn.execute(
                "SELECT * FROM partners WHERE id = ?", (partner_id,)
            ).fetchone())

            batch_id = new_id()
            payment_ref = (
                f"JFR-{datetime.now(timezone.utc).strftime('%Y%m')}-"
                f"{partner_id[:6].upper()}"
            )

            conn.execute(
                """INSERT INTO settlement_batches
                   (id, partner_id, period_start, period_end, total_rappen,
                    redemption_count, payment_reference, status, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)""",
                (batch_id, partner_id, period_start, period_end, total, count,
                 payment_ref, utcnow_iso()),
            )

            # Link merchant_ledger rows to this batch
            conn.execute(
                """UPDATE merchant_ledger
                   SET status = 'batched', batch_id = ?
                   WHERE partner_id = ? AND status = 'pending'
                     AND created_at >= ? AND created_at < ?""",
                (batch_id, partner_id, period_start, period_end),
            )

            batches_created.append({
                "batch_id": batch_id,
                "partner_id": partner_id,
                "partner_name": partner["name"],
                "partner_iban": partner["iban"],
                "partner_bic": partner["bic"],
                "total_rappen": total,
                "total_chf": rappen_to_chf(total),
                "redemption_count": count,
                "payment_reference": payment_ref,
            })

    # Generate one pain.001 file for the whole run (multiple credit transfers)
    pain_path = _generate_pain001(batches_created, period_start, period_end)

    # Write the file path back onto each batch row
    conn = get_connection()
    try:
        for b in batches_created:
            conn.execute(
                """UPDATE settlement_batches
                   SET pain001_file_path = ?, status = 'submitted', submitted_at = ?
                   WHERE id = ?""",
                (pain_path, utcnow_iso(), b["batch_id"]),
            )
    finally:
        conn.close()

    return {
        "batches": batches_created,
        "pain001_file": pain_path,
        "total_chf": sum(b["total_chf"] for b in batches_created),
        "transfer_count": len(batches_created),
        "message": f"created {len(batches_created)} batch(es), pain.001 written to {pain_path}",
    }


def confirm_settlement(batch_id: str, bank_transaction_ref: str) -> dict:
    """
    Phase 2: bank confirmed execution. Flip batch + all linked ledger rows.
    """
    with transaction() as conn:
        batch = conn.execute(
            "SELECT * FROM settlement_batches WHERE id = ?", (batch_id,)
        ).fetchone()
        if not batch:
            from services import NotFound
            raise NotFound("batch not found")
        batch = dict(batch)

        if batch["status"] not in ("submitted", "draft"):
            from services import Conflict
            raise Conflict(f"batch status is '{batch['status']}', cannot confirm")

        now = utcnow_iso()
        conn.execute(
            """UPDATE settlement_batches
               SET status = 'confirmed', bank_transaction_ref = ?, confirmed_at = ?
               WHERE id = ?""",
            (bank_transaction_ref, now, batch_id),
        )
        conn.execute(
            """UPDATE merchant_ledger
               SET status = 'settled', settled_at = ?
               WHERE batch_id = ?""",
            (now, batch_id),
        )

        return {
            "batch_id": batch_id,
            "bank_transaction_ref": bank_transaction_ref,
            "status": "confirmed",
        }


# ============================================================================
# pain.001.001.09 XML generation
# ============================================================================

PAIN001_NS = "urn:iso:std:iso:20022:tech:xsd:pain.001.001.09"


def _el(parent, tag, text=None):
    e = ET.SubElement(parent, tag)
    if text is not None:
        e.text = str(text)
    return e


def _generate_pain001(batches: list[dict], period_start: str, period_end: str) -> str:
    """
    Build one pain.001.001.09 document containing one CdtTrfTxInf per partner batch.
    Returns the file path.
    """
    ET.register_namespace("", PAIN001_NS)
    root = ET.Element(f"{{{PAIN001_NS}}}Document")
    cstmr = _el(root, f"{{{PAIN001_NS}}}CstmrCdtTrfInitn")

    # GroupHeader
    grp = _el(cstmr, f"{{{PAIN001_NS}}}GrpHdr")
    msg_id = f"JFR-RUN-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    _el(grp, f"{{{PAIN001_NS}}}MsgId", msg_id)
    _el(grp, f"{{{PAIN001_NS}}}CreDtTm", datetime.now(timezone.utc).isoformat(timespec="seconds"))
    _el(grp, f"{{{PAIN001_NS}}}NbOfTxs", str(len(batches)))
    ctrl_sum_chf = sum(b["total_chf"] for b in batches)
    _el(grp, f"{{{PAIN001_NS}}}CtrlSum", f"{ctrl_sum_chf:.2f}")
    initg = _el(grp, f"{{{PAIN001_NS}}}InitgPty")
    _el(initg, f"{{{PAIN001_NS}}}Nm", INITIATOR["name"])

    # PaymentInfo (one block, multiple transactions inside)
    pmt = _el(cstmr, f"{{{PAIN001_NS}}}PmtInf")
    _el(pmt, f"{{{PAIN001_NS}}}PmtInfId", f"JFR-PMT-{datetime.now(timezone.utc).strftime('%Y%m%d')}")
    _el(pmt, f"{{{PAIN001_NS}}}PmtMtd", "TRF")
    _el(pmt, f"{{{PAIN001_NS}}}NbOfTxs", str(len(batches)))
    _el(pmt, f"{{{PAIN001_NS}}}CtrlSum", f"{ctrl_sum_chf:.2f}")
    pti = _el(pmt, f"{{{PAIN001_NS}}}PmtTpInf")
    svc = _el(pti, f"{{{PAIN001_NS}}}SvcLvl")
    _el(svc, f"{{{PAIN001_NS}}}Cd", "SEPA")
    reqd = _el(pmt, f"{{{PAIN001_NS}}}ReqdExctnDt")
    _el(reqd, f"{{{PAIN001_NS}}}Dt", datetime.now(timezone.utc).date().isoformat())
    dbtr = _el(pmt, f"{{{PAIN001_NS}}}Dbtr")
    _el(dbtr, f"{{{PAIN001_NS}}}Nm", INITIATOR["name"])
    dbtr_acct = _el(pmt, f"{{{PAIN001_NS}}}DbtrAcct")
    dbtr_id = _el(dbtr_acct, f"{{{PAIN001_NS}}}Id")
    _el(dbtr_id, f"{{{PAIN001_NS}}}IBAN", INITIATOR["iban"])
    dbtr_agt = _el(pmt, f"{{{PAIN001_NS}}}DbtrAgt")
    fin = _el(dbtr_agt, f"{{{PAIN001_NS}}}FinInstnId")
    _el(fin, f"{{{PAIN001_NS}}}BICFI", INITIATOR["bic"])

    # One CreditTransfer per batch
    for b in batches:
        ctti = _el(pmt, f"{{{PAIN001_NS}}}CdtTrfTxInf")
        pmt_id = _el(ctti, f"{{{PAIN001_NS}}}PmtId")
        _el(pmt_id, f"{{{PAIN001_NS}}}EndToEndId", b["payment_reference"])
        amt = _el(ctti, f"{{{PAIN001_NS}}}Amt")
        instd = _el(amt, f"{{{PAIN001_NS}}}InstdAmt", f"{b['total_chf']:.2f}")
        instd.set("Ccy", "CHF")
        cdtr_agt = _el(ctti, f"{{{PAIN001_NS}}}CdtrAgt")
        cfin = _el(cdtr_agt, f"{{{PAIN001_NS}}}FinInstnId")
        _el(cfin, f"{{{PAIN001_NS}}}BICFI", b["partner_bic"])
        cdtr = _el(ctti, f"{{{PAIN001_NS}}}Cdtr")
        _el(cdtr, f"{{{PAIN001_NS}}}Nm", b["partner_name"])
        cdtr_acct = _el(ctti, f"{{{PAIN001_NS}}}CdtrAcct")
        cid = _el(cdtr_acct, f"{{{PAIN001_NS}}}Id")
        _el(cid, f"{{{PAIN001_NS}}}IBAN", b["partner_iban"])
        rmt = _el(ctti, f"{{{PAIN001_NS}}}RmtInf")
        _el(rmt, f"{{{PAIN001_NS}}}Ustrd",
            f"JFR redemptions {period_start} to {period_end}, "
            f"{b['redemption_count']} txn(s), ref {b['payment_reference']}")

    # Pretty-print and write
    raw = ET.tostring(root, encoding="utf-8")
    pretty = minidom.parseString(raw).toprettyxml(indent="  ", encoding="utf-8")

    fname = f"pain001-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.xml"
    path = os.path.join(PAIN001_DIR, fname)
    with open(path, "wb") as f:
        f.write(pretty)
    return path


def get_partner_dashboard(partner_id: str) -> dict:
    """Numbers for the partner dashboard UI."""
    conn = get_connection()
    try:
        partner = conn.execute("SELECT * FROM partners WHERE id = ?", (partner_id,)).fetchone()
        if not partner:
            from services import NotFound
            raise NotFound("partner not found")

        pending = conn.execute(
            """SELECT COALESCE(SUM(amount_rappen),0) AS s, COUNT(*) AS n
               FROM merchant_ledger WHERE partner_id = ? AND status = 'pending'""",
            (partner_id,),
        ).fetchone()
        batched = conn.execute(
            """SELECT COALESCE(SUM(amount_rappen),0) AS s, COUNT(*) AS n
               FROM merchant_ledger WHERE partner_id = ? AND status = 'batched'""",
            (partner_id,),
        ).fetchone()
        settled = conn.execute(
            """SELECT COALESCE(SUM(amount_rappen),0) AS s, COUNT(*) AS n
               FROM merchant_ledger WHERE partner_id = ? AND status = 'settled'""",
            (partner_id,),
        ).fetchone()

        recent_redemptions = conn.execute(
            """SELECT r.*, o.title AS offer_title, ml.status AS settlement_status
               FROM redemptions r
               JOIN offers o ON o.id = r.offer_id
               LEFT JOIN merchant_ledger ml ON ml.redemption_id = r.id
               WHERE r.partner_id = ?
               ORDER BY r.created_at DESC LIMIT 50""",
            (partner_id,),
        ).fetchall()

        batches = conn.execute(
            """SELECT * FROM settlement_batches
               WHERE partner_id = ? ORDER BY created_at DESC LIMIT 12""",
            (partner_id,),
        ).fetchall()

        return {
            "partner": dict(partner),
            "pending_chf": rappen_to_chf(pending["s"]),
            "pending_count": pending["n"],
            "batched_chf": rappen_to_chf(batched["s"]),
            "batched_count": batched["n"],
            "settled_chf": rappen_to_chf(settled["s"]),
            "settled_count": settled["n"],
            "recent_redemptions": [dict(r) for r in recent_redemptions],
            "batches": [dict(b) for b in batches],
        }
    finally:
        conn.close()
