/**
 * Renders one exceptions bucket as a sortable, colour-coded table.
 * Used three times on the dashboard — once per exception category.
 */
"use client";

import React, { useState } from "react";
import type { LineItem } from "@/lib/api";

interface ExceptionsTableProps {
  title:    string;
  items:    LineItem[];
  color:    "red" | "amber" | "purple";
}

const headerColor = {
  red:    "bg-red-50   text-red-800   border-red-200",
  amber:  "bg-amber-50 text-amber-800 border-amber-200",
  purple: "bg-purple-50 text-purple-800 border-purple-200",
};

const badgeColor = {
  red:    "bg-red-100   text-red-700",
  amber:  "bg-amber-100 text-amber-700",
  purple: "bg-purple-100 text-purple-700",
};

export function ExceptionsTable({ title, items, color }: ExceptionsTableProps) {
  const [expanded, setExpanded] = useState(true);

  if (items.length === 0) return null;

  return (
    <section className="rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* ── Section header ─────────────────────────────────────────────────── */}
      <div
        className={`flex items-center justify-between px-5 py-3 border-b cursor-pointer ${headerColor[color]}`}
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="font-semibold text-sm">{title}</h3>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badgeColor[color]}`}>
            {items.length}
          </span>
          <span className="text-xs opacity-60">{expanded ? "▲ collapse" : "▼ expand"}</span>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left">Invoice ID</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-right">Supplier Amt</th>
                <th className="px-4 py-2 text-right">Ledger Amt</th>
                <th className="px-4 py-2 text-right">Variance</th>
                <th className="px-4 py-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.invoice_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 font-mono font-medium text-slate-800">
                    {item.invoice_id}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                    {item.invoice_date ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {fmt(item.supplier_amount)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                    {item.ledger_amount != null ? fmt(item.ledger_amount) : "—"}
                  </td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${varianceColor(item.variance)}`}>
                    {item.variance != null ? `${item.variance > 0 ? "+" : ""}${fmt(item.variance)}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs max-w-xs truncate">
                    {item.notes || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 2,
  }).format(n);
}

function varianceColor(v: number | null) {
  if (v == null) return "text-slate-400";
  if (v > 0) return "text-red-600";
  if (v < 0) return "text-emerald-600";
  return "text-slate-400";
}
