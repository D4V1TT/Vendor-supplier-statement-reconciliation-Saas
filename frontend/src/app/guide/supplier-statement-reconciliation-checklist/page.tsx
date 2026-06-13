import { LegalShell, H2, Para, GuideCTA, RelatedGuides } from "@/components/LegalShell";

const URL = "https://vendorrecon.org/guide/supplier-statement-reconciliation-checklist";

export const metadata = {
  title: "Supplier Statement Reconciliation Checklist — VendorRecon",
  description:
    "A practical supplier statement reconciliation checklist for accounts payable: preparation, matching, exceptions to investigate, and how to resolve and close.",
  alternates: { canonical: URL },
  openGraph: { type: "article", url: URL, title: "Supplier Statement Reconciliation Checklist" },
};

const LD = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "Supplier Statement Reconciliation Checklist",
  description: "A step-by-step checklist for reconciling a supplier statement against your accounts-payable ledger.",
  datePublished: "2026-06-08",
  dateModified: "2026-06-08",
  author: { "@type": "Organization", name: "VendorRecon", url: "https://vendorrecon.org" },
  publisher: { "@type": "Organization", name: "VendorRecon", logo: { "@type": "ImageObject", url: "https://vendorrecon.org/icon" } },
  mainEntityOfPage: URL,
};

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

      <Para>{`Use this checklist each time you reconcile a supplier statement against your accounts-payable ledger. It keeps the process consistent and makes sure nothing slips through before you pay.`}</Para>

      <H2>1. Preparation</H2>
      <ul className="space-y-2 text-[15px] text-slate-600">
        <Item>Confirm both documents cover the same period.</Item>
        <Item>Gather the supplier statement (PDF, Excel, or CSV) and your AP ledger / aged-payables report for that supplier.</Item>
        <Item>Normalise amounts (remove currency symbols and separators) and invoice-number formats.</Item>
      </ul>

      <H2>2. Match the lines</H2>
      <ul className="space-y-2 text-[15px] text-slate-600">
        <Item>Match every line by invoice number.</Item>
        <Item>Compare the amount on each matched invoice.</Item>
        <Item>Note any invoice on the statement but not in your ledger.</Item>
        <Item>Note any invoice in your ledger but not on the statement.</Item>
      </ul>

      <H2>3. Investigate the exceptions</H2>
      <ul className="space-y-2 text-[15px] text-slate-600">
        <Item>Amount mismatches (price, quantity, or tax differences).</Item>
        <Item>Duplicate invoices (the same number billed twice).</Item>
        <Item>Unapplied credit notes you are owed.</Item>
        <Item>Invoices in dispute or on hold.</Item>
        <Item>Timing differences (an invoice or payment in transit).</Item>
      </ul>

      <H2>4. Resolve and close</H2>
      <ul className="space-y-2 text-[15px] text-slate-600">
        <Item>Record any missing invoices in your ledger.</Item>
        <Item>Request corrected invoices or credit notes from the supplier.</Item>
        <Item>Document each exception and its resolution for the audit trail.</Item>
        <Item>Sign off the reconciliation for the period.</Item>
      </ul>

      <GuideCTA />
      <RelatedGuides links={[
        { href: "/guide/vendor-statement-reconciliation", label: "What is vendor statement reconciliation? A complete guide" },
        { href: "/guide/reconcile-vendor-statement-in-excel", label: "How to reconcile a vendor statement in Excel" },
        { href: "/guide/duplicate-invoice-detection", label: "How to catch duplicate invoices (and stop double payments)" },
      ]} />
    </LegalShell>
  );
}
