/**
 * PLG Landing Page
 * Shows the value proposition + a live sandbox demo widget.
 * Signed-in users are redirected straight to /dashboard.
 */
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, SignUpButton, SignInButton } from "@clerk/nextjs";
import { DropZone } from "@/components/DropZone";
import { api, type LineItem, type ReportSummary } from "@/lib/api";

// ── tiny inline icons ─────────────────────────────────────────────────────────
const Check = () => (
  <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const FEATURES = [
  "Matches invoices by ID, amount & date in seconds",
  "Flags mismatches, missing invoices & unapplied credits",
  "Exports a clean Excel exceptions report instantly",
  "Supports PDF, Excel, CSV, any vendor format",
];

const FAQ = [
  {
    q: "What is vendor statement reconciliation?",
    a: "Vendor statement reconciliation is the process of matching a supplier's statement of account against your own accounts-payable ledger to confirm every invoice, credit, and payment agrees. It surfaces amount mismatches, missing or duplicate invoices, and unapplied credits before you pay.",
  },
  {
    q: "How does VendorRecon work?",
    a: "Upload your vendor's statement (PDF, Excel, or CSV) and your AP ledger export. VendorRecon normalizes the formatting, matches each line by invoice ID and amount, and produces an exceptions report in seconds.",
  },
  {
    q: "What file formats are supported?",
    a: "PDF (including scanned statements via OCR), Excel (.xlsx/.xls), CSV, TSV, and ODS. On the Pro plan, AI extraction handles messy or non-standard layouts.",
  },
  {
    q: "What discrepancies does it catch?",
    a: "Amount mismatches, invoices missing from your ledger, duplicate (double-billed) invoices, unapplied credit notes, and ledger entries missing from the vendor statement.",
  },
  {
    q: "Is my financial data secure?",
    a: "Yes. Files are encrypted at rest with AES-256 and sent over HTTPS, and you can delete your data at any time from your account settings.",
  },
  {
    q: "How much does VendorRecon cost?",
    a: "There is a free plan for occasional reconciliations, and a Pro plan at $99/month with unlimited reconciliations and AI extraction for tough files.",
  },
];

// Structured data (schema.org), helps Google understand the product + pricing
// and makes the FAQ eligible for rich results in search.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "VendorRecon",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: "https://vendorrecon.org",
      description:
        "Reconcile vendor and supplier statements against your accounts-payable ledger in seconds. Automatically catch amount mismatches, missing invoices, duplicate billing, and unapplied credits.",
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
        { "@type": "Offer", name: "Pro", price: "99", priceCurrency: "USD" },
      ],
    },
    {
      "@type": "Organization",
      name: "VendorRecon",
      url: "https://vendorrecon.org",
      logo: "https://vendorrecon.org/icon",
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

const catColor: Record<string, string> = {
  "Flagged_Amount_Mismatch":      "bg-red-50 text-red-700 ring-red-200",
  "Flagged_Missing_In_Ledger":    "bg-amber-50 text-amber-700 ring-amber-200",
  "Flagged_Unapplied_Credit":     "bg-violet-50 text-violet-700 ring-violet-200",
  "Flagged_Likely_Match":         "bg-blue-50 text-blue-700 ring-blue-200",
  "Flagged_Missing_In_Statement": "bg-slate-100 text-slate-700 ring-slate-200",
  "Flagged_Duplicate":            "bg-red-50 text-red-700 ring-red-200",
};

const catLabel: Record<string, string> = {
  "Flagged_Amount_Mismatch":      "Amount Mismatch",
  "Flagged_Missing_In_Ledger":    "Missing in Ledger",
  "Flagged_Unapplied_Credit":     "Unapplied Credit",
  "Flagged_Likely_Match":         "Likely Match",
  "Flagged_Missing_In_Statement": "Missing in Statement",
  "Flagged_Duplicate":            "Duplicate Invoice",
};

function fmt(n: number | null) {
  if (n == null) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function LandingPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const [stmtFile, setStmtFile]   = useState<File | null>(null);
  const [ledgerFile, setLedger]   = useState<File | null>(null);
  const [showDemo, setShowDemo]   = useState(false);
  const [running, setRunning]     = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [summary, setSummary]     = useState<ReportSummary | null>(null);
  const [rows, setRows]           = useState<LineItem[]>([]);

  // Redirect signed-in users straight to the app
  if (isSignedIn) {
    router.replace("/dashboard");
    return null;
  }

  async function handleTryDemo(e: React.FormEvent) {
    e.preventDefault();
    if (!stmtFile || !ledgerFile) return;
    setRunning(true);
    setDemoError(null);
    try {
      const result = await api.sandboxReconcile(stmtFile, ledgerFile);
      setSummary(result.summary);
      setRows(result.exceptions);
      setShowDemo(true);
      setTimeout(() => document.getElementById("demo-result")?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err: any) {
      setDemoError(err.message ?? "Could not process files.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">

      {/* Structured data for search engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <span className="font-bold text-slate-900 text-sm">VendorRecon</span>
          </div>
          <div className="flex items-center gap-3">
            <SignInButton mode="modal">
              <button className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="rounded-xl bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm">
                Get started free
              </button>
            </SignUpButton>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          Built for finance teams
        </div>
        <h1 className="text-5xl font-extrabold text-slate-900 leading-tight tracking-tight max-w-3xl mx-auto">
          Retire the yellow highlighter.{" "}
          <span className="text-indigo-600">Reconcile vendor statements</span>{" "}
          in seconds.
        </h1>
        <p className="mt-6 text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
          Upload your vendor's PDF statement and your internal AP ledger.
          VendorRecon finds every mismatch, missing invoice, and unapplied credit, automatically.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <SignUpButton mode="modal">
            <button className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 active:scale-[0.99]">
              Start free, no credit card
            </button>
          </SignUpButton>
          <a href="#sandbox" className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1.5">
            Try sandbox demo
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </a>
        </div>
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {FEATURES.map(f => (
            <li key={f} className="flex items-center gap-1.5 text-sm text-slate-500">
              <Check /> {f}
            </li>
          ))}
        </ul>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section className="bg-slate-50 border-y border-slate-100 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-slate-400 mb-10">How it works</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { n: "01", title: "Upload both files", desc: "Drop your vendor PDF statement and your AP ledger export (CSV, Excel, or any format)." },
              { n: "02", title: "AI matches every line", desc: "Our engine compares each invoice by ID and amount, categorising matches and exceptions automatically." },
              { n: "03", title: "Download the exceptions report", desc: "Get a clean Excel report with only the lines that need your attention, ready to send to your vendor." },
            ].map(s => (
              <div key={s.n} className="flex gap-4">
                <span className="text-3xl font-black text-indigo-100 leading-none flex-shrink-0">{s.n}</span>
                <div>
                  <p className="font-bold text-slate-800">{s.title}</p>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sandbox Demo ───────────────────────────────────────────────────── */}
      <section id="sandbox" className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-2">Free sandbox</p>
          <h2 className="text-3xl font-extrabold text-slate-900">See it work on your own files</h2>
          <p className="text-slate-500 mt-2 text-sm">No account needed. Upload any sample files and see the exceptions detected instantly.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {!showDemo ? (
            <form onSubmit={handleTryDemo} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Vendor Statement</p>
                  <DropZone
                    label="Drop vendor statement"
                    hint="PDF, Excel, CSV, TXT"
                    accept=".pdf,.xlsx,.xls,.csv,.txt,.tsv,.ods"
                    icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0120 9.414V19a2 2 0 01-2 2z" /></svg>}
                    accentColor="indigo"
                    file={stmtFile}
                    onFile={setStmtFile}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Internal AP Ledger</p>
                  <DropZone
                    label="Drop AP ledger export"
                    hint="PDF, Excel, CSV, TXT"
                    accept=".pdf,.xlsx,.xls,.csv,.txt,.tsv,.ods"
                    icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" /></svg>}
                    accentColor="violet"
                    file={ledgerFile}
                    onFile={setLedger}
                  />
                </div>
              </div>
              {demoError && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-sm text-red-700">{demoError}</p>
                </div>
              )}
              <button
                type="submit"
                disabled={!stmtFile || !ledgerFile || running}
                className={`w-full rounded-xl py-3 text-sm font-bold tracking-wide transition-all
                  ${stmtFile && ledgerFile && !running
                    ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                    : "bg-slate-100 text-slate-300 cursor-not-allowed"}`}
              >
                {running
                  ? <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-500 animate-spin" />
                      Analysing your files…
                    </span>
                  : "Run Free Demo →"}
              </button>
            </form>
          ) : (

            /* ── Demo Result (blurred preview + CTA) ────────────────────── */
            <div id="demo-result" className="animate-fade-up">
              {/* Summary bar, REAL counts from the uploaded files */}
              <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
                {[
                  { label: "Amount Mismatches", value: summary?.count_amount_mismatch ?? 0,   color: "text-red-600" },
                  { label: "Missing Invoices",  value: summary?.count_missing_in_ledger ?? 0, color: "text-amber-600" },
                  { label: "Unapplied Credits", value: summary?.count_unapplied_credit ?? 0,  color: "text-violet-600" },
                ].map(k => (
                  <div key={k.label} className="px-6 py-5 text-center">
                    <p className={`text-3xl font-extrabold ${k.color}`}>{k.value}</p>
                    <p className="text-xs text-slate-400 mt-1 font-medium">{k.label}</p>
                  </div>
                ))}
              </div>

              {/* Blurred table, REAL exception rows */}
              <div className="relative overflow-hidden min-h-[240px]">
                <table className="w-full text-sm select-none">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {["Invoice ID", "Supplier Amt", "Ledger Amt", "Variance", "Category"].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 blur-[3px] pointer-events-none">
                    {(rows.length ? rows : Array(5).fill(null)).slice(0, 6).map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50/60">
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-800 text-xs">{r?.invoice_id ?? "INV-0000"}</td>
                        <td className="px-5 py-3.5 tabular-nums font-medium">{fmt(r?.supplier_amount ?? 0)}</td>
                        <td className="px-5 py-3.5 tabular-nums text-slate-400">{fmt(r?.ledger_amount ?? null)}</td>
                        <td className="px-5 py-3.5 tabular-nums font-bold text-red-600">{r?.variance != null ? `${r.variance > 0 ? "+" : ""}${fmt(r.variance)}` : "-"}</td>
                        <td className="px-5 py-3.5">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${catColor[r?.category] ?? "bg-slate-50 text-slate-500 ring-slate-200"}`}>
                            {catLabel[r?.category] ?? "Exception"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Unlock overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[2px]">
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-xl px-8 py-8 text-center max-w-sm mx-4 space-y-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mx-auto">
                      <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-base">
                        <span className="text-indigo-600">{summary?.exception_count ?? 0} exception{summary?.exception_count !== 1 ? "s" : ""} found</span> in your files
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        Create a free account to unlock the full report and download the Excel file.
                      </p>
                    </div>
                    <SignUpButton mode="modal">
                      <button className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition-colors shadow-sm">
                        Sign up free, see full report
                      </button>
                    </SignUpButton>
                    <button
                      onClick={() => setShowDemo(false)}
                      className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      ← Try different files
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section className="bg-slate-50 border-t border-slate-100 py-20">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-extrabold text-slate-900 text-center">
            Vendor statement reconciliation FAQ
          </h2>
          <dl className="mt-10 space-y-4">
            {FAQ.map((f) => (
              <div key={f.q} className="rounded-2xl border border-slate-200 bg-white p-6">
                <dt className="font-bold text-slate-900">{f.q}</dt>
                <dd className="mt-2 text-sm text-slate-600 leading-relaxed">{f.a}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 text-center text-sm">
            <a href="/guide/vendor-statement-reconciliation"
               className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
              Read the complete guide to vendor statement reconciliation →
            </a>
          </p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-slate-400">© 2026 VendorRecon. All data encrypted at rest.</p>
          <div className="flex flex-wrap gap-5">
            <a href="/pricing" className="text-xs text-slate-400 hover:text-slate-700 transition-colors">Pricing</a>
            <a href="/terms" className="text-xs text-slate-400 hover:text-slate-700 transition-colors">Terms</a>
            <a href="/privacy" className="text-xs text-slate-400 hover:text-slate-700 transition-colors">Privacy</a>
            <a href="/refund" className="text-xs text-slate-400 hover:text-slate-700 transition-colors">Refunds</a>
            <a href="/contact" className="text-xs text-slate-400 hover:text-slate-700 transition-colors">Contact</a>
            <a href="/login" className="text-xs text-slate-400 hover:text-slate-700 transition-colors">Sign in</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
