"use client";

import React from "react";

interface KpiCardProps {
  title:    string;
  value:    string | number;
  sub?:     string;
  icon:     React.ReactNode;
  variant?: "neutral" | "danger" | "warning" | "success";
  ring?:    number; // 0–100, draws a tiny arc indicator
}

const styles = {
  neutral: { card: "bg-white border-slate-200",             icon: "bg-slate-100 text-slate-500",    value: "text-slate-900",   sub: "text-slate-400" },
  danger:  { card: "bg-white border-red-100",               icon: "bg-red-50 text-red-500",         value: "text-red-700",     sub: "text-red-400" },
  warning: { card: "bg-white border-amber-100",             icon: "bg-amber-50 text-amber-500",     value: "text-amber-700",   sub: "text-amber-400" },
  success: { card: "bg-white border-emerald-100",           icon: "bg-emerald-50 text-emerald-500", value: "text-emerald-700", sub: "text-emerald-400" },
};

const ringColor = {
  neutral: "#94a3b8",
  danger:  "#ef4444",
  warning: "#f59e0b",
  success: "#10b981",
};

function RingIndicator({ pct, color }: { pct: number; color: string }) {
  const r = 16;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r={r} fill="none" stroke="#f1f5f9" strokeWidth="4" />
      <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
    </svg>
  );
}

export function KpiCard({ title, value, sub, icon, variant = "neutral", ring }: KpiCardProps) {
  const s = styles[variant];
  return (
    <div className={`rounded-2xl border p-5 shadow-sm animate-fade-up ${s.card}`}>
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.icon}`}>
          {icon}
        </div>
        {ring !== undefined && (
          <RingIndicator pct={ring} color={ringColor[variant]} />
        )}
      </div>
      <p className={`mt-4 text-3xl font-extrabold tabular-nums tracking-tight ${s.value}`}>
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
      {sub && <p className={`mt-1 text-xs ${s.sub}`}>{sub}</p>}
    </div>
  );
}
