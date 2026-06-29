import { LegalShell, H2, Para, GuideCTA, RelatedGuides } from "@/components/LegalShell";

const URL = "https://vendorrecon.org/guide/supplier-statement-reconciliation-checklist";

export const metadata = {
  title: "Supplier Statement Reconciliation Checklist (Step-by-Step) | VendorRecon",
  description:
    "A complete supplier statement reconciliation checklist for accounts payable: preparation, matching, the exceptions to investigate, resolving and closing, common mistakes, a monthly cadence, and FAQs.",
  alternates: { canonical: URL },
  openGraph: { type: "article", url: URL, title: "Supplier Statement Reconciliation Checklist" },
};

const FAQ = [
  { q: "How often should the checklist be run?",
    a: "Most teams run it monthly, aligned to when suppliers issue statements and just before the payment run. High-volume or high-risk vendors may be reconciled more frequently." },
  { q: "Who should own the reconciliation checklist?",
    a: "Typically an accounts-payable clerk or bookkeeper performs it, with a controller or owner reviewing exceptions and signing off." },
  { q: "What is the most important step?",
    a: "Reconciling before the payment run. Catching duplicates and overcharges after you have already paid turns a quick fix into a slow recovery." },
  { q: "Do I need to reconcile every supplier?",
    a: "Ideally yes, small suppliers hide errors too. At minimum, reconcile every supplier that sends a statement and all high-spend accounts each period." },
];

const LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "TechArticle",
      headline: "Supplier Statement Reconciliation Checklist",
      description: "A step-by-step checklist for reconciling a supplier statement against your accounts-payable ledger, with context, cadence, and common mistakes.",
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
const Item = ({ children }: { children: React.ReactNode }) => (
  <li className="flex gap-2">
    <svg className="w-4 h-4 mt-1 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
    <span>{children}</span>
  </li>
);

export default function Page() {
  return (
    <LegalShell title="Supplier statement reconciliation checklist" updated="June 2026">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LD) }} />

      <Para>{`A repeatable checklist is what turns supplier statement reconciliation from an ad-hoc scramble into a reliable control. It keeps the process consistent across people and periods, makes hand-offs easy, and ensures nothing slips through before you pay. Use the checklist below each time you reconcile a supplier statement against your accounts-payable ledger, every item includes the why, not just the what.`}</Para>

      <H2>How to use this checklist</H2>
      <Para>{`Work top to bottom for each supplier, once per statement period. Treat it as a gate: do not release a supplier's payment until its reconciliation is complete and every exception is explained. Keep the completed checklist and working papers on file for audit and dispute history.`}</Para>

      <H2>1. Preparation</H2>
      <ul className="space-y-2 text-[15px] text-slate-600">
        <Item><strong>Confirm the period.</strong>{` Make sure the statement and your ledger cover the same date range, so timing differences are not mistaken for errors.`}</Item>
        <Item><strong>Gather both documents.</strong>{` The supplier statement (PDF, Excel, or CSV) and your AP ledger / aged-payables report for that supplier.`}</Item>
        <Item><strong>Normalise the data.</strong>{` Remove currency symbols and separators from amounts, and standardise invoice-number formats (leading zeros, prefixes, spacing).`}</Item>
        <Item><strong>Have source documents handy.</strong>{` Purchase orders, goods-receipt notes, and payment records, so you can investigate without stopping.`}</Item>
      </ul>

      <H2>2. Match the lines</H2>
      <ul className="space-y-2 text-[15px] text-slate-600">
        <Item><strong>Match by invoice number.</strong>{` Pair each statement line with the corresponding entry in your ledger using the invoice number as the key.`}</Item>
        <Item><strong>Compare amounts.</strong>{` Check the total on every matched invoice, small differences often hide tax or rounding issues.`}</Item>
        <Item><strong>Flag statement-only invoices.</strong>{` Anything on the statement but not in your ledger.`}</Item>
        <Item><strong>Flag ledger-only invoices.</strong>{` Anything in your ledger but not on the statement.`}</Item>
      </ul>

      <H2>3. Investigate the exceptions</H2>
      <Para>{`Every difference falls into one of these buckets. Work through each:`}</Para>
      <ul className="space-y-2 text-[15px] text-slate-600">
        <Item><strong>Amount mismatches.</strong>{` Price, quantity, or tax differences, compare to the PO and original invoice.`}</Item>
        <Item><strong>Duplicate invoices.</strong>{` The same invoice billed twice; the most expensive error if it reaches payment.`}</Item>
        <Item><strong>Unapplied credit notes.</strong>{` Credits you are owed that have not been deducted.`}</Item>
        <Item><strong>Invoices in dispute or on hold.</strong>{` Confirm status so they are not paid prematurely.`}</Item>
        <Item><strong>Timing differences.</strong>{` An invoice or payment in transit between the two records, explainable, not an error.`}</Item>
        <Item><strong>Unexpected or unrecognised charges.</strong>{` Anything you cannot tie to a PO or goods receipt, investigate for error or fraud.`}</Item>
      </ul>

      <H2>4. Resolve and close</H2>
      <ul className="space-y-2 text-[15px] text-slate-600">
        <Item><strong>Record missing invoices</strong>{` in your ledger before period close.`}</Item>
        <Item><strong>Request corrections.</strong>{` Ask the supplier for a corrected invoice or credit note where they are at fault.`}</Item>
        <Item><strong>Apply credits.</strong>{` Make sure owed credit notes are deducted against the right invoices.`}</Item>
        <Item><strong>Document everything.</strong>{` Note each exception and its resolution for the audit trail.`}</Item>
        <Item><strong>Sign off.</strong>{` Once every difference is explained, sign off the reconciliation and release payment.`}</Item>
      </ul>

      <H2>Common mistakes to avoid</H2>
      <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-slate-600">
        <li>{`Only reconciling big suppliers, small accounts hide errors and duplicates too.`}</li>
        <li>{`Reconciling after the payment run instead of before it.`}</li>
        <li>{`Forcing the totals to match instead of explaining each individual difference.`}</li>
        <li>{`Skipping documentation, so the same dispute is re-investigated next month.`}</li>
        <li>{`Ignoring timing differences and chasing the supplier over invoices simply in transit.`}</li>
      </ul>

      <H2>A simple monthly cadence</H2>
      <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-slate-600">
        <li><strong>Early in the month:</strong>{` collect supplier statements as they arrive.`}</li>
        <li><strong>Mid-month:</strong>{` reconcile each statement against the ledger and log exceptions.`}</li>
        <li><strong>Before the payment run:</strong>{` resolve exceptions, apply credits, and sign off.`}</li>
        <li><strong>At close:</strong>{` confirm all valid invoices are recorded and file the working papers.`}</li>
      </ul>

      <H2>Automating the checklist</H2>
      <Para>{`The matching and exception-finding steps (2 and 3) are exactly what software does best. VendorRecon takes the supplier statement and your ledger in any common format, matches every line automatically, and produces the exceptions list for you, so your team spends its time on investigation and resolution, not manual cross-referencing.`}</Para>
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
        { href: "/guide/duplicate-invoice-detection", label: "How to catch duplicate invoices (and stop double payments)" },
      ]} />
    </LegalShell>
  );
}
