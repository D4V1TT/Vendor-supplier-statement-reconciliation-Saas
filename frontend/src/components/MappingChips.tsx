"use client";

/**
 * Compact, always-visible preview of how a file's columns were mapped to the
 * canonical fields. Shown under each drop zone after detection so the user can
 * confirm the mapping BEFORE running the reconciliation. Includes an Edit button
 * that opens the full ColumnMapper for corrections.
 */

import React from "react";
import type { DetectionResult } from "./ColumnMapper";

interface MappingChipsProps {
  detection: DetectionResult;
  /** raw→canonical the user confirmed (overrides detection.mapping if present) */
  confirmed?: Record<string, string> | null;
  onEdit: () => void;
}

// Canonical fields we surface to the user, in display order.
const FIELDS: { key: string; label: string; required: boolean }[] = [
  { key: "invoice_id",   label: "Invoice ID",  required: true  },
  { key: "amount",       label: "Amount",      required: true  },
  { key: "debit",        label: "Debit",       required: false },
  { key: "credit",       label: "Credit",      required: false },
  { key: "invoice_date", label: "Date",        required: false },
  { key: "balance_due",  label: "Balance Due", required: false },
];

export function MappingChips({ detection, confirmed, onEdit }: MappingChipsProps) {
  // Build canonical → raw lookup from the active mapping
  const activeMapping = confirmed ?? detection.mapping;
  const canonToRaw: Record<string, string> = {};
  for (const [raw, canon] of Object.entries(activeMapping)) canonToRaw[canon] = raw;

  // amount may be satisfied by debit/credit instead of a direct amount column
  const hasAmount = !!(canonToRaw["amount"] || canonToRaw["debit"] || canonToRaw["credit"]);

  const lowConfidence = detection.needs_user_confirmation && !confirmed;

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${lowConfidence ? "border-amber-200 bg-amber-50/50" : "border-slate-100 bg-slate-50/60"}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Detected columns
          {detection.method !== "alias" && (
            <span className="ml-1.5 text-slate-300 normal-case">via {detection.method}</span>
          )}
        </p>
        <button
          type="button"
          onClick={onEdit}
          className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          {lowConfidence ? "Review ⚠" : "Edit"}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FIELDS.map(({ key, label, required }) => {
          const raw = canonToRaw[key];
          // Skip optional fields that weren't found (keeps it clean)
          if (!raw && !required) return null;

          const found = !!raw;
          // For amount: show satisfied if debit/credit present
          const amountOk = key === "amount" && hasAmount;
          const ok = found || amountOk;

          return (
            <span
              key={key}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium ring-1 ${
                ok
                  ? "bg-white text-slate-700 ring-slate-200"
                  : "bg-red-50 text-red-600 ring-red-200"
              }`}
            >
              <span className="text-slate-400">{label}</span>
              <svg className="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              {ok ? (
                <span className="font-mono font-semibold text-slate-800">
                  {raw ?? (canonToRaw["debit"] && canonToRaw["credit"] ? "Debit − Credit" : canonToRaw["debit"] ?? canonToRaw["credit"])}
                </span>
              ) : (
                <span className="font-semibold">not found</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
