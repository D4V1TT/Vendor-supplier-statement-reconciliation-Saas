"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Sidebar } from "@/components/Sidebar";
import { AuthGuard } from "@/components/AuthGuard";
import { api } from "@/lib/api";

// ── Reusable field layout ─────────────────────────────────────────────────────
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

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? "bg-indigo-600" : "bg-slate-200"}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function TextInput({ value, onChange, placeholder, type = "text", disabled }: {
  value: string; onChange?: (v: string) => void;
  placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700
        focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all
        disabled:opacity-50 disabled:cursor-not-allowed"
    />
  );
}

function Select({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700
        focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
    >
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, isLoaded } = useUser();

  // Profile state — seeded from Clerk once loaded
  const [fullName,  setFullName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Company / prefs state
  const [companyName, setCompanyName] = useState("");
  const [currency,    setCurrency]    = useState("USD — US Dollar");
  const [tolerance,   setTolerance]   = useState("0.01");
  const [pdfMethod,   setPdfMethod]   = useState("Auto (recommended)");

  // Notification toggles
  const [notifyComplete,  setNotifyComplete]  = useState(true);
  const [notifyException, setNotifyException] = useState(true);
  const [notifyWeekly,    setNotifyWeekly]    = useState(false);
  const [autoExport,      setAutoExport]      = useState(false);
  const [flagCredits,     setFlagCredits]     = useState(true);

  // Seed profile from Clerk on load
  useEffect(() => {
    if (!isLoaded || !user) return;
    setFullName(user.fullName ?? user.firstName ?? "");
    setEmail(user.primaryEmailAddress?.emailAddress ?? "");
  }, [isLoaded, user]);

  // Load the real company name from our backend (Company table)
  useEffect(() => {
    api.getCompany()
      .then(c => setCompanyName(c.name))
      .catch(() => { /* leave blank if not reachable yet */ });
  }, []);

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  async function handleSave() {
    setSaveState("saving");
    try {
      // Update Clerk profile
      await user?.update({
        firstName: fullName.split(" ")[0] ?? fullName,
        lastName:  fullName.split(" ").slice(1).join(" ") || undefined,
      });
      // Update password if provided
      if (newPassword.length >= 8) {
        await user?.updatePassword({ newPassword });
        setNewPassword("");
      }
      // Persist company name to our backend (used on exported reports)
      if (companyName.trim()) {
        await api.updateCompany(companyName.trim());
      }
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (err: any) {
      alert(err?.errors?.[0]?.message ?? err.message ?? "Save failed");
      setSaveState("idle");
    }
  }

  if (!isLoaded) {
    return (
      <AuthGuard>
        <div className="flex h-screen overflow-hidden bg-slate-50">
          <Sidebar />
          <main className="flex-1 ml-60 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
          </main>
        </div>
      </AuthGuard>
    );
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
                disabled={saveState === "saving"}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition-all
                  ${saveState === "saved"   ? "bg-emerald-500 text-white"
                  : saveState === "saving"  ? "bg-indigo-400 text-white cursor-wait"
                  :                           "bg-indigo-600 text-white hover:bg-indigo-700"}`}
              >
                {saveState === "saving" && (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                )}
                {saveState === "saved" && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : "Save changes"}
              </button>
            </div>

            {/* Profile */}
            <Section title="Profile" desc="Your personal account details — synced with your sign-in provider.">
              {/* Avatar */}
              <div className="flex items-center gap-4 pb-2">
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt={fullName}
                    className="w-14 h-14 rounded-full object-cover ring-2 ring-slate-100" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold">
                    {fullName.slice(0, 2).toUpperCase() || "?"}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-800">{fullName || "—"}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{email}</p>
                  {user?.externalAccounts?.[0] && (
                    <span className="inline-flex items-center gap-1 mt-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      Signed in via {user.externalAccounts[0].provider}
                    </span>
                  )}
                </div>
              </div>

              <Field label="Full name">
                <TextInput value={fullName} onChange={setFullName} placeholder="Your name" />
              </Field>
              <Field label="Email address" hint="Managed by your sign-in provider">
                <TextInput value={email} disabled />
              </Field>
              <Field label="New password" hint="Minimum 8 characters — leave blank to keep current">
                <TextInput
                  type="password"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="New password"
                  disabled={!!user?.externalAccounts?.length}
                />
                {!!user?.externalAccounts?.length && (
                  <p className="text-[10px] text-slate-400 mt-1">Password change not available for social sign-in accounts.</p>
                )}
              </Field>
            </Section>

            {/* Company */}
            <Section title="Company" desc="Your organisation details used across all reconciliations and exports.">
              <Field label="Company name" hint="Shown on exported Excel reports">
                <TextInput value={companyName} onChange={setCompanyName} placeholder="Your company" />
              </Field>
              <Field label="Default currency" hint="Used for variance calculations">
                <Select
                  value={currency}
                  onChange={setCurrency}
                  options={["USD — US Dollar", "GBP — British Pound", "EUR — Euro", "AED — UAE Dirham", "SAR — Saudi Riyal", "CAD — Canadian Dollar", "AUD — Australian Dollar"]}
                />
              </Field>
            </Section>

            {/* Reconciliation */}
            <Section title="Reconciliation" desc="Default rules applied to every reconciliation run.">
              <Field label="Amount tolerance" hint="Differences ≤ this value are treated as matched">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400 font-medium">$</span>
                  <input
                    type="number"
                    value={tolerance}
                    onChange={e => setTolerance(e.target.value)}
                    step="0.01" min="0" max="100"
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700
                      focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                  />
                </div>
              </Field>
              <Field label="PDF extraction method" hint="Strategy used when parsing vendor statements">
                <Select
                  value={pdfMethod}
                  onChange={setPdfMethod}
                  options={["Auto (recommended)", "pdfplumber only", "OCR only", "LLM only"]}
                />
              </Field>
              <Field label="Flag unapplied credits" hint="Mark credit notes not in the ledger as exceptions">
                <Toggle value={flagCredits} onChange={setFlagCredits} />
              </Field>
              <Field label="Auto-export on completion" hint="Download Excel report automatically when job finishes">
                <Toggle value={autoExport} onChange={setAutoExport} />
              </Field>
            </Section>

            {/* Notifications */}
            <Section title="Notifications" desc="Control when you receive reconciliation alerts.">
              <Field label="Email on completion" hint="Send email when a reconciliation job finishes">
                <Toggle value={notifyComplete} onChange={setNotifyComplete} />
              </Field>
              <Field label="Email on exceptions found" hint="Alert when discrepancies are detected">
                <Toggle value={notifyException} onChange={setNotifyException} />
              </Field>
              <Field label="Weekly digest" hint="Summary of all reconciliations every Monday">
                <Toggle value={notifyWeekly} onChange={setNotifyWeekly} />
              </Field>
            </Section>

            {/* Danger zone */}
            <div className="rounded-2xl border border-red-100 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-red-100">
                <p className="text-sm font-bold text-red-700">Danger Zone</p>
                <p className="text-xs text-red-400 mt-0.5">These actions are permanent and cannot be undone.</p>
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
