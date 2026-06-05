"use client";

/**
 * Cross-file column alignment, shown after BOTH files are uploaded.
 * Aligns the vendor statement's columns against the AP ledger's columns by the
 * canonical field they map to, so the user can see at a glance how the two
 * files correspond — and where they differ (a field present in one, missing in
 * the other).
 *
 *   Vendor Statement        Field            AP Ledger
 *   ─────────────────       ───────          ─────────────
 *   Doc_Ref_Num        ←→   Invoice ID  ←→   Invoice_Number
 *   Debit / Credit     ←→   Amount      ←→   Net_Amount
 *   Date               ←→   Invoice Date ←→  (not in ledger)   ⚠ difference
 */

import React from "react";
import type { DetectionResult } from "./ColumnMapper";

interface ColumnAlignmentProps {
  statement: DetectionResult;
  ledger:    DetectionResult;
  statementConfirmed?: Record<string, string> | null;
  ledgerConfirmed?:    Record<string, string> | null;
}

const CANON_LABEL: Record<string, string> = {
  invoice_id:   "Invoice ID",
  amount:       "Amount",
  invoice_date: "Invoice Date",
  balance_due:  "Balance Due",
  description:  "Description",
  po_number:    "PO Number",
};

// Display order; invoice_id + amount first (the fields reconciliation needs).
const FIELD_ORDER = ["invoice_id", "amount", "invoice_date", "balance_due", "description", "po_number"];
const REQUIRED = new Set(["invoice_id", "amount"]);

/** canonical → the raw file column that maps to it (amount may come from debit/credit) */
function canonToRaw(mapping: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [raw, canon] of Object.entries(mapping)) out[canon] = raw;
  // Synthesize an "amount" display when only debit/credit exist
  if (!out["amount"]) {
    if (out["debit"] && out["credit"]) out["amount"] = `${out["debit"]} − ${out["credit"]}`;
    else if (out["debit"])  out["amount"] = out["debit"];
    else if (out["credit"]) out["amount"] = out["credit"];
  }
  return out;
}

export function ColumnAlignment({
  statement, ledger, statementConfirmed, ledgerConfirmed,
}: ColumnAlignmentProps) {
  const sMap = canonToRaw(statementConfirmed ?? statement.mapping);
  const lMap = canonToRaw(ledgerConfirmed ?? ledger.mapping);

  // Only show fields that exist in at least one of the two files
  const fields = FIELD_ORDER.filter(f => sMap[f] || lMap[f]);

  function Cell({ value, side }: { value?: string; side: "stmt" | "ledger" }) {
    if (value) {
      const color = side === "stmt"
        ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
        : "bg-violet-50 text-violet-700 ring-violet-200";
      return (
        <span className={`inline-block truncate rounded-md px-2.5 py-1 text-xs font-mono font-medium ring-1 ${color}`}>
          {value}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs italic text-red-500 bg-red-50 ring-1 ring-red-200">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        not present
      </span>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-fade-up">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100">
        <p className="text-sm font-bold text-slate-800">Column alignment</p>
        <p className="text-xs text-slate-400 mt-0.5">
          How your vendor statement and AP ledger columns line up before matching.
        </p>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_140px_1fr] items-center gap-2 px-5 pt-3 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Vendor Statement</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">Field</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400 text-right">AP Ledger</p>
      </div>

      {/* Alignment rows */}
      <div className="px-5 pb-4 space-y-1.5">
        {fields.map(f => {
          const sVal = sMap[f];
          const lVal = lMap[f];
          const isDiff = !sVal || !lVal;       // present in one but not the other

          return (
            <div
              key={f}
              className={`grid grid-cols-[1fr_140px_1fr] items-center gap-2 rounded-lg py-1.5 px-1 ${
                isDiff ? "bg-red-50/40" : ""
              }`}
            >
              {/* Statement column */}
              <div className="flex justify-start min-w-0">
                <Cell value={sVal} side="stmt" />
              </div>

              {/* Canonical field in the middle */}
              <div className="flex items-center justify-center gap-1">
                <span className={`text-xs font-bold whitespace-nowrap ${REQUIRED.has(f) ? "text-slate-800" : "text-slate-400"}`}>
                  {CANON_LABEL[f] ?? f}
                </span>
              </div>

              {/* Ledger column */}
              <div className="flex justify-end min-w-0">
                <Cell value={lVal} side="ledger" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Difference legend */}
      <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-100 ring-1 ring-red-200" />
          Field present in only one file
        </span>
        <span className="text-[10px] text-slate-400">
          Reconciliation matches on <b className="text-slate-600">Invoice ID</b> + <b className="text-slate-600">Amount</b>
        </span>
      </div>
    </div>
  );
}
