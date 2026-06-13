import { LegalShell, H2, Para, GuideCTA, RelatedGuides } from "@/components/LegalShell";

const URL = "https://vendorrecon.org/guide/duplicate-invoice-detection";

export const metadata = {
  title: "How to Catch Duplicate Invoices (and Stop Double Payments) — VendorRecon",
  description:
    "Duplicate invoices are a top cause of overpayment in accounts payable. Learn why they happen, how to detect exact and fuzzy duplicates, and how to prevent double payments.",
  alternates: { canonical: URL },
  openGraph: { type: "article", url: URL, title: "How to Catch Duplicate Invoices (and Stop Double Payments)" },
};

const LD = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "How to Catch Duplicate Invoices (and Stop Double Payments)",
  description: "Why duplicate invoices happen, how to detect exact and fuzzy duplicates, and how to prevent double payments in accounts payable.",
  datePublished: "2026-06-08",
  dateModified: "2026-06-08",
  author: { "@type": "Organization", name: "VendorRecon", url: "https://vendorrecon.org" },
  publisher: { "@type": "Organization", name: "VendorRecon", logo: { "@type": "ImageObject", url: "https://vendorrecon.org/icon" } },
  mainEntityOfPage: URL,
};

const Code = ({ children }: { children: string }) => (
  <code className="text-[13px] bg-slate-100 text-slate-800 rounded px-1.5 py-0.5">{children}</code>
);

export default function Page() {
  return (
    <LegalShell title="How to catch duplicate invoices (and stop double payments)" updated="June 2026">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LD) }} />

      <Para>{`Duplicate invoices are one of the most expensive errors in accounts payable: pay the same invoice twice and the cash is gone until you notice and claw it back. Here is why they happen and how to catch them before payment.`}</Para>

      <H2>Why duplicate invoices happen</H2>
      <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-slate-600">
        <li>A supplier issues the same invoice twice — for example, a reminder re-sent as a fresh invoice.</li>
        <li>An invoice is entered into your system more than once by different people.</li>
        <li>The same charge appears under a slightly different invoice number or date.</li>
        <li>A PO copy and a non-PO copy of the same invoice both get booked.</li>
      </ul>

      <H2>How to detect duplicates</H2>
      <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-slate-600">
        <li><strong>Exact match</strong> — the same invoice number for the same supplier appears more than once.</li>
        <li><strong>Fuzzy match</strong> — the same amount, date, and supplier with a slightly different invoice number.</li>
        <li><strong>Across statement and ledger</strong> — one statement line matches two ledger entries (or vice versa).</li>
      </ul>
      <Para>{`In Excel, `}<Code>{`=COUNTIF(A:A, A2)`}</Code>{` on the invoice-number column flags exact duplicates — but it misses fuzzy ones and cannot compare the statement and ledger at the same time.`}</Para>

      <H2>How to prevent double payments</H2>
      <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-slate-600">
        <li>Enforce unique invoice numbers per supplier in your AP system.</li>
        <li>Reconcile the supplier statement before you run the payment batch.</li>
        <li>Review credit notes so a re-issued invoice is matched to its original.</li>
      </ul>

      <H2>How VendorRecon helps</H2>
      <Para>{`VendorRecon checks for duplicates automatically during reconciliation — both exact and fuzzy — and flags them in the exceptions dashboard before you pay, alongside amount mismatches, missing invoices, and unapplied credits.`}</Para>

      <GuideCTA />
      <RelatedGuides links={[
        { href: "/guide/vendor-statement-reconciliation", label: "What is vendor statement reconciliation? A complete guide" },
        { href: "/guide/reconcile-vendor-statement-in-excel", label: "How to reconcile a vendor statement in Excel" },
        { href: "/guide/supplier-statement-reconciliation-checklist", label: "Supplier statement reconciliation checklist" },
      ]} />
    </LegalShell>
  );
}
