import { LegalShell, H2, Para, GuideCTA, RelatedGuides } from "@/components/LegalShell";

const URL = "https://vendorrecon.org/guide/reconcile-vendor-statement-in-excel";

export const metadata = {
  title: "How to Reconcile a Vendor Statement in Excel (Step by Step) — VendorRecon",
  description:
    "A step-by-step guide to reconciling a vendor statement in Excel with XLOOKUP and COUNTIF — plus why the spreadsheet approach breaks and how to automate it.",
  alternates: { canonical: URL },
  openGraph: { type: "article", url: URL, title: "How to Reconcile a Vendor Statement in Excel" },
};

const LD = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "How to Reconcile a Vendor Statement in Excel (Step by Step)",
  description: "Reconcile a vendor statement in Excel with XLOOKUP and COUNTIF, and learn where the spreadsheet approach breaks.",
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
    <LegalShell title="How to reconcile a vendor statement in Excel (step by step)" updated="June 2026">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LD) }} />

      <Para>{`Many accounts-payable teams reconcile vendor statements in Excel. It works for small volumes, and this guide walks through the exact steps — then shows where the spreadsheet approach starts to break.`}</Para>

      <H2>Set up your two sheets</H2>
      <Para>{`Put each source on its own sheet, one row per line item, with clean columns for the invoice number, date, and amount:`}</Para>
      <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-slate-600">
        <li>Sheet 1 — the vendor statement (you may have to copy it out of a PDF or re-type a scanned copy).</li>
        <li>Sheet 2 — your AP ledger or aged-payables export for that vendor and period.</li>
      </ul>
      <Para>{`Strip currency symbols and thousands separators so the amounts are plain numbers, and store invoice numbers as text to preserve leading zeros.`}</Para>

      <H2>Match each line with XLOOKUP</H2>
      <Para>{`On the statement sheet, pull the matching ledger amount using the invoice number as the key:`}</Para>
      <p><Code>{`=XLOOKUP(A2, Ledger!A:A, Ledger!C:C, "MISSING")`}</Code></p>
      <Para>{`Then add a Variance column to compare the two amounts:`}</Para>
      <p><Code>{`=B2 - XLOOKUP(A2, Ledger!A:A, Ledger!C:C, 0)`}</Code></p>
      <Para>{`Any row showing MISSING is on the statement but not in your ledger. Any non-zero variance is an amount mismatch.`}</Para>

      <H2>Catch the rest</H2>
      <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-slate-600">
        <li><strong>Missing in statement</strong> — run the lookup the other way: look up each ledger invoice in the statement.</li>
        <li><strong>Duplicates</strong> — <Code>{`=COUNTIF(A:A, A2)`}</Code> greater than 1 flags a repeated invoice number.</li>
        <li><strong>Unapplied credits</strong> — filter for negative amounts on the statement with no ledger match.</li>
      </ul>

      <H2>Why Excel reconciliation breaks</H2>
      <Para>{`The formulas are simple; the data is not. In practice, spreadsheet reconciliation falls apart because:`}</Para>
      <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-slate-600">
        <li>Statements arrive as PDFs (often scanned), so the data has to be re-typed or OCR-ed first.</li>
        <li>Invoice numbers rarely match exactly — leading zeros, prefixes, and spacing differences break the lookup.</li>
        <li>Every vendor labels columns differently, so the layout changes each time.</li>
        <li>A single mis-paste or stray space silently throws off the totals, with no audit trail.</li>
        <li>It does not scale — dozens of statements a month becomes hours of manual work.</li>
      </ul>

      <H2>Automate it</H2>
      <Para>{`Reconciliation software removes the manual matching. VendorRecon extracts and normalises both files, matches every line by invoice ID and amount — tolerating OCR and formatting differences — and returns only the exceptions, ready to export back to Excel.`}</Para>

      <GuideCTA />
      <RelatedGuides links={[
        { href: "/guide/vendor-statement-reconciliation", label: "What is vendor statement reconciliation? A complete guide" },
        { href: "/guide/supplier-statement-reconciliation-checklist", label: "Supplier statement reconciliation checklist" },
        { href: "/guide/duplicate-invoice-detection", label: "How to catch duplicate invoices (and stop double payments)" },
      ]} />
    </LegalShell>
  );
}
