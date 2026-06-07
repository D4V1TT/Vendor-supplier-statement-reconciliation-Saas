"""
Send a test email through the app's real SMTP path.

Use this after verifying your sending domain in Resend to confirm that
delivery works to *any* recipient (not just your own inbox).

Run from the backend/ directory:

    python scripts/test_email.py someone@example.com

Or inside the container:

    docker compose exec api python scripts/test_email.py someone@example.com

It reads SMTP_* from your environment / .env exactly like the live app does,
so a success here means production email is correctly configured.
"""

import sys
from pathlib import Path

# Allow running as a loose script (python scripts/test_email.py) by making the
# backend/ package root importable.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import get_settings  # noqa: E402
from app.core.email import send_email  # noqa: E402


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python scripts/test_email.py <recipient@example.com>")
        return 2

    to = sys.argv[1]
    s = get_settings()

    print("── Email config in effect ──────────────────────────────")
    print(f"  SMTP_HOST : {s.SMTP_HOST or '(blank — DEV MODE, will only log)'}")
    print(f"  SMTP_PORT : {s.SMTP_PORT}")
    print(f"  SMTP_USER : {s.SMTP_USER}")
    print(f"  SMTP_FROM : {s.SMTP_FROM}")
    print(f"  USE_TLS   : {s.SMTP_USE_TLS}")
    print(f"  -> sending to: {to}")
    print("────────────────────────────────────────────────────────")

    if "resend.dev" in s.SMTP_FROM:
        print("WARNING: SMTP_FROM still uses the resend.dev sandbox domain.")
        print("         Resend will only deliver to YOUR own verified address.")
        print("         Switch SMTP_FROM to an address @your-verified-domain.\n")

    ok = send_email(
        to=to,
        subject="VendorRecon test email ✅",
        html_body=(
            "<div style='font-family:Inter,Arial,sans-serif;color:#1e293b'>"
            "<h2 style='color:#4f46e5'>It works 🎉</h2>"
            "<p>If you're reading this, VendorRecon can send email to real "
            "recipients from your verified domain.</p>"
            "<p style='color:#94a3b8;font-size:12px'>VendorRecon · "
            "AP Statement Reconciliation</p></div>"
        ),
        text_body="It works. VendorRecon can send email to real recipients.",
    )

    if ok and s.SMTP_HOST:
        print("\n✅ send_email() reported success. Check the inbox (and spam).")
        print("   Confirm delivery in Resend → Emails (logs).")
        return 0
    if ok and not s.SMTP_HOST:
        print("\nℹ️  DEV MODE: SMTP_HOST is blank, so nothing was actually sent.")
        return 0
    print("\n❌ send_email() failed — see the logged SMTP error above.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
