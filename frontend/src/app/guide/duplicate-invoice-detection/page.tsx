import { LegalShell, H2, Para, GuideCTA, RelatedGuides } from "@/components/LegalShell";

const URL = "https://vendorrecon.org/guide/duplicate-invoice-detection";

export const metadata = {
  title: "How to Catch Duplicate Invoices (and Stop Double Payments) — VendorRecon",
  description:
    "Duplicate invoices are a top cause of overpayment in accounts payable. Learn why they happen, the types of duplicates, how to detect exact and fuzzy duplicates, how to prevent double payments, and how to recover one you already paid.",
  alternates: { canonical: URL },
  openGraph: { type: "article", url: URL, title: "How to Catch Duplicate Invoices (and Stop Double Payments)" },
};

const FAQ = [
  { q: "What is a duplicate invoice?",
    a: "The same charge recorded or billed more than once — either the identical invoice number twice, or the same amount/date/vendor under a slightly different number. If it reaches payment, you pay twice." },
  { q: "How common are duplicate payments?",
    a: "Studies of accounts-payable functions consistently find duplicate payments cost businesses a measurable fraction of total spend each year — small per-invoice, but large in aggregate and slow to recover." },
  { q: "How do I detect duplicate invoices?",
    a: "Match on the invoice number for exact duplicates, and on amount + date + vendor for fuzzy ones. Reconciling the supplier statement against your ledger surfaces both, plus duplicates that span the two records." },
  { q: "How do I get money back for a duplicate I already paid?",
    a: "Contact the vendor with evidence (both invoice copies and the two payment records) and request a refund or a credit note applied to a future invoice." },
];

const LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "TechArticle",
      headline: "How to Catch Duplicate Invoices (and Stop Double Payments)",
      description: "Why duplicate invoices happen, the types, how to detect exact and fuzzy duplicates, how to prevent double payments, and how to recover one already paid.",
      datePublished: "2026-06-08",
      dateModified: "2026-06-15",
      author: { "@type": "Organization", name: "VendorRecon", url: "https://vendorrecon.org" },
      publisher: { "@type": "Organization", name: "VendorRecon", logo: { "@type": "ImageObject", url: "https://vendorrecon.org/icon" } },
      mainEntityOfPage: URL,
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ],
};

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-bold text-slate-800 pt-3">{children}</h3>;
}
const Code = ({ children }: { children: string }) => (
  <code className="text-[13px] bg-slate-100 text-slate-800 rounded px-1.5 py-0.5">{children}</code>
);

