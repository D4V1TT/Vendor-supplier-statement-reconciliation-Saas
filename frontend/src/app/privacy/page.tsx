import { LegalShell, H2, CONTACT_EMAIL } from "@/components/LegalShell";

export const metadata = { title: "Privacy Policy — VendorRecon", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="June 2026">
      <p>
        This Privacy Policy explains what information VendorRecon collects, how we use it, and the choices you
        have. We aim to collect only what we need to provide the service.
      </p>

      <H2>Information we collect</H2>
      <p>
        <strong>Account information</strong> — your name and email, handled by our authentication provider
        (Clerk) when you sign in.<br />
        <strong>Reconciliation data</strong> — the vendor statements and ledger files you upload, and the
        results generated from them.<br />
        <strong>Usage data</strong> — basic logs needed to operate and secure the service.
      </p>

      <H2>How we use it</H2>
      <p>
        We use your data solely to provide and improve the reconciliation service, to operate billing, to
        communicate with you (e.g. reconciliation-complete and exception alerts you opt into), and to keep the
        service secure. We do not sell your data.
      </p>

      <H2>Storage and security</H2>
      <p>
        Uploaded files are encrypted at rest and stored in object storage (Cloudflare R2). Data is transmitted
        over encrypted connections (HTTPS). Access is restricted to your account/company via row-level security.
      </p>

      <H2>Service providers</H2>
      <p>
        We share data with vetted processors only as needed to run the service: <strong>Clerk</strong>
        (authentication), <strong>Paddle</strong> (payments / Merchant of Record), <strong>Resend</strong>
        (transactional email), <strong>Anthropic</strong> (AI-assisted extraction, used only on the Pro plan
        for hard-to-parse files), and our hosting providers (Railway, Vercel, Cloudflare). These providers
        process data on our behalf under their own terms.
      </p>

      <H2>Data retention and deletion</H2>
      <p>
        You can delete your uploaded data and reconciliation history at any time from your account settings.
        When you delete data or close your account, we remove the associated files from storage.
      </p>

      <H2>Your rights</H2>
      <p>
        Depending on your location, you may have rights to access, correct, export, or delete your personal
        data. To exercise these, contact us at the address below.
      </p>

      <H2>Cookies</H2>
      <p>
        We use essential cookies for authentication and session management. We do not use advertising cookies.
      </p>

      <H2>Contact</H2>
      <p>
        Privacy questions or requests? Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-600 underline">{CONTACT_EMAIL}</a>.
      </p>
    </LegalShell>
  );
}
