import { LegalShell, H2, CONTACT_EMAIL } from "@/components/LegalShell";

export const metadata = { title: "Contact | VendorRecon", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  return (
    <LegalShell title="Contact us" updated="June 2026">
      <p>
        We&apos;re happy to help with anything, product questions, billing, privacy requests, or general
        feedback.
      </p>

      <H2>Email</H2>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-600 underline text-base font-semibold">
          {CONTACT_EMAIL}
        </a>
        <br />
        We aim to respond within 1–2 business days.
      </p>

      <H2>Billing &amp; payments</H2>
      <p>
        Payments are processed by Paddle.com (our Merchant of Record). For invoices, receipts, or payment
        issues you can contact us above, or reply to the receipt email Paddle sends after purchase.
      </p>

      <H2>Business details</H2>
      <p>
        VendorRecon is an independent software service. Reach us at the email above for
        any formal or legal correspondence.
      </p>
    </LegalShell>
  );
}
