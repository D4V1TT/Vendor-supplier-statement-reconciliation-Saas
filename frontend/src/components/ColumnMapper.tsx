"use client";

/**
 * Column Mapper — shown when auto-detection confidence is low.
 * Lets the user confirm or correct which file columns map to
 * invoice_id, amount, invoice_date, and balance_due.
 */

import React, { useState } from "react";

export interface DetectionResult {
  raw_columns:             string[];
  mapping:                 Record<string, string>;   // raw → canonical
  confidence:              Record<string, number>;   // canonical → 0–1
  overall_confidence:      number;
  needs_user_confirmation: boolean;
  missing_required:        string[];
  method:                  string;
  sample_rows:             Record<string, unknown>[];
}

interface ColumnMapperProps {
  label:      string;             // "Vendor Statement" | "AP Ledger"
  detection:  DetectionResult;
  onConfirm:  (mapping: Record<string, string>) => void;  // raw → canonical
  onCancel:   () => void;
}

const CANONICAL_LABELS: Record<string, { label: string; required: boolean; hint: string }> = {
  invoice_id:   { label: "Invoice / Reference ID", required: true,  hint: "Unique identifier for each invoice" },
  amount:       { label: "Amount",                  required: true,  hint: "Invoice or transaction value" },
  invoice_date: { label: "Invoice Date",            required: false, hint: "Date the invoice was issued" },
  balance_due:  { label: "Balance Due",             required: false, hint: "Outstanding balance (if present)" },
};

function confidenceBadge(conf: number | undefined) {
  if (conf === undefined) return null;
  const pct  = Math.round(conf * 100);
  const color = conf >= 0.85 ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : conf >= 0.65 ? "bg-amber-50 text-amber-700 ring-amber-200"
              :                "bg-red-50 text-red-700 ring-red-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${color}`}>
      {pct}% confidence
    </span>
  );
}

export function ColumnMapper({ label, detection, onConfirm, onCancel }: ColumnMapperProps) {
  // Build initial selection: invert the mapping (canonical → raw)
  const canonicalToRaw = Object.fromEntries(
    Object.entries(detection.mapping).map(([raw, canon]) => [canon, raw])
  );

  const [selections, setSelections] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.keys(CANONICAL_LABELS).map(canon => [canon, canonicalToRaw[canon] ?? ""])
    )
  );

  const missingRequired = Object.entries(CANONICAL_LABELS)
    .filter(([canon, meta]) => meta.required && !selections[canon])
    .map(([canon]) => canon);

  function handleConfirm() {
    // Build raw → canonical mapping from user selections (skip empty)
    const finalMapping: Record<string, string> = {};
    for (const [canon, raw] of Object.entries(selections)) {
      if (raw) finalMapping[raw] = canon;
    }
    onConfirm(finalMapping);
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 overflow-hidden animate-pop-in">
      {/* Header */}
      <div className="flex items-start gap-3 px-5 py-4 border-b border-amber-200 bg-amber-50">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-900">Confirm column mapping — {label}</p>
          <p className="text-xs text-amber-600 mt-0.5">
            We detected the columns below automatically
            {detection.method !== "keyword" ? ` using ${detection.method} analysis` : ""}.
            Please confirm or correct before continuing.
          </p>
        </div>
      </div>

      {/* Mapping rows */}
      <div className="px-5 py-4 space-y-3 bg-white">
        {Object.entries(CANONICAL_LABELS).map(([canon, meta]) => {
          const conf = detection.confidence[canon];
          return (
            <div key={canon} className="flex items-center gap-4">
              <div className="w-44 flex-shrink-0">
                <p className="text-xs font-semibold text-slate-700">
                  {meta.label}
                  {meta.required && <span className="text-red-500 ml-0.5">*</span>}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{meta.hint}</p>
              </div>
              <div className="flex-1 flex items-center gap-2">
                <select
                  value={selections[canon] ?? ""}
                  onChange={e => setSelections(s => ({ ...s, [canon]: e.target.value }))}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all
                    ${!selections[canon] && meta.required
                      ? "border-red-300 bg-red-50"
                      : "border-slate-200 bg-slate-50"
                    }`}
                >
                  <option value="">— not in this file —</option>
                  {detection.raw_columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
                {confidenceBadge(conf)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sample preview */}
      {detection.sample_rows.length > 0 && (
        <div className="px-5 pb-4 bg-white">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Sample data from your file
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-100 bg-slate-50">
            <table className="text-xs w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  {detection.raw_columns.map(col => (
                    <th key={col} className="px-3 py-2 text-left font-semibold text-slate-400 whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {detection.sample_rows.slice(0, 3).map((row, i) => (
                  <tr key={i}>
                    {detection.raw_columns.map(col => (
                      <td key={col} className="px-3 py-1.5 text-slate-600 whitespace-nowrap">
                        {String(row[col] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-4 border-t border-amber-100 bg-amber-50/60">
        <button
          onClick={onCancel}
          className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
        >
          ← Change file
        </button>
        <button
          onClick={handleConfirm}
          disabled={missingRequired.length > 0}
          className={`rounded-xl px-5 py-2 text-sm font-bold transition-all
            ${missingRequired.length > 0
              ? "bg-slate-100 text-slate-300 cursor-not-allowed"
              : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
            }`}
        >
          {missingRequired.length > 0
            ? `Missing: ${missingRequired.join(", ")}`
            : "Confirm mapping →"
          }
        </button>
      </div>
    </div>
  );
}
