import { LegalShell, H2, Para, GuideCTA, RelatedGuides } from "@/components/LegalShell";

const URL = "https://vendorrecon.org/guide/vendor-statement-reconciliation";

export const metadata = {
  title: "What Is Vendor Statement Reconciliation? A Complete Guide — VendorRecon",
  description:
    "The complete guide to vendor (supplier) statement reconciliation: what it is, why it matters, a step-by-step process, every exception type explained, manual vs software, best practices, and FAQs.",
  alternates: { canonical: URL },
  openGraph: {
    type: "article",
    url: URL,
    title: "What Is Vendor Statement Reconciliation? A Complete Guide",
    description: "What vendor statement reconciliation is, why it matters, how to do it step by step, and how to automate it.",
  },
};

const FAQ = [
  { q: "What is the difference between a vendor statement and an invoice?",
    a: "An invoice is a bill for a single transaction. A vendor statement is a periodic summary listing all invoices, credit notes, and payments the vendor believes are outstanding on your account over a period." },
  { q: "How often should I reconcile vendor statements?",
    a: "Most teams reconcile monthly, timed to when vendors issue statements and before the payment run. High-volume or high-value vendors may warrant more frequent checks." },
  { q: "Who is responsible for vendor statement reconciliation?",
    a: "It usually sits with the accounts-payable team or bookkeeper. In smaller businesses the owner or office manager often handles it." },
  { q: "What if the vendor statement and my ledger never match exactly?",
    a: "Small, explainable differences (timing of invoices or payments in transit) are normal. The goal is to identify and explain every difference, not to force the totals to be identical." },
  { q: "Can vendor statement reconciliation be automated?",
    a: "Yes. Software can extract both files, normalise formats, match every line by invoice ID and amount, and output only the exceptions — turning hours of manual work into seconds." },
];

const LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "TechArticle",
      headline: "What Is Vendor Statement Reconciliation? A Complete Guide",
      description: "A complete guide to vendor and supplier statement reconciliation: definition, process, exception types, best practices, and automation.",
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

