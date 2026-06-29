import { LegalShell, H2, Para, GuideCTA, RelatedGuides } from "@/components/LegalShell";

const URL = "https://vendorrecon.org/guide/reconcile-vendor-statement-in-excel";

export const metadata = {
  title: "How to Reconcile a Vendor Statement in Excel (Step by Step) | VendorRecon",
  description:
    "A detailed, step-by-step guide to reconciling a vendor statement in Excel using XLOOKUP, VLOOKUP and COUNTIF, with formulas for every exception type, a worked example, pitfalls, and when to automate.",
  alternates: { canonical: URL },
  openGraph: { type: "article", url: URL, title: "How to Reconcile a Vendor Statement in Excel" },
};

const FAQ = [
  { q: "Should I use VLOOKUP or XLOOKUP?",
    a: "Use XLOOKUP if your Excel version has it, it is simpler, can return a default like MISSING, and does not break when columns move. VLOOKUP works too but is more fragile." },
  { q: "Why do my invoice numbers not match even though they look the same?",
    a: "Usually leading zeros, a text-vs-number mismatch, hidden spaces, or a prefix the vendor adds. Store invoice numbers as text and trim spaces before matching." },
  { q: "How do I find duplicates in Excel?",
    a: "Use =COUNTIF(range, cell) on the invoice-number column; any result greater than 1 is a duplicate. This finds exact duplicates only, not same-amount-different-number ones." },
  { q: "Is Excel good enough for vendor statement reconciliation?",
    a: "For a few low-volume, clean files, yes. It breaks down with scanned PDFs, mismatched formats, and higher volumes, where dedicated software is far faster and more reliable." },
];

const LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "TechArticle",
      headline: "How to Reconcile a Vendor Statement in Excel (Step by Step)",
      description: "Reconcile a vendor statement in Excel with XLOOKUP and COUNTIF, with formulas for every exception type and a worked example.",
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
    <LegalShell title="How to reconcile a vendor statement in Excel (step by step)" updated="June 2026">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LD) }} />

      <Para>{`Excel is where most accounts-payable teams start with vendor statement reconciliation. It is free, familiar, and good enough for a handful of clean lines. This guide walks through the exact spreadsheet method, setup, formulas, and how to find every type of exception, then shows where the approach breaks and what to do about it.`}</Para>
      <Para>{`If you only take one thing away: the formulas are the easy part. The real work in Excel reconciliation is getting two differently-formatted files into a state where the formulas can actually match them.`}</Para>

      <H2>Step 1: Set up your two sheets</H2>
      <Para>{`Put each source on its own sheet, one row per line item, with clean, consistent columns. A simple layout is: Invoice Number, Date, Amount.`}</Para>
      <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-slate-600">
        <li><strong>Sheet 1: Statement.</strong>{` The vendor's statement. If it arrived as a PDF you will need to copy the table out; if it is a scan, you may have to re-type it or run OCR first.`}</li>
        <li><strong>Sheet 2: Ledger.</strong>{` Your AP ledger or aged-payables export for that vendor and period.`}</li>
      </ul>
      <H3>Clean the data first</H3>
      <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-slate-600">
        <li>{`Remove currency symbols and thousands separators so amounts are plain numbers.`}</li>
        <li>{`Store invoice numbers as text to preserve leading zeros (000123 must not become 123).`}</li>
        <li>{`Trim hidden spaces with `}<Code>{`=TRIM(A2)`}</Code>{`, a trailing space is the most common reason two identical-looking numbers will not match.`}</li>
        <li>{`Make invoice-number casing consistent with `}<Code>{`=UPPER(A2)`}</Code>{` if the vendor mixes cases.`}</li>
      </ul>

      <H2>Step 2: Match each line with XLOOKUP</H2>
      <Para>{`On the Statement sheet, pull the matching ledger amount next to each line using the invoice number as the key:`}</Para>
      <p><Code>{`=XLOOKUP(A2, Ledger!A:A, Ledger!C:C, "MISSING")`}</Code></p>
      <Para>{`Then add a Variance column to compare the statement amount with the ledger amount:`}</Para>
      <p><Code>{`=B2 - XLOOKUP(A2, Ledger!A:A, Ledger!C:C, 0)`}</Code></p>
      <Para>{`If your Excel does not have XLOOKUP, the VLOOKUP equivalent is:`}</Para>
      <p><Code>{`=VLOOKUP(A2, Ledger!A:C, 3, FALSE)`}</Code></p>
      <Para>{`Any row showing MISSING is on the statement but not in your ledger. Any row with a non-zero variance is an amount mismatch.`}</Para>

      <H2>Step 3: Find every exception type</H2>

      <H3>Missing in ledger (on statement, not in books)</H3>
      <Para>{`These are the MISSING results from the lookup above. Filter the Variance/lookup column for MISSING to list them.`}</Para>

      <H3>Missing in statement (in books, not on statement)</H3>
      <Para>{`Run the lookup the other way: on the Ledger sheet, look up each ledger invoice in the Statement sheet. Anything that returns MISSING is in your books but absent from the statement.`}</Para>
      <p><Code>{`=XLOOKUP(A2, Statement!A:A, Statement!C:C, "MISSING")`}</Code></p>

      <H3>Amount mismatches</H3>
      <Para>{`Filter the Variance column for any value that is not zero. Sort by absolute variance to deal with the largest discrepancies first.`}</Para>

      <H3>Duplicate invoices</H3>
      <Para>{`Add a column with `}<Code>{`=COUNTIF(A:A, A2)`}</Code>{`, any result greater than 1 means the invoice number appears more than once. Note this only catches exact duplicates; it will miss the same charge under a slightly different number.`}</Para>

      <H3>Unapplied credits</H3>
      <Para>{`Filter the statement for negative amounts (credit notes) that returned MISSING from the ledger lookup, those are credits you may be owed but have not recorded or applied.`}</Para>

      <H2>A worked example</H2>
      <Para>{`Suppose the statement lists invoice INV-1001 at 1,250.00 and your ledger has INV-1001 at 1,205.00. The lookup finds a match, and the variance column shows 45.00, an amount mismatch, most likely a transposition (1,250 vs 1,205) or a tax difference. Meanwhile INV-1007 appears on the statement but returns MISSING, you never booked it. And COUNTIF flags INV-0990 twice, a duplicate. In a few formulas you have isolated three real issues to investigate, while the dozens of clean lines fall away.`}</Para>

      <H2>Why Excel reconciliation breaks down</H2>
      <Para>{`The method above is sound, but in practice the spreadsheet approach struggles the moment real-world files arrive:`}</Para>
      <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-slate-600">
        <li><strong>PDFs and scans.</strong>{` Most statements arrive as PDFs, often scanned, so the data has to be copied out or re-typed before any formula can touch it. This is slow and introduces typos.`}</li>
        <li><strong>Format drift.</strong>{` Every vendor labels columns differently and orders them differently, so you re-build the layout for each statement.`}</li>
        <li><strong>Invoice-number mismatches.</strong>{` Leading zeros, prefixes, and spacing cause lookups to silently return MISSING for invoices that actually match.`}</li>
        <li><strong>Fragile formulas.</strong>{` One inserted column, sorted range, or mis-paste quietly breaks a VLOOKUP and skews the totals, with no warning and no audit trail.`}</li>
        <li><strong>No scale.</strong>{` A few statements a month is manageable; dozens becomes hours of repetitive, error-prone work.`}</li>
      </ul>

      <H2>Tips to make Excel reconciliation less painful</H2>
      <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-slate-600">
        <li>{`Always TRIM and standardise invoice numbers before matching.`}</li>
        <li>{`Use XLOOKUP with a clear default (MISSING) so unmatched lines are obvious.`}</li>
        <li>{`Build the reconciliation as a reusable template so you are not starting from scratch each month.`}</li>
        <li>{`Add conditional formatting to highlight non-zero variances and COUNTIF duplicates automatically.`}</li>
      </ul>

      <H2>When to move to software</H2>
      <Para>{`If you are spending more than a few minutes per statement, handling scanned PDFs, or reconciling more than a handful of vendors, dedicated software pays for itself quickly. VendorRecon extracts and normalises both files for you, matches every line by invoice ID and amount, tolerating OCR and formatting differences that break Excel lookups, and returns only the exceptions, ready to export back to Excel.`}</Para>
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
        { href: "/guide/supplier-statement-reconciliation-checklist", label: "Supplier statement reconciliation checklist" },
        { href: "/guide/duplicate-invoice-detection", label: "How to catch duplicate invoices (and stop double payments)" },
      ]} />
    </LegalShell>
  );
}
