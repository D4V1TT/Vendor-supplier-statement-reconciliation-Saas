"use client";

import React, { useCallback, useState } from "react";
import { api, type ExceptionsReport } from "@/lib/api";
import { Sidebar }          from "@/components/Sidebar";
import { AuthGuard }        from "@/components/AuthGuard";
import { DropZone }         from "@/components/DropZone";
import { KpiCard }          from "@/components/KpiCard";
import { ExceptionsTable }  from "@/components/ExceptionsTable";
import { ProgressStepper, type StepId } from "@/components/ProgressStepper";
import { ColumnMapper, type DetectionResult } from "@/components/ColumnMapper";

type Stage = "idle" | "detecting" | "mapping" | "uploading" | "extracting" | "matching" | "done" | "error";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

const Icons = {
  document: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0120 9.414V19a2 2 0 01-2 2z" /></svg>,
  table:    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" /></svg>,
  check:    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  warning:  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  missing:  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0120 9.414V19a2 2 0 01-2 2z" /></svg>,
  credit:   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>,
  download: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  refresh:  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
};

const stageToStep: Partial<Record<Stage, StepId>> = {
  uploading: "uploading", extracting: "extracting", matching: "matching", done: "done",
};

export default function DashboardPage() {
  const [stage,  setStage]  = useState<Stage>("idle");
  const [error,  setError]  = useState<string | null>(null);
  const [report, setReport] = useState<ExceptionsReport | null>(null);
  const [activeTab, setActiveTab] = useState<"exceptions" | "matched">("exceptions");

  // Files
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [ledgerFile,    setLedgerFile]    = useState<File | null>(null);
  const [vendorName,    setVendorName]    = useState("");

  // Column mapping state
  const [stmtDetection,    setStmtDetection]    = useState<DetectionResult | null>(null);
  const [ledgerDetection,  setLedgerDetection]  = useState<DetectionResult | null>(null);
  const [stmtMapping,      setStmtMapping]      = useState<Record<string, string> | null>(null);
  const [ledgerMapping,    setLedgerMapping]    = useState<Record<string, string> | null>(null);
  const [mappingTarget,    setMappingTarget]    = useState<"statement" | "ledger" | null>(null);

  const canSubmit = !!(statementFile && ledgerFile && vendorName.trim()
    && (!stmtDetection?.needs_user_confirmation   || stmtMapping)
    && (!ledgerDetection?.needs_user_confirmation || ledgerMapping));

  // ── Detect columns when a file is dropped ──────────────────────────────────
  async function detectFile(file: File, target: "statement" | "ledger") {
    if (target === "statement") { setStatementFile(file); setStmtDetection(null); setStmtMapping(null); }
    else                        { setLedgerFile(file);   setLedgerDetection(null); setLedgerMapping(null); }

    // Only run detection on tabular files (not PDFs — those go through PDF extractor)
    if (file.name.toLowerCase().endsWith(".pdf")) return;

    setStage("detecting");
    try {
      const { getToken } = await import("@/lib/api").then(m => ({ getToken: null as any }));
      // Use the api authHeader helper via a tiny inline fetch
      const token = await (window as any).__clerkGetToken?.() ?? null;
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${BASE}/detect-columns`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) { setStage("idle"); return; }
      const detection: DetectionResult = await res.json();

      if (target === "statement") {
        setStmtDetection(detection);
        if (detection.needs_user_confirmation) setMappingTarget("statement");
        else setStmtMapping(detection.mapping);
      } else {
        setLedgerDetection(detection);
        if (detection.needs_user_confirmation) setMappingTarget("ledger");
        else setLedgerMapping(detection.mapping);
      }
    } catch { /* detection is best-effort — proceed without it */ }
    setStage("idle");
  }

  // ── Main submit ────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setStage("uploading");

    try {
      const stmtForm = new FormData();
      stmtForm.append("file", statementFile!);
      stmtForm.append("vendor_name", vendorName.trim());
      if (stmtMapping) stmtForm.append("column_mapping", JSON.stringify(stmtMapping));
      const stmtRecord = await api.uploadStatement(stmtForm);

      setStage("extracting");

      const ledgerForm = new FormData();
      ledgerForm.append("file", ledgerFile!);
      if (ledgerMapping) ledgerForm.append("column_mapping", JSON.stringify(ledgerMapping));
      const ledgerRecord = await api.uploadLedger(ledgerForm);

      setStage("matching");
      const job = await api.reconcile(stmtRecord.id, ledgerRecord.id);

      while (true) {
        await new Promise(r => setTimeout(r, 2000));
        const j = await api.pollJob(job.id);
        if (j.status === "failed")    throw new Error("Reconciliation job failed. Please retry.");
        if (j.status === "completed") {
          const rpt = await api.getReport(job.id);
          setReport(rpt);
          setStage("done");
          return;
        }
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
      setStage("error");
    }
  }, [canSubmit, statementFile, ledgerFile, vendorName, stmtMapping, ledgerMapping]);

  const reset = () => {
    setStage("idle"); setError(null); setReport(null);
    setStatementFile(null); setLedgerFile(null); setVendorName("");
    setStmtDetection(null); setLedgerDetection(null);
    setStmtMapping(null); setLedgerMapping(null); setMappingTarget(null);
  };

  const s = report?.summary;
  const isProcessing = ["uploading","extracting","matching"].includes(stage);

  return (
    <AuthGuard>
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-60 overflow-y-auto scrollbar-thin">
        <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">

          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Statement Reconciliation</h1>
              <p className="text-sm text-slate-400 mt-0.5">Match vendor statements against your AP ledger and surface exceptions instantly.</p>
            </div>
            {stage === "done" && (
              <button onClick={reset} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors">
                {Icons.refresh} New reconciliation
              </button>
            )}
          </div>

          {/* Column mapper overlay */}
          {mappingTarget && (
            <ColumnMapper
              label={mappingTarget === "statement" ? "Vendor Statement" : "Internal AP Ledger"}
              detection={(mappingTarget === "statement" ? stmtDetection : ledgerDetection)!}
              onConfirm={(mapping) => {
                if (mappingTarget === "statement") setStmtMapping(mapping);
                else setLedgerMapping(mapping);
                setMappingTarget(null);
              }}
              onCancel={() => {
                if (mappingTarget === "statement") { setStatementFile(null); setStmtDetection(null); }
                else { setLedgerFile(null); setLedgerDetection(null); }
                setMappingTarget(null);
              }}
            />
          )}

          {/* Upload form */}
          {!mappingTarget && (stage === "idle" || stage === "detecting" || stage === "error") && (
            <form onSubmit={handleSubmit} className="space-y-5 animate-fade-up">
              {/* Vendor name */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Vendor / Supplier Name</span>
                  <input
                    type="text" value={vendorName} onChange={e => setVendorName(e.target.value)}
                    placeholder="e.g. Acme Supplies Ltd" required
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
                  />
                </label>
              </div>

              {/* Drop zones */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Vendor Statement</p>
                    {stmtMapping && !stmtDetection?.needs_user_confirmation && (
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5 ring-1 ring-emerald-200">Columns mapped ✓</span>
                    )}
                    {stmtDetection?.needs_user_confirmation && !stmtMapping && (
                      <button type="button" onClick={() => setMappingTarget("statement")}
                        className="text-[10px] font-semibold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5 ring-1 ring-amber-200 hover:bg-amber-100 transition-colors">
                        Review mapping ⚠
                      </button>
                    )}
                  </div>
                  <DropZone label="Drop vendor statement here" hint="Drag & drop or click to browse"
                    accept=".pdf,.xlsx,.xls,.csv,.txt,.tsv,.ods"
                    icon={Icons.document} accentColor="indigo"
                    file={statementFile}
                    onFile={f => detectFile(f, "statement")} />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Internal AP Ledger</p>
                    {ledgerMapping && !ledgerDetection?.needs_user_confirmation && (
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5 ring-1 ring-emerald-200">Columns mapped ✓</span>
                    )}
                    {ledgerDetection?.needs_user_confirmation && !ledgerMapping && (
                      <button type="button" onClick={() => setMappingTarget("ledger")}
                        className="text-[10px] font-semibold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5 ring-1 ring-amber-200 hover:bg-amber-100 transition-colors">
                        Review mapping ⚠
                      </button>
                    )}
                  </div>
                  <DropZone label="Drop AP ledger export here" hint="Drag & drop or click to browse"
                    accept=".csv,.xlsx,.xls,.txt,.tsv,.ods"
                    icon={Icons.table} accentColor="violet"
                    file={ledgerFile}
                    onFile={f => detectFile(f, "ledger")} />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 animate-pop-in">
                  <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button type="submit" disabled={!canSubmit || stage === "detecting"}
                className={`w-full rounded-xl py-3 text-sm font-bold tracking-wide transition-all duration-200 shadow-sm
                  ${canSubmit && stage !== "detecting"
                    ? "bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md active:scale-[0.99]"
                    : "bg-slate-100 text-slate-300 cursor-not-allowed"}`}>
                {stage === "detecting" ? "Analysing columns…" : "Run Reconciliation"}
              </button>
            </form>
          )}

          {/* Processing */}
          {isProcessing && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-8 py-14 flex flex-col items-center gap-10 animate-fade-up">
              <ProgressStepper current={stageToStep[stage] ?? "uploading"} />
              <p className="text-xs text-slate-400">This usually takes under 10 seconds</p>
            </div>
          )}

          {/* Results */}
          {stage === "done" && report && s && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="Match Rate" value={`${s.match_rate_pct}%`}
                  sub={`${s.count_matched} of ${s.total_supplier_lines} lines`}
                  icon={Icons.check} variant={s.match_rate_pct >= 90 ? "success" : "warning"} ring={s.match_rate_pct} />
                <KpiCard title="Amount Mismatches" value={s.count_amount_mismatch}
                  sub={`Variance: ${new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(s.total_variance)}`}
                  icon={Icons.warning} variant={s.count_amount_mismatch > 0 ? "danger" : "success"} />
                <KpiCard title="Missing Invoices" value={s.count_missing_in_ledger}
                  sub="In vendor stmt, absent from ledger"
                  icon={Icons.missing} variant={s.count_missing_in_ledger > 0 ? "danger" : "success"} />
                <KpiCard title="Unapplied Credits" value={s.count_unapplied_credit}
                  sub="Credits not deducted in ledger"
                  icon={Icons.credit} variant={s.count_unapplied_credit > 0 ? "warning" : "success"} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                  {(["exceptions","matched"] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === tab ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
                      {tab === "exceptions" ? `Exceptions (${s.exception_count})` : `Matched (${s.count_matched})`}
                    </button>
                  ))}
                </div>
                <a href={api.getExportUrl(report.job_id)}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors">
                  {Icons.download} Export Excel
                </a>
              </div>

              {activeTab === "exceptions" && (
                <div className="space-y-4">
                  {s.exception_count === 0 ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-14 text-center animate-pop-in">
                      <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <p className="text-emerald-800 font-bold text-lg">All lines matched perfectly</p>
                      <p className="text-emerald-500 text-sm mt-1">No discrepancies found between the vendor statement and internal ledger.</p>
                    </div>
                  ) : (
                    <>
                      <ExceptionsTable title="Amount Mismatches" description="Invoices found in both sources but with differing amounts" items={report.amount_mismatches.items} color="red" icon={Icons.warning} />
                      <ExceptionsTable title="Missing in Ledger" description="Invoices present on vendor statement but absent from internal AP ledger" items={report.missing_in_ledger.items} color="amber" icon={Icons.missing} />
                      <ExceptionsTable title="Unapplied Credits" description="Credit notes on vendor statement not deducted in internal ledger" items={report.unapplied_credits.items} color="violet" icon={Icons.credit} />
                    </>
                  )}
                </div>
              )}

              {activeTab === "matched" && (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-fade-up">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">{Icons.check}</div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Matched Lines</p>
                      <p className="text-xs text-slate-400">{s.count_matched} invoice{s.count_matched !== 1 ? "s" : ""} matched exactly</p>
                    </div>
                  </div>
                  <div className="px-5 py-8 text-center text-sm text-slate-400">
                    Fetch via <code className="bg-slate-100 rounded px-1 text-slate-500">GET /api/jobs/{report.job_id}/matched</code>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
    </AuthGuard>
  );
}
