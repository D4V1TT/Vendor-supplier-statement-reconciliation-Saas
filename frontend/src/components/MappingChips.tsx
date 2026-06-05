"use client";

/**
 * Split-view preview of column matching, shown under each drop zone BEFORE
 * execution. Left column = the file's original columns; right column = the
 * canonical field each was matched to (or "ignored" if unmapped). Lets the
 * user confirm the mapping before running, with an Edit button for corrections.
 */

import React from "react";
import type { DetectionResult } from "./ColumnMapper";

interface MappingChipsProps {
  detection: DetectionResult;
  /** raw→canonical the user confirmed (overrides detection.mapping if present) */
  confirmed?: Record<string, string> | null;
  onEdit: () => void;
}

// Pretty labels for canonical fields
const CANON_LABEL: Record<string, string> = {
  invoice_id:   "Invoice ID",
  amount:       "Amount",
  debit:        "Debit",
  credit:       "Credit",
  invoice_date: "Invoice Date",
  balance_due:  "Balance Due",
  description:  "Description",
  po_number:    "PO Number",
};

const REQUIRED = new Set(["invoice_id", "amount"]);

export function MappingChips({ detection, confirmed, onEdit }: MappingChipsProps) {
  const activeMapping = confirmed ?? detection.mapping;   // raw → canonical
  const lowConfidence = detection.needs_user_confirmation && !confirmed;

  // amount is satisfied directly OR via debit/credit
  const mappedCanon = new Set(Object.values(activeMapping));
  const amountOk = mappedCanon.has("amount") || mappedCanon.has("debit") || mappedCanon.has("credit");

  return (
    <div className={`rounded-xl border ${lowConfidence ? "border-amber-200 bg-amber-50/40" : "border-slate-100 bg-slate-50/60"}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Column matching
          {detection.method !== "alias" && (
            <span className="ml-1.5 text-slate-300 normal-case">via {detection.method}</span>
          )}
        </p>
        <button
          type="button"
          onClick={onEdit}
          className={`text-[10px] font-semibold transition-colors ${
            lowConfidence ? "text-amber-600 hover:text-amber-800" : "text-indigo-600 hover:text-indigo-800"
          }`}
        >
          {lowConfidence ? "Review ⚠" : "Edit"}
        </button>
      </div>

      {/* Split-view column headers */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-3 pt-2 pb-1">
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-300">Your file column</p>
        <span className="w-4" />
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-300">Matched to</p>
      </div>

      {/* One row per file column */}
      <div className="px-3 pb-2.5 space-y-1">
        {detection.raw_columns.map((rawCol) => {
          const canon = activeMapping[rawCol];          // canonical it maps to
          const mapped = !!canon;
          return (
            <div key={rawCol} className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
              {/* Left: file column */}
              <span className="truncate rounded-md bg-white px-2 py-1 text-[11px] font-mono font-medium text-slate-700 ring-1 ring-slate-200">
                {rawCol}
              </span>

              {/* Arrow */}
              <svg className={`w-3.5 h-3.5 ${mapped ? "text-indigo-400" : "text-slate-200"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>

              {/* Right: canonical field (or ignored) */}
              {mapped ? (
                <span className={`truncate rounded-md px-2 py-1 text-[11px] font-semibold ring-1 ${
                  REQUIRED.has(canon)
                    ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
                    : "bg-slate-100 text-slate-600 ring-slate-200"
                }`}>
                  {CANON_LABEL[canon] ?? canon}
                </span>
              ) : (
                <span className="truncate rounded-md bg-transparent px-2 py-1 text-[11px] italic text-slate-300">
                  ignored
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Required-field warning */}
      {(!mappedCanon.has("invoice_id") || !amountOk) && (
        <div className="px-3 pb-2.5">
          <p className="text-[10px] font-semibold text-red-600">
            Missing required field{!mappedCanon.has("invoice_id") && !amountOk ? "s" : ""}:{" "}
            {[!mappedCanon.has("invoice_id") && "Invoice ID", !amountOk && "Amount"].filter(Boolean).join(", ")}
            {" "}— click Edit to map.
          </p>
        </div>
      )}
    </div>
  );
}
