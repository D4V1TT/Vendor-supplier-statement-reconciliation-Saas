"use client";

import React from "react";

const STEPS = [
  { id: "uploading", label: "Uploading files",       desc: "Encrypting & storing securely" },
  { id: "extracting", label: "Extracting data",      desc: "Parsing vendor statement" },
  { id: "matching",   label: "Running reconciliation", desc: "Matching invoice lines" },
  { id: "done",       label: "Report ready",          desc: "Exceptions identified" },
];

type StepId = "uploading" | "extracting" | "matching" | "done";

interface Props { current: StepId; }

export function ProgressStepper({ current }: Props) {
  const currentIdx = STEPS.findIndex(s => s.id === current);

  return (
    <div className="w-full max-w-lg mx-auto px-4">
      <div className="flex items-center gap-0">
        {STEPS.map((step, i) => {
          const done    = i < currentIdx;
          const active  = i === currentIdx;
          const pending = i > currentIdx;

          return (
            <React.Fragment key={step.id}>
              {/* Step node */}
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                    done    ? "bg-indigo-600 border-indigo-600"
                    : active ? "bg-white border-indigo-500 ring-4 ring-indigo-100"
                    :          "bg-white border-slate-200"
                  }`}
                >
                  {done ? (
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : active ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-slate-200" />
                  )}
                </div>
                <div className="text-center w-20">
                  <p className={`text-[11px] font-semibold leading-tight ${active ? "text-indigo-700" : done ? "text-slate-700" : "text-slate-300"}`}>
                    {step.label}
                  </p>
                  {active && (
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{step.desc}</p>
                  )}
                </div>
              </div>

              {/* Connector */}
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-1 mb-7 relative overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="absolute inset-y-0 left-0 bg-indigo-500 transition-all duration-700 ease-out"
                    style={{ width: done ? "100%" : active ? "50%" : "0%" }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export type { StepId };
