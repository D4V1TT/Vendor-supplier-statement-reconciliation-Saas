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

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _resend_api_key() -> str:
    """Resend API key for HTTPS sending, if available."""
    if settings.RESEND_API_KEY:
        return settings.RESEND_API_KEY
    # The Resend SMTP password is itself a Resend API key (re_...), so reuse it.
    if "resend" in settings.SMTP_HOST.lower() and settings.SMTP_PASSWORD.startswith("re_"):
        return settings.SMTP_PASSWORD
    return ""


def _send_via_resend_api(api_key: str, to: str, subject: str,
                         html_body: str, text_body: str | None) -> bool:
    """
    Send via Resend's HTTPS API (port 443). Preferred over SMTP because many
    hosts (e.g. Railway) block outbound SMTP ports (25/465/587), making smtplib
    time out.
    """
    payload: dict = {"from": settings.SMTP_FROM, "to": [to], "subject": subject, "html": html_body}
    if text_body:
        payload["text"] = text_body
    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}"},
            json=payload,
            timeout=15,
        )
        if resp.status_code >= 400:
            logger.error("Resend API send to %s failed: %s %s", to, resp.status_code, resp.text)
            return False
        logger.info("Email sent to %s: %s (Resend API)", to, subject)
        return True
    except Exception as exc:
        logger.error("Resend API error sending to %s: %s", to, exc)
        return False


def send_email(to: str, subject: str, html_body: str, text_body: str | None = None) -> bool:
    """
    Send an HTML email. Returns True if sent (or logged in dev mode), False on error.

    Prefers Resend's HTTPS API (works where outbound SMTP ports are blocked, e.g.
    Railway); falls back to SMTP for other providers; logs without sending if
    neither is configured (dev mode).
    """
    api_key = _resend_api_key()
    if api_key:
        return _send_via_resend_api(api_key, to, subject, html_body, text_body)

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
    report_url = f"{settings.APP_BASE_URL.rstrip('/')}/dashboard?job={job_id}"
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
      <a href="{report_url}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:600">View full report</a>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">VendorRecon · AP Statement Reconciliation</p>
    </div>
    """
    return subject, html


def weekly_digest_email(company_name: str, stats: dict) -> tuple[str, str]:
    """Returns (subject, html) for the weekly digest of the last 7 days."""
    history_url = f"{settings.APP_BASE_URL.rstrip('/')}/history"
    subject = f"📊 Your weekly reconciliation digest — {company_name}"
    html = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1e293b">
      <h2 style="color:#4f46e5;margin-bottom:4px">Weekly digest</h2>
      <p style="color:#64748b;margin-top:0">{company_name} · last 7 days</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px 0">Reconciliations run</td><td style="text-align:right"><b>{stats.get('jobs',0)}</b></td></tr>
        <tr><td style="padding:8px 0">Lines processed</td><td style="text-align:right"><b>{stats.get('lines',0)}</b></td></tr>
        <tr><td style="padding:8px 0">Total exceptions</td><td style="text-align:right;color:#ef4444"><b>{stats.get('exceptions',0)}</b></td></tr>
        <tr><td style="padding:8px 0">Net variance</td><td style="text-align:right"><b>${stats.get('variance',0):,.2f}</b></td></tr>
      </table>
      <a href="{history_url}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:600">View all reconciliations</a>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">
        VendorRecon · You're receiving this because weekly digest is on in Settings.
      </p>
    </div>
    """
    return subject, html
