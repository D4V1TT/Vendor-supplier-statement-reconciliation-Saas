/**
 * KPI summary card — used across the dashboard header row.
 */
import React from "react";

interface KpiCardProps {
  title:    string;
  value:    string | number;
  sub?:     string;
  variant?: "neutral" | "danger" | "warning" | "success";
}

const variantStyles: Record<string, string> = {
  neutral: "border-slate-200 bg-white",
  danger:  "border-red-200   bg-red-50",
  warning: "border-amber-200 bg-amber-50",
  success: "border-emerald-200 bg-emerald-50",
};

const valueStyles: Record<string, string> = {
  neutral: "text-slate-800",
  danger:  "text-red-700",
  warning: "text-amber-700",
  success: "text-emerald-700",
};

export function KpiCard({ title, value, sub, variant = "neutral" }: KpiCardProps) {
  return (
    <div className={`rounded-xl border p-5 shadow-sm ${variantStyles[variant]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${valueStyles[variant]}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
