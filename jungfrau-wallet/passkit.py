"""
Generate Apple Wallet (.pkpass) files for Jungfrau Region Guest Cards.

A .pkpass is a ZIP containing:
  pass.json      — pass definition
  icon.png/2x/3x — required icons
  manifest.json  — SHA-1 hashes of every bundled file
  signature      — PKCS#7 detached signature of manifest.json

For production: replace the self-signed cert with an Apple Pass Type ID
certificate from the Apple Developer Program:
  1. Register a Pass Type ID (e.g. pass.com.jungfrau.guestcard) at
     developer.apple.com/account/resources/identifiers/list/passTypeId
  2. Download the .p12 certificate
  3. Load it in _create_signature() using pkcs12.load_key_and_certificates()
"""
import datetime
import hashlib
import io
import json
import struct
import zipfile
import zlib

PASS_TYPE_ID = "pass.com.jungfrau.guestcard"
TEAM_ID = "JFREGION1"  # Replace with real Apple Team Identifier


# ---------------------------------------------------------------------------
# Minimal PNG generator (stdlib only — no Pillow required)
# ---------------------------------------------------------------------------

def _make_png(width: int, height: int, r: int, g: int, b: int) -> bytes:
    """Return a solid-color RGB PNG as bytes."""
    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        return struct.pack(">I", len(data)) + tag + data + crc

    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    row = b"\x00" + bytes([r, g, b] * width)
    idat = chunk(b"IDAT", zlib.compress(row * height, 9))
    iend = chunk(b"IEND", b"")
    return b"\x89PNG\r\n\x1a\n" + ihdr + idat + iend


# ---------------------------------------------------------------------------
# PKCS#7 signature
# ---------------------------------------------------------------------------

def _create_signature(manifest_data: bytes) -> bytes:
    """
    Sign manifest.json with a PKCS#7 detached signature.

    Uses a self-signed cert for the demo — iOS will refuse to install the pass
    because the cert is not an Apple-issued Pass Type ID certificate.
    Swap in your .p12 to make it production-ready.
    """
    try:
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives.serialization import pkcs7
        from cryptography.x509.oid import NameOID

        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COMMON_NAME, "Jungfrau Region Pass"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Jungfrau Region"),
        ])
        cert = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer)
            .public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.datetime.now(datetime.timezone.utc))
            .not_valid_after(
                datetime.datetime.now(datetime.timezone.utc)
                + datetime.timedelta(days=365)
            )
            .sign(key, hashes.SHA256())
        )
        return (
            pkcs7.PKCS7SignatureBuilder()
            .set_data(manifest_data)
            .add_signer(cert, key, hashes.SHA256())
            .sign(serialization.Encoding.DER, [pkcs7.PKCS7Options.DetachedSignature])
        )
    except (ImportError, AttributeError):
        return b""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_pkpass(
    guest_name: str,
    card_number: str,
    balance_chf: float,
    check_in: str,
    check_out: str,
    guest_id: str,
) -> bytes:
    """Return the raw bytes of a .pkpass ZIP archive."""

    def _fmt_date(iso: str) -> str:
        try:
            d = datetime.date.fromisoformat(iso)
            return f"{d.strftime('%b')} {d.day}"
        except Exception:
            return iso

    validity = f"{_fmt_date(check_in)} – {_fmt_date(check_out)}, 2026"

    pass_dict = {
        "formatVersion": 1,
        "passTypeIdentifier": PASS_TYPE_ID,
        "serialNumber": f"JFR-{guest_id[:8]}",
        "teamIdentifier": TEAM_ID,
        "organizationName": "Jungfrau Region",
        "description": "Jungfrau Region Guest Card",
        "logoText": "Jungfrau Region",
        "foregroundColor": "rgb(255, 255, 255)",
        "backgroundColor": "rgb(27, 50, 89)",
        "labelColor": "rgb(196, 149, 14)",
        "storeCard": {
            "primaryFields": [
                {
                    "key": "balance",
                    "label": "BALANCE",
                    "value": f"CHF {balance_chf:.2f}",
                }
            ],
            "secondaryFields": [
                {"key": "name", "label": "GUEST", "value": guest_name},
                {"key": "valid", "label": "VALID", "value": validity},
            ],
            "auxiliaryFields": [
                {"key": "card", "label": "CARD NUMBER", "value": card_number}
            ],
            "backFields": [
                {
                    "key": "about",
                    "label": "About Your Guest Card",
                    "value": (
                        "Your Jungfrau Region Guest Card gives you access to "
                        "exclusive perks, seamless wallet payments at partner "
                        "venues, and a curated alpine experience."
                    ),
                },
                {
                    "key": "support",
                    "label": "Support",
                    "value": "Visit the hotel reception for assistance.",
                },
            ],
        },
        "barcode": {
            "message": card_number,
            "format": "PKBarcodeFormatQR",
            "messageEncoding": "iso-8859-1",
            "altText": card_number,
        },
        "barcodes": [
            {
                "message": card_number,
                "format": "PKBarcodeFormatQR",
                "messageEncoding": "iso-8859-1",
                "altText": card_number,
            }
        ],
    }

    pass_json_bytes = json.dumps(pass_dict, indent=2).encode()

    # Navy-blue icons (27, 50, 89)
    icon_29 = _make_png(29, 29, 27, 50, 89)
    icon_58 = _make_png(58, 58, 27, 50, 89)
    icon_87 = _make_png(87, 87, 27, 50, 89)

    files: dict[str, bytes] = {
        "pass.json": pass_json_bytes,
        "icon.png": icon_29,
        "icon@2x.png": icon_58,
        "icon@3x.png": icon_87,
    }

    manifest = {name: hashlib.sha1(data).hexdigest() for name, data in files.items()}
    manifest_bytes = json.dumps(manifest, indent=2).encode()

    signature = _create_signature(manifest_bytes)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in files.items():
            zf.writestr(name, data)
        zf.writestr("manifest.json", manifest_bytes)
        zf.writestr("signature", signature)

    return buf.getvalue()
