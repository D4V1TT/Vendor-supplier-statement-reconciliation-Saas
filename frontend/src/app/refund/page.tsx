import { LegalShell, H2, CONTACT_EMAIL } from "@/components/LegalShell";

export const metadata = { title: "Refund & Cancellation Policy — VendorRecon" };

export default function RefundPage() {
  return (
    <LegalShell title="Refund & Cancellation Policy" updated="June 2026">
      <p>
        We want you to be satisfied with VendorRecon. This policy explains our refund and cancellation terms
        for the Pro subscription.
      </p>

      <H2>14-day money-back guarantee</H2>
      <p>
        If you are not happy with the Pro plan, you can request a full refund within{" "}
        <strong>14 days</strong> of your payment. Just email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-600 underline">{CONTACT_EMAIL}</a> from your
        account email and we will process the refund.
      </p>

      <H2>Cancellation</H2>
      <p>
        You can cancel your subscription at any time from the billing portal in your account settings. When you
        cancel, your plan stays active until the end of the current paid period and is not renewed afterward.
      </p>

      <H2>How refunds are processed</H2>
      <p>
        Payments and refunds are handled by <strong>Paddle.com</strong>, our authorised reseller and Merchant
        of Record. Approved refunds are returned to your original payment method via Paddle, typically within
        5–10 business days depending on your bank or card issuer.
      </p>

      <H2>Renewals</H2>
      <p>
        Subscriptions renew automatically each month until cancelled. We recommend cancelling before your
        renewal date if you do not wish to be charged for the next period.
      </p>

      <H2>Contact</H2>
      <p>
        For any billing or refund question, contact{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-600 underline">{CONTACT_EMAIL}</a>.
      </p>
    </LegalShell>
  );
}
