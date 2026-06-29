"use client";

import React, { useEffect, useState } from "react";
import { api, type LineItem } from "@/lib/api";

interface MatchedTableProps {
  jobId:        string;
  matchedCount: number;
}

function fmt(n: number | null) {
  if (n == null) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

const PAGE_SIZE = 50;

export function MatchedTable({ jobId, matchedCount }: MatchedTableProps) {
  const [items, setItems]     = useState<LineItem[]>([]);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.getMatched(jobId, page, PAGE_SIZE)
      .then(data => { if (active) { setItems(data); setError(null); } })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [jobId, page]);

  const totalPages = Math.max(1, Math.ceil(matchedCount / PAGE_SIZE));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-fade-up">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-800">Matched Lines</p>
          <p className="text-xs text-slate-400">
            {matchedCount} invoice{matchedCount !== 1 ? "s" : ""} matched exactly, no action needed
          </p>
        </div>
        <span className="text-xs font-bold rounded-full px-2.5 py-1 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
          All clean
        </span>
      </div>

      {/* Body */}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              {["Invoice ID", "Date", "Supplier Amt", "Ledger Amt", "Balance Due"].map((h, i) => (
                <th key={h} className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 ${i >= 2 ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading && (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(5)].map((_, j) => (
                    <td key={j} className="px-4 py-3.5">
                      <div className="h-3 rounded-full animate-shimmer" />
                    </td>
                  ))}
                </tr>
              ))
            )}

            {!loading && error && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-red-500">{error}</td></tr>
            )}

            {!loading && !error && items.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-300">No matched lines.</td></tr>
            )}

            {!loading && !error && items.map((item, i) => (
              <tr key={`${item.invoice_id}-${i}`} className="hover:bg-emerald-50/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs font-bold text-slate-800 whitespace-nowrap">
                  {item.invoice_id}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                  {item.invoice_date ?? <span className="text-slate-200">-</span>}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                  {fmt(item.supplier_amount)}
                </td>
                <td className="px-4 py-3 text-right text-slate-500 tabular-nums whitespace-nowrap">
                  {fmt(item.ledger_amount)}
                </td>
                <td className="px-4 py-3 text-right text-slate-400 tabular-nums whitespace-nowrap">
                  {fmt(item.balance_due)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
