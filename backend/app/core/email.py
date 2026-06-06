"""
Email sending via SMTP.

If SMTP_HOST is not configured, send_email() logs the message instead of
sending — so the app works end-to-end in dev without an email provider, and
turns into real email the moment SMTP credentials are added to .env.
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def send_email(to: str, subject: str, html_body: str, text_body: str | None = None) -> bool:
    """
    Send an HTML email. Returns True if sent (or logged in dev mode), False on error.
    """
    if not settings.SMTP_HOST:
        logger.info("[EMAIL — dev mode, not sent] to=%s | subject=%s", to, subject)
        return True  # treat as success so the flow continues

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = settings.SMTP_FROM
    msg["To"]      = to
    if text_body:
        msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        logger.info("Email sent to %s: %s", to, subject)
        return True
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to, exc)
        return False


# ── Templates ─────────────────────────────────────────────────────────────────

def reconciliation_complete_email(vendor_name: str, summary: dict, job_id: str) -> tuple[str, str]:
    """Returns (subject, html_body) for a completed reconciliation."""
    exc = summary.get("exception_count", 0)
    subject = (
        f"✅ Reconciliation complete — {vendor_name}: {exc} exception"
        f"{'s' if exc != 1 else ''} found"
    )
    html = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1e293b">
      <h2 style="color:#4f46e5;margin-bottom:4px">Reconciliation complete</h2>
      <p style="color:#64748b;margin-top:0">Vendor: <b>{vendor_name}</b></p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px 0">Total lines</td><td style="text-align:right"><b>{summary.get('total_supplier_lines',0)}</b></td></tr>
        <tr><td style="padding:8px 0">Matched</td><td style="text-align:right;color:#10b981"><b>{summary.get('count_matched',0)}</b></td></tr>
        <tr><td style="padding:8px 0">Amount mismatches</td><td style="text-align:right;color:#ef4444"><b>{summary.get('count_amount_mismatch',0)}</b></td></tr>
        <tr><td style="padding:8px 0">Missing in ledger</td><td style="text-align:right;color:#f59e0b"><b>{summary.get('count_missing_in_ledger',0)}</b></td></tr>
        <tr><td style="padding:8px 0">Unapplied credits</td><td style="text-align:right;color:#8b5cf6"><b>{summary.get('count_unapplied_credit',0)}</b></td></tr>
      </table>
      <a href="#" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:600">View full report</a>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">VendorRecon · AP Statement Reconciliation</p>
    </div>
    """
    return subject, html