export default function GuidePage() {
  return (
    <LegalShell title="What is vendor statement reconciliation? A complete guide" updated="June 2026">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LD) }} />

      <Para>{`Vendor statement reconciliation — also called supplier statement reconciliation — is the process of comparing a supplier's statement of account against your own accounts-payable (AP) ledger to confirm that both records agree. The statement is the vendor's view of what you owe; your ledger is your own record of what you have booked and paid. Reconciling the two is how finance teams catch billing errors, duplicate invoices, missing credits, and unrecorded invoices before money goes out the door.`}</Para>
      <Para>{`This guide explains exactly what reconciliation is, why it matters, the step-by-step process, every type of discrepancy you will encounter and how to resolve it, the difference between doing it in a spreadsheet versus software, and the best practices that keep your payables clean. It is written for accounts-payable clerks, bookkeepers, controllers, and business owners who want a reliable month-end process.`}</Para>

      <H2>The core idea: two records that should agree</H2>
      <Para>{`Every purchase creates two parallel records. The vendor records an invoice when they bill you and a credit note when they refund you. You record the same invoice in your AP ledger when you receive it, and you record payments when you pay. In a perfect world these two ledgers are mirror images. In reality they drift apart — an invoice gets lost in an inbox, a vendor bills the same job twice, a credit note never gets applied, or a price is keyed wrong. Reconciliation is the control that surfaces that drift.`}</Para>

      <H3>Key terms</H3>
      <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-slate-600">
        <li><strong>Statement of account</strong>{` — the vendor's periodic list of open invoices, credits, and payments.`}</li>
        <li><strong>AP ledger</strong>{` — your internal record of what you owe each supplier (often exported as an aged-payables report).`}</li>
        <li><strong>Invoice</strong>{` — a bill for goods or services, identified by an invoice number.`}</li>
        <li><strong>Credit note</strong>{` — a negative invoice that reduces what you owe (a refund, return, or adjustment).`}</li>
        <li><strong>Exception</strong>{` — any line that does not match cleanly between the two records and needs review.`}</li>
      </ul>

      <H2>Why vendor statement reconciliation matters</H2>
      <Para>{`Reconciliation is one of the highest-leverage controls in accounts payable because it protects cash on both sides of the relationship:`}</Para>
      <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-slate-600">
        <li><strong>Stops overpayment.</strong>{` Duplicate and re-issued invoices are a leading cause of paying the same bill twice. Catching them before the payment run keeps the cash in your account.`}</li>
        <li><strong>Recovers money you are owed.</strong>{` Credit notes for returns, overcharges, or rebates are easy to miss if the vendor never applies them. Reconciliation surfaces unclaimed credits.`}</li>
        <li><strong>Keeps the books accurate.</strong>{` Invoices missing from your ledger get recorded before period close, so your payables balance and expenses are right.`}</li>
        <li><strong>Prevents fraud and leakage.</strong>{` Unexpected charges, inflated amounts, and invoices for goods never received show up as exceptions.`}</li>
        <li><strong>Strengthens vendor relationships.</strong>{` When you query a vendor with a precise, line-level discrepancy report, disputes get resolved quickly and professionally.`}</li>
      </ul>
      <Para>{`Industry studies have long estimated that a small but meaningful percentage of invoices in a typical AP function contain errors, and that duplicate payments alone cost businesses a measurable fraction of total spend every year. For most teams, the recovered cash and avoided overpayments pay for the time spent reconciling many times over.`}</Para>

      <H2>What you need before you start</H2>
      <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-slate-600">
        <li>{`The vendor's statement of account for the period (PDF, Excel, or CSV — sometimes a scanned image).`}</li>
        <li>{`Your AP ledger or aged-payables export for that same vendor and period.`}</li>
        <li>{`Access to source documents (purchase orders, goods-receipt notes, payment records) to investigate anything that does not match.`}</li>
      </ul>

      <H2>The step-by-step reconciliation process</H2>
      <ol className="list-decimal pl-5 space-y-2 text-[15px] text-slate-600">
        <li><strong>Align the period.</strong>{` Make sure both documents cover the same date range. A statement dated the 30th will not include an invoice you booked on the 31st — that is a timing difference, not an error.`}</li>
        <li><strong>Normalise the data.</strong>{` Strip currency symbols and thousands separators so amounts are plain numbers, and standardise invoice numbers (leading zeros, prefixes, and spacing cause false mismatches).`}</li>
        <li><strong>Match line by line</strong>{` using the invoice number as the key. For each invoice on the statement, find the matching entry in your ledger.`}</li>
        <li><strong>Compare amounts</strong>{` on every matched invoice. Flag any difference, however small — tax and rounding errors hide in the cents.`}</li>
        <li><strong>Identify the exceptions</strong>{` in both directions: invoices on the statement but not in your ledger, and invoices in your ledger but not on the statement.`}</li>
        <li><strong>Investigate each exception.</strong>{` Check the purchase order and goods-receipt note, confirm payment status, and look for disputes, returns, or credits.`}</li>
        <li><strong>Resolve and document.</strong>{` Record missing invoices, request corrected invoices or credit notes, and write down the cause and resolution of each exception for the audit trail.`}</li>
        <li><strong>Sign off.</strong>{` Once every difference is explained, sign off the reconciliation for the period and file the working papers.`}</li>
      </ol>

      <H2>Every exception type, explained</H2>
      <Para>{`Reconciliation produces a handful of recurring exception types. Knowing what each one means tells you how to resolve it.`}</Para>

      <H3>Amount mismatch</H3>
      <Para>{`The invoice exists on both sides but the totals differ. Common causes: a price or quantity discrepancy, a tax/VAT difference, a partial credit applied on one side only, or a data-entry error. Resolve by comparing to the purchase order and the original invoice, then correcting whichever record is wrong.`}</Para>

      <H3>Missing in ledger (on the statement, not in your books)</H3>
      <Para>{`The vendor shows an invoice you have not recorded. It may be lost in an approval inbox, never received, or already disputed. If it is valid, record it before close; if it is not, query the vendor.`}</Para>

      <H3>Missing in statement (in your books, not on the statement)</H3>
      <Para>{`You have an invoice the vendor is not showing. Often this is a timing difference (you booked it after the statement date) or the vendor has applied a payment or credit you have not. Confirm and reconcile the timing.`}</Para>

      <H3>Duplicate invoice</H3>
      <Para>{`The same invoice appears twice — a frequent and expensive error. A vendor may re-send a reminder as a fresh invoice, or the same bill may be entered twice in your system. Catching duplicates before payment is the single biggest way reconciliation protects cash.`}</Para>

      <H3>Unapplied credit</H3>
      <Para>{`A credit note you are owed has not been deducted. Make sure it is applied against the right invoice so you do not overpay.`}</Para>

      <H2>Manual reconciliation vs. software</H2>
      <Para>{`Most teams still reconcile in a spreadsheet: export both sides, line them up with lookups, and highlight the differences by hand. It works for a handful of lines, but it does not scale and it is error-prone — vendor PDFs rarely match your ledger's format, columns are labelled differently on every statement, scanned statements have to be re-typed, and one mis-paste throws off the totals with no audit trail.`}</Para>
      <Para>{`Reconciliation software removes the manual matching. It extracts and normalises both files, matches every line by invoice ID and amount (tolerating OCR and formatting quirks), and returns only the exceptions — turning an afternoon of work into a few seconds, with a consistent, repeatable, auditable result.`}</Para>

      <H2>Best practices</H2>
      <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-slate-600">
        <li>{`Reconcile every statement you receive, not just the big vendors — small vendors hide errors too.`}</li>
        <li>{`Always reconcile before the payment run, so duplicates and overcharges never get paid.`}</li>
        <li>{`Keep a written record of each exception and its resolution for audit and dispute history.`}</li>
        <li>{`Enforce unique invoice numbers per vendor in your AP system to make duplicates easy to catch.`}</li>
        <li>{`Standardise how you store invoice numbers and amounts so matching is reliable.`}</li>
      </ul>

      <H2>How VendorRecon automates it</H2>
      <Para>{`VendorRecon is purpose-built for vendor statement reconciliation. Upload the vendor's statement and your AP ledger in any common format (PDF, including scanned statements via OCR, plus Excel and CSV), and it returns an exceptions dashboard in seconds — amount mismatches, missing invoices, duplicates, and unapplied credits — ready to export to Excel and send back to the vendor. No formulas, no highlighter, no re-typing.`}</Para>
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
        { href: "/guide/reconcile-vendor-statement-in-excel", label: "How to reconcile a vendor statement in Excel" },
        { href: "/guide/supplier-statement-reconciliation-checklist", label: "Supplier statement reconciliation checklist" },
        { href: "/guide/duplicate-invoice-detection", label: "How to catch duplicate invoices (and stop double payments)" },
      ]} />
    </LegalShell>
  );
}