export default function Page() {
  return (
    <LegalShell title="How to catch duplicate invoices (and stop double payments)" updated="June 2026">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LD) }} />

      <Para>{`Duplicate invoices are one of the most expensive and avoidable errors in accounts payable. Pay the same bill twice and the cash is gone until someone notices and claws it back — which can take months, if it happens at all. This guide explains why duplicates happen, the different forms they take, how to detect each kind, how to stop them reaching payment, and how to recover a duplicate you have already paid.`}</Para>

      <H2>Why duplicate invoices happen</H2>
      <Para>{`Duplicates rarely come from one cause. The common sources are:`}</Para>
      <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-slate-600">
        <li><strong>Vendor re-sends.</strong>{` A supplier emails a reminder or a second copy, and it gets booked as a new invoice.`}</li>
        <li><strong>Double entry.</strong>{` Two people (or a person and an automated import) enter the same invoice into your system.`}</li>
        <li><strong>Slightly different identifiers.</strong>{` The same charge appears under a different invoice number, a different date, or with an added prefix — so it does not look like a duplicate.`}</li>
        <li><strong>PO and non-PO copies.</strong>{` A purchase-order copy and a non-PO copy of the same invoice both get recorded.`}</li>
        <li><strong>Channel duplication.</strong>{` The same invoice arrives by email and by post, or via two systems, and both are processed.`}</li>
      </ul>

      <H2>The three types of duplicates</H2>
      <H3>1. Exact duplicates</H3>
      <Para>{`The same invoice number for the same vendor appears more than once. These are the easiest to catch — a simple count of invoice numbers finds them.`}</Para>
      <H3>2. Fuzzy duplicates</H3>
      <Para>{`The same charge under a slightly different invoice number, date, or formatting. Same vendor, same amount, near-same date — but the identifiers do not match exactly, so a naive check misses them. These are where most real money leaks.`}</Para>
      <H3>3. Cross-record duplicates</H3>
      <Para>{`The duplicate spans your ledger and the vendor statement — for example, one statement line matches two entries in your books. You only see these by comparing the two records side by side, which is exactly what reconciliation does.`}</Para>

      <H2>How to detect duplicates</H2>
      <H3>In Excel</H3>
      <Para>{`For exact duplicates, add a column with `}<Code>{`=COUNTIF(A:A, A2)`}</Code>{` on the invoice-number column — any result greater than 1 is a repeat. To catch some fuzzy duplicates, build a helper key by concatenating vendor, amount, and date and run COUNTIF on that. The limitation: Excel cannot easily compare across the statement and the ledger at the same time, and concatenation keys are brittle.`}</Para>
      <H3>By reconciling the statement</H3>
      <Para>{`Reconciling the supplier statement against your ledger is the most reliable manual method: it lines up every invoice across both records, so a charge recorded twice — or billed twice — surfaces as an exception. This catches exact, fuzzy, and cross-record duplicates in one pass.`}</Para>
      <H3>With software</H3>
      <Para>{`Dedicated reconciliation software checks for both exact and fuzzy duplicates automatically, tolerating the formatting and OCR quirks that hide them, and flags them before payment.`}</Para>

      <H2>How to prevent double payments</H2>
      <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-slate-600">
        <li><strong>Enforce unique invoice numbers per vendor</strong>{` in your AP system, so a re-entry is rejected at the door.`}</li>
        <li><strong>Reconcile before every payment run,</strong>{` so duplicates are caught while the cash is still yours.`}</li>
        <li><strong>Standardise intake.</strong>{` Route all invoices through one channel and one inbox to avoid email-plus-post duplication.`}</li>
        <li><strong>Match credits to originals.</strong>{` When a vendor re-issues an invoice, tie it to the original so you do not book both.`}</li>
        <li><strong>Separate entry and approval,</strong>{` so a second pair of eyes can catch a repeat before it is paid.`}</li>
      </ul>

      <H2>What to do if you already paid a duplicate</H2>
      <Para>{`If a duplicate slipped through, act quickly — recovery gets harder with time:`}</Para>
      <ol className="list-decimal pl-5 space-y-1.5 text-[15px] text-slate-600">
        <li>{`Gather the evidence: both invoice copies and the two payment records.`}</li>
        <li>{`Contact the vendor and request a refund, or a credit note applied to your next invoice.`}</li>
        <li>{`Record the credit when it is issued, and confirm it is applied so you do not lose track of it.`}</li>
        <li>{`Add a control (unique-number enforcement or pre-payment reconciliation) so the same gap does not recur.`}</li>
      </ol>

      <H2>How VendorRecon helps</H2>
      <Para>{`VendorRecon checks for duplicates automatically during reconciliation — both exact and fuzzy — and flags them in the exceptions dashboard before you pay, alongside amount mismatches, missing invoices, and unapplied credits. Because it compares the vendor statement and your ledger together, it also catches the cross-record duplicates that single-file checks miss.`}</Para>
      <GuideCTA />

      <H2>Frequently asked questions</H2>
      <dl className="space-y-4">
        {FAQ.map((f) => (
          <div key={f.q}>
            <dt className="font-bold text-slate-900">{f.q}</dt>
            <dd className="mt-1 text-[15px] text-slate-600 leading-7">{f.a}</dd>
          </div>
        ))}
      </dl>

      <RelatedGuides links={[
        { href: "/guide/vendor-statement-reconciliation", label: "What is vendor statement reconciliation? A complete guide" },
        { href: "/guide/reconcile-vendor-statement-in-excel", label: "How to reconcile a vendor statement in Excel" },
        { href: "/guide/supplier-statement-reconciliation-checklist", label: "Supplier statement reconciliation checklist" },
      ]} />
    </LegalShell>
  );
}
