import { LegalShell, H2, RelatedGuides } from "@/components/LegalShell";

export const metadata = {
  title: "What Is Vendor Statement Reconciliation? A Complete Guide — VendorRecon",
  description:
    "A complete guide to vendor (supplier) statement reconciliation: what it is, why it matters, how to reconcile a vendor statement step by step, the discrepancies to catch, and how to automate it.",
  alternates: { canonical: "https://vendorrecon.org/guide/vendor-statement-reconciliation" },
  openGraph: {
    type: "article",
    url: "https://vendorrecon.org/guide/vendor-statement-reconciliation",
    title: "What Is Vendor Statement Reconciliation? A Complete Guide",
    description:
      "What vendor statement reconciliation is, why it matters, how to do it step by step, and how to automate it.",
  },
};

const ARTICLE_LD = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "What Is Vendor Statement Reconciliation? A Complete Guide",
  description:
    "A complete guide to vendor and supplier statement reconciliation: definition, process, common discrepancies, and automation.",
  datePublished: "2026-06-08",
  dateModified: "2026-06-08",
  author: { "@type": "Organization", name: "VendorRecon", url: "https://vendorrecon.org" },
  publisher: {
    "@type": "Organization",
    name: "VendorRecon",
    logo: { "@type": "ImageObject", url: "https://vendorrecon.org/icon" },
  },
  mainEntityOfPage: "https://vendorrecon.org/guide/vendor-statement-reconciliation",
};

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-7 text-slate-600">{children}</p>;
}

export default function GuidePage() {
  return (
    <LegalShell title="What is vendor statement reconciliation? A complete guide" updated="June 2026">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ARTICLE_LD) }}
      />

      <P>
        <strong>Vendor statement reconciliation</strong> (also called supplier statement reconciliation)
        is the process of comparing a supplier&apos;s statement of account against your own
        accounts-payable (AP) ledger to confirm both sides agree. The statement lists the invoices,
        credit notes, and payments the vendor believes are outstanding; your ledger records what you
        have actually booked and paid. Reconciling the two catches errors — overbilling, duplicate
        invoices, missing credits, or unrecorded invoices — <strong>before you pay</strong>.
      </P>

      <H2>Why vendor statement reconciliation matters</H2>
      <P>It is one of the most effective controls in accounts payable because it catches money leakage on both sides:</P>
      <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-slate-600">
        <li><strong>Overpayment protection</strong> — duplicate or re-issued invoices are a leading cause of paying twice.</li>
        <li><strong>Recovering credits</strong> — credit notes the vendor owes you are easy to miss if they are not applied.</li>
        <li><strong>Clean books</strong> — invoices missing from your ledger get recorded before period close.</li>
        <li><strong>Stronger vendor relationships</strong> — disputes are resolved with evidence, not guesswork.</li>
      </ul>

      <H2>What you need to reconcile a vendor statement</H2>
      <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-slate-600">
        <li>The vendor&apos;s <strong>statement of account</strong> for the period (PDF, Excel, or CSV).</li>
        <li>Your <strong>AP ledger</strong> or aged-payables report for that same vendor and period.</li>
      </ul>

      <H2>How to reconcile a vendor statement, step by step</H2>
      <ol className="list-decimal pl-5 space-y-1.5 text-[15px] text-slate-600">
        <li><strong>Align the period.</strong> Make sure both documents cover the same date range.</li>
        <li><strong>Match line by line</strong> using the invoice number as the key.</li>
        <li><strong>Compare amounts</strong> for every matched invoice; small differences often hide tax or rounding errors.</li>
        <li><strong>Flag the exceptions</strong> — anything that does not match cleanly (see the list below).</li>
        <li><strong>Investigate</strong> each exception: check the PO/goods receipt, payment status, and any disputes.</li>
        <li><strong>Resolve</strong> — record missing invoices, request a corrected invoice or credit note, or query the vendor.</li>
      </ol>

      <H2>Common discrepancies to look for</H2>
      <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-slate-600">
        <li><strong>Amount mismatch</strong> — the invoice exists on both sides but the totals differ (price, quantity, or tax).</li>
        <li><strong>Missing invoice</strong> — on the statement but not in your ledger (unrecorded or lost).</li>
        <li><strong>Duplicate invoice</strong> — the same invoice billed twice; a frequent cause of overpayment.</li>
        <li><strong>Unapplied credit</strong> — a credit note you are owed that has not been deducted.</li>
        <li><strong>Timing differences</strong> — an invoice or payment in transit between the two records.</li>
      </ul>

      <H2>Manual reconciliation vs. software</H2>
      <P>
        Most teams still reconcile in a spreadsheet — exporting both sides, lining them up with
        VLOOKUP, and highlighting differences by hand. It works for a handful of lines, but it is slow
        and error-prone: vendor PDFs rarely match your ledger&apos;s format, columns are labelled
        differently, scanned statements need re-typing, and a single mis-paste throws off the totals.
      </P>
      <P>
        Reconciliation software removes the manual matching. It extracts and normalises both files,
        matches every line by invoice ID and amount (tolerating OCR and formatting quirks), and returns
        only the lines that need attention.
      </P>

      <H2>How VendorRecon automates it</H2>
      <P>
        <a href="/" className="text-indigo-600 underline">VendorRecon</a> is purpose-built for vendor
        statement reconciliation. You upload the vendor&apos;s statement and your AP ledger in any
        common format (PDF, Excel, CSV), and it returns an exceptions dashboard in seconds —
        amount mismatches, missing invoices, duplicates, and unapplied credits — ready to export to
        Excel and send back to the vendor. No formulas, no highlighter.
      </P>

      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-6 mt-6">
        <p className="font-bold text-slate-900">Reconcile your first statement free</p>
        <p className="text-sm text-slate-600 mt-1">
          Upload a real statement and ledger and see the exceptions in seconds — no credit card needed.
        </p>
        <a href="/signup"
           className="mt-4 inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition-colors">
          Start free
        </a>
        <span className="ml-3 text-xs text-slate-400">or see <a href="/pricing" className="text-indigo-600 underline">pricing</a></span>
      </div>

      <RelatedGuides links={[
        { href: "/guide/reconcile-vendor-statement-in-excel", label: "How to reconcile a vendor statement in Excel" },
        { href: "/guide/supplier-statement-reconciliation-checklist", label: "Supplier statement reconciliation checklist" },
        { href: "/guide/duplicate-invoice-detection", label: "How to catch duplicate invoices (and stop double payments)" },
      ]} />
    </LegalShell>
  );
}
