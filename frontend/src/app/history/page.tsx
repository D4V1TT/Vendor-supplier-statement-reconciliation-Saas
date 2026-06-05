"use client";

import React from "react";
import { Sidebar } from "@/components/Sidebar";

const MOCK_JOBS = [
  { id: "a1b2c3d4", vendor: "Acme Supplies Ltd",   date: "2026-06-04", lines: 84,  matched: 79, exceptions: 5,  status: "completed" },
  { id: "b2c3d4e5", vendor: "Global Parts Co",     date: "2026-06-03", lines: 120, matched: 120, exceptions: 0, status: "completed" },
  { id: "c3d4e5f6", vendor: "TechFlow Solutions",  date: "2026-06-01", lines: 52,  matched: 48, exceptions: 4,  status: "completed" },
  { id: "d4e5f6g7", vendor: "Meridian Logistics",  date: "2026-05-30", lines: 33,  matched: 30, exceptions: 3,  status: "completed" },
  { id: "e5f6g7h8", vendor: "Apex Industrial",     date: "2026-05-28", lines: 67,  matched: 67, exceptions: 0,  status: "completed" },
];

function matchRatePct(matched: number, total: number) {
  return total === 0 ? 0 : Math.round((matched / total) * 100);
}

function StatusPill({ exceptions }: { exceptions: number }) {
  if (exceptions === 0)
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Clean
    </span>;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">
    <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> {exceptions} exception{exceptions !== 1 ? "s" : ""}
  </span>;
}

export default function HistoryPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-60 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">

          {/* Header */}
          <div>
            <h1 className="text-xl font-bold text-slate-900">Reconciliation History</h1>
            <p className="text-sm text-slate-400 mt-0.5">All past reconciliation runs for your company.</p>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  {["Vendor", "Date", "Lines", "Match Rate", "Result", ""].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {MOCK_JOBS.map(job => {
                  const pct = matchRatePct(job.matched, job.lines);
                  return (
                    <tr key={job.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-800">{job.vendor}</p>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{job.id}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{job.date}</td>
                      <td className="px-5 py-4 text-slate-500 tabular-nums">{job.lines}</td>
                      <td className="px-5 py-4 w-40">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct === 100 ? "bg-emerald-500" : pct >= 90 ? "bg-amber-400" : "bg-red-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-slate-600 tabular-nums w-9 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill exceptions={job.exceptions} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                          View report →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <p className="text-xs text-slate-400">{MOCK_JOBS.length} reconciliations</p>
              <p className="text-xs text-slate-300 italic">Live data loads once the API is connected</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
