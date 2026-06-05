"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { AuthGuard } from "@/components/AuthGuard";

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
      </div>
      <div className="px-6 py-5 space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-8">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </div>
      <div className="flex-shrink-0 w-64">{children}</div>
    </div>
  );
}

function Toggle({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      onClick={() => setOn(o => !o)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? "bg-indigo-600" : "bg-slate-200"}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function TextInput({ placeholder, defaultValue }: { placeholder?: string; defaultValue?: string }) {
  return (
    <input
      type="text"
      defaultValue={defaultValue}
      placeholder={placeholder}
      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
    />
  );
}

function Select({ options, defaultValue }: { options: string[]; defaultValue?: string }) {
  return (
    <select
      defaultValue={defaultValue}
      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
    >
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  );
}

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <AuthGuard>
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-60 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Settings</h1>
              <p className="text-sm text-slate-400 mt-0.5">Manage your workspace and reconciliation preferences.</p>
            </div>
            <button
              onClick={handleSave}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition-all ${
                saved
                  ? "bg-emerald-500 text-white"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
            >
              {saved ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </>
              ) : "Save changes"}
            </button>
          </div>

          {/* Company */}
          <Section title="Company" desc="Your organisation details used across all reconciliations.">
            <Field label="Company name" hint="Shown on exported reports">
              <TextInput defaultValue="Acme Corp" />
            </Field>
            <Field label="Default currency" hint="Used for variance calculations">
              <Select options={["USD — US Dollar", "GBP — British Pound", "EUR — Euro", "AED — UAE Dirham"]} defaultValue="USD — US Dollar" />
            </Field>
          </Section>

          {/* Profile */}
          <Section title="Profile" desc="Your personal account settings.">
            <Field label="Full name">
              <TextInput defaultValue="Finance Team" />
            </Field>
            <Field label="Email address">
              <TextInput defaultValue="finance@company.com" />
            </Field>
            <Field label="Change password" hint="Leave blank to keep current password">
              <input
                type="password"
                placeholder="New password"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
              />
            </Field>
          </Section>

          {/* Reconciliation */}
          <Section title="Reconciliation" desc="Default rules applied to every reconciliation run.">
            <Field label="Amount tolerance" hint="Differences below this value are treated as matched">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">$</span>
                <input
                  type="number"
                  defaultValue="0.01"
                  step="0.01"
                  min="0"
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                />
              </div>
            </Field>
            <Field label="PDF extraction method" hint="Strategy used when parsing vendor statements">
              <Select options={["Auto (recommended)", "pdfplumber only", "OCR only", "LLM only"]} />
            </Field>
            <Field label="Flag unapplied credits" hint="Mark negative amounts not in the ledger as exceptions">
              <Toggle defaultOn={true} />
            </Field>
            <Field label="Auto-export on completion" hint="Automatically generate Excel report when job finishes">
              <Toggle defaultOn={false} />
            </Field>
          </Section>

          {/* Notifications */}
          <Section title="Notifications" desc="Control when you receive reconciliation alerts.">
            <Field label="Email on completion" hint="Send email when a reconciliation job finishes">
              <Toggle defaultOn={true} />
            </Field>
            <Field label="Email on exceptions found" hint="Send alert when exceptions are detected">
              <Toggle defaultOn={true} />
            </Field>
            <Field label="Weekly summary" hint="Receive a weekly digest of all reconciliations">
              <Toggle defaultOn={false} />
            </Field>
          </Section>

          {/* Danger zone */}
          <div className="rounded-2xl border border-red-100 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-red-100">
              <p className="text-sm font-bold text-red-700">Danger Zone</p>
              <p className="text-xs text-red-400 mt-0.5">These actions are irreversible.</p>
            </div>
            <div className="px-6 py-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Delete all reconciliation data</p>
                <p className="text-xs text-slate-400 mt-0.5">Permanently removes all jobs, statements, and ledger files.</p>
              </div>
              <button className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors">
                Delete all data
              </button>
            </div>
          </div>

        </div>
      </main>
    </div>
    </AuthGuard>
  );
}
