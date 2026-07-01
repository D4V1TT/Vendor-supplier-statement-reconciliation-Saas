import { LegalShell, H2, CONTACT_EMAIL } from "@/components/LegalShell";

export const metadata = { title: "Privacy Policy | VendorRecon", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="July 2026">
      <p>
        This Privacy Policy explains what information VendorRecon collects, how we use it, how we protect it,
        and the choices you have. We aim to collect only what we need to provide the service. We never sell your
        data, and we never use the financial files you upload to train AI models.
      </p>

      <H2>Information we collect</H2>
      <p>
        <strong>Account information</strong>: your name and email, handled by our authentication provider
        (Clerk) when you sign in.<br />
        <strong>Reconciliation data</strong>: the vendor statements and ledger files you upload, and the
        results generated from them.<br />
        <strong>Usage data</strong>: basic logs needed to operate, secure, and support the service.
      </p>

      <H2>How we use it</H2>
      <p>
        We use your data solely to provide and improve the reconciliation service, to operate billing, to
        communicate with you (for example, reconciliation-complete and exception alerts you opt into), and to
        keep the service secure. We do not sell your data, and we do not use your uploaded files to train any
        AI or machine-learning models.
      </p>

      <H2>Storage and security</H2>
      <p>
        Uploaded files are encrypted with AES-256 before they are written to storage, and are held in object
        storage (Cloudflare R2). Data is transmitted over encrypted connections (HTTPS/TLS). Access is
        restricted to your own account and company through row-level security, so one customer can never see
        another customer&apos;s data.
      </p>

      <H2>How your files are processed</H2>
      <p>
        Most extraction happens on our own servers: text-based PDFs and spreadsheets are parsed locally, and
        scanned documents are read with on-server OCR. For customers on the Pro plan, when a document is too
        low-quality for those methods, the document content may be sent to our AI provider (Anthropic) to
        complete extraction. Anthropic processes this data under its API terms and does not use it to train its
        models. Free-plan files are never sent to the AI provider.
      </p>

      <H2>Sub-processors</H2>
      <p>
        We share data with vetted service providers only as needed to run the service: Clerk (authentication),
        Paddle (payments and Merchant of Record), Resend (transactional email), Anthropic (AI-assisted
        extraction, Pro plan only), Cloudflare (encrypted file storage), and our hosting providers (Railway and
        Vercel). Each processes data on our behalf under its own terms. The current list is on our{" "}
        <a href="/subprocessors" className="text-indigo-600 underline">Sub-processors</a> page.
      </p>

      <H2>Data retention and deletion</H2>
      <p>
        We keep your uploaded files and reconciliation results until you delete them or ask us to close your
        account. You can permanently delete all of your files and history at any time from your account
        settings, which also removes the encrypted files from storage. To close your account or request
        deletion by us, email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-600 underline">{CONTACT_EMAIL}</a>.
      </p>

      <H2>International data transfers</H2>
      <p>
        We and our sub-processors may process data in the United States and other countries. Where required, we
        rely on appropriate safeguards (such as the European Commission&apos;s Standard Contractual Clauses) for
        those transfers.
      </p>

      <H2>Data Processing Agreement</H2>
      <p>
        If you are a business using VendorRecon to process personal data on behalf of your own clients, a Data
        Processing Agreement is available. See our{" "}
        <a href="/dpa" className="text-indigo-600 underline">Data Processing Agreement</a>, or email us to
        request a signed copy.
      </p>

      <H2>Your rights</H2>
      <p>
        Depending on your location, you may have rights to access, correct, export, or delete your personal
        data. To exercise these, contact us at the address below and we will respond within a reasonable time.
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
