"use client";

import React, { useState } from "react";
import type { LineItem } from "@/lib/api";

interface ExceptionsTableProps {
  title:       string;
  description: string;
  items:       LineItem[];
  color:       "red" | "amber" | "violet";
  icon:        React.ReactNode;
}

const palette = {
  red: {
    header:  "bg-red-50 border-red-100",
    title:   "text-red-900",
    desc:    "text-red-400",
    badge:   "bg-red-100 text-red-600",
    iconBg:  "bg-red-100 text-red-500",
    rowHover:"hover:bg-red-50/40",
    varPos:  "bg-red-50 text-red-700 ring-1 ring-red-200",
    varNeg:  "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  },
  amber: {
    header:  "bg-amber-50 border-amber-100",
    title:   "text-amber-900",
    desc:    "text-amber-400",
    badge:   "bg-amber-100 text-amber-600",
    iconBg:  "bg-amber-100 text-amber-500",
    rowHover:"hover:bg-amber-50/40",
    varPos:  "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    varNeg:  "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  },
  violet: {
    header:  "bg-violet-50 border-violet-100",
    title:   "text-violet-900",
    desc:    "text-violet-400",
    badge:   "bg-violet-100 text-violet-600",
    iconBg:  "bg-violet-100 text-violet-500",
    rowHover:"hover:bg-violet-50/40",
    varPos:  "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
    varNeg:  "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  },
};

type SortKey = "invoice_id" | "supplier_amount" | "variance";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <span className={`ml-1 inline-block transition-transform ${active ? "opacity-100" : "opacity-20"}`}>
      {dir === "asc" ? "↑" : "↓"}
    </span>
  );
}

export function ExceptionsTable({ title, description, items, color, icon }: ExceptionsTableProps) {
  const [open, setOpen]       = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("invoice_id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const c = palette[color];

  if (items.length === 0) return null;

  const sorted = [...items].sort((a, b) => {
    let av: any = a[sortKey] ?? "";
    let bv: any = b[sortKey] ?? "";
    if (sortKey === "invoice_id") { av = av.toString(); bv = bv.toString(); }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ?  1 : -1;
    return 0;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const totalSupplier = items.reduce((s, i) => s + i.supplier_amount, 0);

  return (
    <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-up">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-4 px-5 py-4 border-b text-left transition-colors ${c.header}`}
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${c.iconBg}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${c.title}`}>{title}</p>
          <p className={`text-xs mt-0.5 ${c.desc}`}>{description}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className={`text-xs font-semibold ${c.title}`}>{fmt(totalSupplier)}</p>
            <p className={`text-[10px] ${c.desc}`}>total supplier value</p>
          </div>
          <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${c.badge}`}>
            {items.length} item{items.length !== 1 ? "s" : ""}
          </span>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {open && (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                {[
                  { key: "invoice_id",      label: "Invoice ID" },
                  { key: null,              label: "Date" },
                  { key: "supplier_amount", label: "Supplier Amt" },
                  { key: null,              label: "Ledger Amt" },
                  { key: "variance",        label: "Variance" },
                  { key: null,              label: "Notes" },
                ].map(({ key, label }) => (
                  <th
                    key={label}
                    onClick={() => key && handleSort(key as SortKey)}
                    className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap
                      ${key ? "cursor-pointer select-none hover:text-slate-600" : ""}
                      ${label === "Supplier Amt" || label === "Ledger Amt" || label === "Variance" ? "text-right" : ""}
                    `}
                  >
                    {label}
                    {key && <SortIcon active={sortKey === key} dir={sortDir} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map((item, i) => (
                <tr
                  key={`${item.invoice_id}-${i}`}
                  className={`transition-colors ${c.rowHover}`}
                >
                  {/* Invoice ID */}
                  <td className="px-4 py-3 font-mono text-xs font-bold text-slate-800 whitespace-nowrap">
                    {item.invoice_id}
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                    {item.invoice_date ?? <span className="text-slate-200">—</span>}
                  </td>

                  {/* Supplier Amount */}
                  <td className="px-4 py-3 text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                    {fmt(item.supplier_amount)}
                  </td>

                  {/* Ledger Amount */}
                  <td className="px-4 py-3 text-right text-slate-400 tabular-nums whitespace-nowrap">
                    {item.ledger_amount != null
                      ? fmt(item.ledger_amount)
                      : <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-300">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Not found
                        </span>
                    }
                  </td>

                  {/* Variance badge */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {item.variance != null ? (
                      <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold tabular-nums ${item.variance > 0 ? c.varPos : item.variance < 0 ? c.varNeg : "text-slate-300"}`}>
                        {item.variance > 0 ? "+" : ""}{fmt(item.variance)}
                      </span>
                    ) : (
                      <span className="text-slate-200">—</span>
                    )}
                  </td>

                  {/* Notes */}
                  <td className="px-4 py-3 text-xs text-slate-400 max-w-xs">
                    <span className="line-clamp-2">{item.notes || "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Totals footer */}
            <tfoot>
              <tr className="border-t border-slate-100 bg-slate-50/60">
                <td colSpan={2} className="px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Totals
                </td>
                <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-700 tabular-nums">
                  {fmt(totalSupplier)}
                </td>
                <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-500 tabular-nums">
                  {fmt(items.reduce((s, i) => s + (i.ledger_amount ?? 0), 0))}
                </td>
                <td className="px-4 py-2.5 text-right text-xs font-bold tabular-nums">
                  {(() => {
                    const v = items.reduce((s, i) => s + (i.variance ?? 0), 0);
                    return <span className={v > 0 ? "text-red-600" : v < 0 ? "text-emerald-600" : "text-slate-300"}>
                      {v > 0 ? "+" : ""}{fmt(v)}
                    </span>;
                  })()}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
