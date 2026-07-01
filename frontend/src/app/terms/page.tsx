import { LegalShell, H2, CONTACT_EMAIL } from "@/components/LegalShell";

export const metadata = { title: "Terms of Service | VendorRecon", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="July 2026">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of VendorRecon
        (&quot;VendorRecon&quot;, &quot;we&quot;, &quot;us&quot;), a vendor/supplier statement
        reconciliation service. By creating an account or using the service, you agree to these Terms.
      </p>

      <H2>1. The service</H2>
      <p>
        VendorRecon lets you upload vendor statements and your accounts-payable ledger and produces a
        reconciliation that highlights matches, amount mismatches, missing invoices, duplicates, and
        unapplied credits. The service is provided on an &quot;as is&quot; and &quot;as available&quot;
        basis.
      </p>

      <H2>2. Accounts</H2>
      <p>
        You must provide accurate information and are responsible for activity under your account and for
        keeping your credentials secure. You must be authorised to upload any data you submit.
      </p>

      <H2>3. Acceptable use</H2>
      <p>
        You agree not to misuse the service, including: uploading unlawful content or data you lack rights
        to, attempting to disrupt or reverse-engineer the service, or using it to violate any law. We may
        suspend accounts that breach these Terms.
      </p>

      <H2>4. Plans, billing and payments</H2>
      <p>
        VendorRecon offers a Free plan and a paid Pro plan billed monthly. Our order process and payments
        are handled by <strong>Paddle.com</strong>, our authorised reseller and Merchant of Record. Paddle
        handles billing, invoicing, applicable taxes (VAT/sales tax), and payment-related customer service.
        Subscriptions renew automatically until cancelled. See our{" "}
        <a href="/refund" className="text-indigo-600 underline">Refund &amp; Cancellation Policy</a> and{" "}
        <a href="/pricing" className="text-indigo-600 underline">Pricing</a>.
      </p>

      <H2>5. Your data</H2>
      <p>
        You retain all rights to the data you upload. You grant us a limited licence to process it solely to
        provide the service, as described in our{" "}
        <a href="/privacy" className="text-indigo-600 underline">Privacy Policy</a>. You represent that you
        have the right and any necessary consent to upload the data you submit, including data relating to your
        own clients or other third parties. You can permanently delete your data at any time from your account
        settings. If you use VendorRecon to process personal data on behalf of your clients, our{" "}
        <a href="/dpa" className="text-indigo-600 underline">Data Processing Agreement</a> applies and forms
        part of these Terms.
      </p>

      <H2>6. Intellectual property</H2>
      <p>
        The VendorRecon software, branding, and content are owned by us and protected by applicable law. These
        Terms grant you no rights to our intellectual property beyond using the service.
      </p>

      <H2>7. Disclaimers and warranties</H2>
      <p>
        VendorRecon is a tool to assist reconciliation and does not constitute accounting, tax, or financial
        advice. To the maximum extent permitted by law, the service is provided without warranties of any kind,
        whether express or implied, including any implied warranties of merchantability, fitness for a
        particular purpose, and non-infringement. We do not warrant that the service will be uninterrupted or
        error-free, or that the results it produces will be complete or accurate. You are responsible for
        reviewing and verifying all results before relying on or acting on them.
      </p>

      <H2>8. Limitation of liability</H2>
      <p>
        To the maximum extent permitted by law, VendorRecon shall not be liable for any indirect, incidental,
        or consequential damages, or for any loss of data or profits. Our total liability for any claim shall
        not exceed the amount you paid us in the 12 months preceding the claim.
      </p>

      <H2>9. Indemnification</H2>
      <p>
        You agree to indemnify and hold VendorRecon harmless from any claims, losses, or expenses (including
        reasonable legal fees) arising from the data you upload, your use of the service, or your breach of
        these Terms, including any claim that your data infringes the rights of, or was uploaded without the
        consent of, a third party.
      </p>

      <H2>10. Termination</H2>
      <p>
        You may stop using the service and cancel at any time. We may suspend or terminate access for breach
        of these Terms. On termination you may export or delete your data.
      </p>

      <H2>11. Changes</H2>
      <p>
        We may update these Terms from time to time. Material changes will be reflected by the &quot;Last
        updated&quot; date above; continued use constitutes acceptance.
      </p>

      <H2>12. Contact</H2>
      <p>
        Questions about these Terms? Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-600 underline">{CONTACT_EMAIL}</a>.
      </p>
    </LegalShell>
  );
}
