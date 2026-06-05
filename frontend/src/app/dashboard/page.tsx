/**
 * Exceptions Dashboard — the main user-facing page.
 *
 * Flow:
 *  1. User uploads vendor PDF + internal ledger (drag-drop or file picker)
 *  2. App submits reconciliation job and polls status every 2s
 *  3. On completion: renders KPI cards + three exception buckets
 *  4. "Export to Excel" downloads the full report
 */
"use client";

import React, { useCallback, useRef, useState } from "react";
import { api, type ExceptionsReport } from "@/lib/api";
import { KpiCard } from "@/components/KpiCard";
import { ExceptionsTable } from "@/components/ExceptionsTable";

type UploadState = "idle" | "uploading" | "processing" | "done" | "error";

export default function DashboardPage() {
  const [state, setState]   = useState<UploadState>("idle");
  const [error, setError]   = useState<string | null>(null);
  const [report, setReport] = useState<ExceptionsReport | null>(null);
  const [jobId, setJobId]   = useState<string | null>(null);

  const statementRef = useRef<HTMLInputElement>(null);
  const ledgerRef    = useRef<HTMLInputElement>(null);
  const vendorRef    = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setState("uploading");

    try {
      const statementFile = statementRef.current?.files?.[0];
      const ledgerFile    = ledgerRef.current?.files?.[0];
      const vendorName    = vendorRef.current?.value?.trim();

      if (!statementFile || !ledgerFile || !vendorName) {
        throw new Error("Please fill all fields.");
      }

      // Upload statement PDF
      const stmtForm = new FormData();
      stmtForm.append("file", statementFile);
      stmtForm.append("vendor_name", vendorName);
      const stmtRecord = await api.uploadStatement(stmtForm);
      if (stmtRecord.detail) throw new Error(stmtRecord.detail);

      // Upload ledger CSV/XLSX
      const ledgerForm = new FormData();
      ledgerForm.append("file", ledgerFile);
      const ledgerRecord = await api.uploadLedger(ledgerForm);
      if (ledgerRecord.detail) throw new Error(ledgerRecord.detail);

      // Submit reconciliation job
      const job = await api.reconcile(stmtRecord.id, ledgerRecord.id);
      setJobId(job.id);
      setState("processing");

      // Poll until done
      await pollUntilComplete(job.id);

    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
      setState("error");
    }
  }, []);

  async function pollUntilComplete(id: string) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await new Promise((res) => setTimeout(res, 2000));
      const job = await api.pollJob(id);
      if (job.status === "failed") {
        throw new Error("Reconciliation job failed on the server. Please retry.");
      }
      if (job.status === "completed") {
        const rpt = await api.getReport(id);
        setReport(rpt);
        setState("done");
        return;
      }
    }
  }

  const s = report?.summary;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 font-sans">
      <div className="mx-auto max-w-6xl space-y-8">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendor Statement Reconciliation</h1>
          <p className="text-slate-500 text-sm mt-1">
            Upload a vendor PDF statement and your internal AP ledger to auto-detect discrepancies.
          </p>
        </div>

        {/* ── Upload Form ──────────────────────────────────────────────────── */}
        {state === "idle" || state === "error" ? (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Vendor Name
                </span>
                <input
                  ref={vendorRef}
                  type="text"
                  placeholder="e.g. Acme Supplies Ltd"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Vendor PDF Statement
                </span>
                <input
                  ref={statementRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv,.txt,.tsv,.ods"
                  className="w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-indigo-700 file:text-xs file:font-semibold hover:file:bg-indigo-100"
                  required
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Internal AP Ledger (CSV / XLSX)
                </span>
                <input
                  ref={ledgerRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.txt,.tsv,.ods"
                  className="w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-indigo-700 file:text-xs file:font-semibold hover:file:bg-indigo-100"
                  required
                />
              </label>
            </div>
            {error && (
              <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              Run Reconciliation
            </button>
          </form>
        ) : null}

        {/* ── Processing Spinner ───────────────────────────────────────────── */}
        {state === "uploading" || state === "processing" ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="h-10 w-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
            <p className="text-slate-500 text-sm">
              {state === "uploading" ? "Uploading files…" : "Analysing statement — this takes a few seconds…"}
            </p>
          </div>
        ) : null}

        {/* ── Results ─────────────────────────────────────────────────────── */}
        {state === "done" && report && s && (
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                title="Match Rate"
                value={`${s.match_rate_pct}%`}
                sub={`${s.count_matched} of ${s.total_supplier_lines} lines`}
                variant={s.match_rate_pct >= 90 ? "success" : "warning"}
              />
              <KpiCard
                title="Amount Mismatches"
                value={s.count_amount_mismatch}
                sub={`Net variance: $${s.total_variance.toFixed(2)}`}
                variant={s.count_amount_mismatch > 0 ? "danger" : "success"}
              />
              <KpiCard
                title="Missing Invoices"
                value={s.count_missing_in_ledger}
                sub="In vendor PDF, not in ledger"
                variant={s.count_missing_in_ledger > 0 ? "danger" : "success"}
              />
              <KpiCard
                title="Unapplied Credits"
                value={s.count_unapplied_credit}
                sub="Credits not deducted in ledger"
                variant={s.count_unapplied_credit > 0 ? "warning" : "success"}
              />
            </div>

            {/* Export + New reconciliation buttons */}
            <div className="flex gap-3">
              <a
                href={api.getExportUrl(report.job_id)}
                className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
              >
                ↓ Export to Excel
              </a>
              <button
                onClick={() => { setReport(null); setState("idle"); setError(null); }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                New Reconciliation
              </button>
            </div>

            {/* Exception Buckets */}
            <div className="space-y-4">
              {s.exception_count === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
                  <p className="text-emerald-700 font-semibold text-lg">All lines matched perfectly.</p>
                  <p className="text-emerald-500 text-sm mt-1">
                    No discrepancies found between the vendor statement and internal ledger.
                  </p>
                </div>
              ) : (
                <>
                  <ExceptionsTable
                    title="Amount Mismatches — invoices where supplier and ledger amounts differ"
                    items={report.amount_mismatches.items}
                    color="red"
                  />
                  <ExceptionsTable
                    title="Missing in Ledger — invoices on vendor statement not found internally"
                    items={report.missing_in_ledger.items}
                    color="amber"
                  />
                  <ExceptionsTable
                    title="Unapplied Credits — credit notes not deducted in internal ledger"
                    items={report.unapplied_credits.items}
                    color="purple"
                  />
                </>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
