"use client";

import React, { useCallback, useRef, useState } from "react";

interface DropZoneProps {
  label:       string;
  hint:        string;
  accept:      string;
  icon:        React.ReactNode;
  accentColor: "indigo" | "violet";
  onFile:      (f: File) => void;
  file:        File | null;
}

const accent = {
  indigo: {
    border:  "border-indigo-300",
    bg:      "bg-indigo-50",
    text:    "text-indigo-600",
    badge:   "bg-indigo-100 text-indigo-700",
    ring:    "ring-indigo-300",
    dot:     "bg-indigo-500",
  },
  violet: {
    border:  "border-violet-300",
    bg:      "bg-violet-50",
    text:    "text-violet-600",
    badge:   "bg-violet-100 text-violet-700",
    ring:    "ring-violet-300",
    dot:     "bg-violet-500",
  },
};

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf")                     return "PDF";
  if (["xlsx","xls","ods"].includes(ext!)) return "XLS";
  if (ext === "csv")                     return "CSV";
  return "TXT";
}

function fileSize(bytes: number) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DropZone({ label, hint, accept, icon, accentColor, onFile, file }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const c = accent[accentColor];

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }, [onFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`
        relative cursor-pointer rounded-2xl border-2 border-dashed p-6 transition-all duration-200
        ${file
          ? `border-solid ${c.border} ${c.bg}`
          : dragging
            ? `${c.border} ${c.bg} scale-[1.01] ring-4 ring-offset-0 ${c.ring} ring-opacity-30`
            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />

      {file ? (
        /* ── File selected state ─────────────────────────────────────── */
        <div className="flex items-center gap-4 animate-pop-in">
          <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
            <span className={`text-xs font-black tracking-tight ${c.text}`}>{fileIcon(file.name)}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">{fileSize(file.size)}</p>
          </div>
          <div className={`flex-shrink-0 w-6 h-6 rounded-full ${c.dot} flex items-center justify-center`}>
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      ) : (
        /* ── Empty / drag state ──────────────────────────────────────── */
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <div className={`w-12 h-12 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-300 ${dragging ? c.text : ""} transition-colors`}>
            {dragging
              ? <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              : icon
            }
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">{label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{dragging ? "Drop to upload" : hint}</p>
          </div>
          <span className="text-[10px] font-medium text-slate-300 border border-slate-100 rounded-full px-3 py-0.5">
            PDF · XLSX · CSV · TXT · ODS
          </span>
        </div>
      )}
    </div>
  );
}
