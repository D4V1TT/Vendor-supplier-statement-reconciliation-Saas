"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { AuthGuard } from "@/components/AuthGuard";
import { api, type JobListItem } from "@/lib/api";

function matchRatePct(matched: number | null, total: number | null) {
  if (!total) return 0;
  return Math.round(((matched ?? 0) / total) * 100);
}

function MatchBar({ pct }: { pct: number }) {
  const color = pct === 100 ? "bg-emerald-500" : pct >= 90 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-600 tabular-nums w-9 text-right">{pct}%</span>
    </div>
  );
}

function StatusPill({ job }: { job: JobListItem }) {
  if (job.status === "pending" || job.status === "running") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600 ring-1 ring-indigo-200">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" /> Processing
      </span>
    );
  }
  if (job.status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Failed
      </span>
    );
  }
  const exceptions = (job.count_amount_mismatch ?? 0) + (job.count_missing_in_ledger ?? 0) + (job.count_unapplied_credit ?? 0);
  if (exceptions === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Clean
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> {exceptions} exception{exceptions !== 1 ? "s" : ""}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[180, 100, 60, 140, 110, 80].map((w, i) => (
        <td key={i} className="px-5 py-4">
          <div className="h-3.5 rounded-full animate-shimmer" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const [jobs, setJobs]       = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    api.listJobs()
      .then(setJobs)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function fmt(n: number | null) {
    if (n == null) return "—";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  }

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar />
        <main className="flex-1 ml-60 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">

            {/* Header */}
            <div>
              <h1 className="text-xl font-bold text-slate-900">Reconciliation History</h1>
              <p className="text-sm text-slate-400 mt-0.5">All past reconciliation runs for your company.</p>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Table */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    {["Vendor", "Date", "Lines", "Match Rate", "Variance", "Result", ""].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading && [1,2,3].map(i => <SkeletonRow key={i} />)}

                  {!loading && jobs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                            <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0120 9.414V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <p className="text-slate-400 font-medium text-sm">No reconciliations yet</p>
                          <button
                            onClick={() => router.push("/dashboard")}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                          >
                            Run your first reconciliation →
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading && jobs.map(job => {
                    const pct = matchRatePct(job.count_matched, job.total_supplier_lines);
                    return (
                      <tr key={job.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-800">{job.vendor_name ?? "Unknown vendor"}</p>
                          <p className="text-[10px] text-slate-300 font-mono mt-0.5">{job.id.slice(0, 8)}</p>
                        </td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap text-xs">
                          {new Date(job.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-5 py-4 text-slate-500 tabular-nums">
                          {job.total_supplier_lines ?? "—"}
                        </td>
                        <td className="px-5 py-4 w-44">
                          {job.status === "completed"
                            ? <MatchBar pct={pct} />
                            : <span className="text-xs text-slate-300">—</span>
                          }
                        </td>
                        <td className="px-5 py-4 tabular-nums text-xs font-semibold">
                          {job.status === "completed"
                            ? <span className={(job.total_variance ?? 0) !== 0 ? "text-red-600" : "text-slate-400"}>
                                {fmt(job.total_variance)}
                              </span>
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                        <td className="px-5 py-4">
                          <StatusPill job={job} />
                        </td>
                        <td className="px-5 py-4 text-right">
                          {job.status === "completed" && (
                            <button
                              onClick={() => router.push(`/dashboard?job=${job.id}`)}
                              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors whitespace-nowrap"
                            >
                              View report →
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <p className="text-xs text-slate-400">{loading ? "Loading…" : `${jobs.length} reconciliation${jobs.length !== 1 ? "s" : ""}`}</p>
                <p className="text-xs text-slate-300">Showing last 100</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
