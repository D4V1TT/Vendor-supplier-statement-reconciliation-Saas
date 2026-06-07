"use client";

import React, { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useUser } from "@clerk/nextjs";
import { Sidebar } from "@/components/Sidebar";
import { AuthGuard } from "@/components/AuthGuard";
import { api } from "@/lib/api";

// ── Paddle.js (loaded via the CDN <Script> in the page below) ──────────────────
const PADDLE_ENV   = (process.env.NEXT_PUBLIC_PADDLE_ENV ?? "production") as "sandbox" | "production";
const PADDLE_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";
const PADDLE_PRICE = process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO ?? "";

interface PaddleGlobal {
  Environment: { set: (env: string) => void };
  Initialize: (opts: { token: string }) => void;
  Checkout: {
    open: (opts: {
      items: { priceId: string; quantity: number }[];
      customer?: { email?: string };
      customData?: Record<string, string>;
      settings?: { displayMode?: string; theme?: string; successUrl?: string };
    }) => void;
  };
}
declare global {
  interface Window { Paddle?: PaddleGlobal }
}

// ── Label ↔ backend-value maps ────────────────────────────────────────────────
const CURRENCY_OPTIONS = [
  "USD — US Dollar", "GBP — British Pound", "EUR — Euro",
  "AED — UAE Dirham", "SAR — Saudi Riyal", "CAD — Canadian Dollar", "AUD — Australian Dollar",
];
const LABEL_TO_CURRENCY: Record<string, string> = Object.fromEntries(
  CURRENCY_OPTIONS.map(l => [l, l.split(" ")[0]])
);
const CURRENCY_TO_LABEL: Record<string, string> = Object.fromEntries(
  CURRENCY_OPTIONS.map(l => [l.split(" ")[0], l])
);

const METHOD_OPTIONS = ["Auto (recommended)", "pdfplumber only", "OCR only", "LLM only"];
const LABEL_TO_METHOD: Record<string, string> = {
  "Auto (recommended)": "auto", "pdfplumber only": "pdfplumber", "OCR only": "ocr", "LLM only": "llm",
};
const METHOD_TO_LABEL: Record<string, string> = {
  auto: "Auto (recommended)", pdfplumber: "pdfplumber only", ocr: "OCR only", llm: "LLM only",
};

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

  // Billing
  const [plan, setPlan]         = useState<string | null>(null);  // null = not loaded yet
  const [billingBusy, setBillingBusy] = useState(false);
  const [companyId,   setCompanyId]   = useState("");
  const [paddleReady, setPaddleReady] = useState(false);
  const paddleInit = useRef(false);

  // Seed profile from Clerk on load
  useEffect(() => {
    if (!isLoaded || !user) return;
    setFullName(user.fullName ?? user.firstName ?? "");
    setEmail(user.primaryEmailAddress?.emailAddress ?? "");
  }, [isLoaded, user]);

  // Load the real company name from our backend (Company table). Retries so the
  // company_id (needed for checkout) survives a transient token race on mount.
  useEffect(() => {
    let cancelled = false;
    const load = async (attempt = 0) => {
      try {
        const c = await api.getCompany();
        if (cancelled) return;
        setCompanyName(c.name);
        setCompanyId(c.id);
      } catch {
        if (!cancelled && attempt < 3) setTimeout(() => load(attempt + 1), 600 * (attempt + 1));
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Load company-wide reconciliation settings. Retries on failure, and falls
  // back to "free" after a few tries so the plan never freezes on "Checking…".
  useEffect(() => {
    let cancelled = false;
    const load = async (attempt = 0) => {
      try {
        const st = await api.getSettings();
        if (cancelled) return;
        setCurrency(CURRENCY_TO_LABEL[st.default_currency] ?? "USD — US Dollar");
        setTolerance(String(st.amount_tolerance));
        setPdfMethod(METHOD_TO_LABEL[st.pdf_extraction_method] ?? "Auto (recommended)");
        setFlagCredits(st.flag_unapplied_credits);
        setAutoExport(st.auto_export);
        setPlan((st as any).plan ?? "free");
      } catch {
        if (cancelled) return;
        if (attempt < 3) setTimeout(() => load(attempt + 1), 600 * (attempt + 1));
        else setPlan("free"); // stop the "Checking…" skeleton from sticking forever
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Initialize Paddle.js once the CDN script is available (idempotent).
  function initPaddle() {
    if (paddleInit.current || typeof window === "undefined" || !window.Paddle) return;
    paddleInit.current = true;
    try {
      if (PADDLE_ENV === "sandbox") window.Paddle.Environment.set("sandbox");
      if (PADDLE_TOKEN) window.Paddle.Initialize({ token: PADDLE_TOKEN });
      setPaddleReady(true);
    } catch {
      paddleInit.current = false; // allow a retry on next mount/load
    }
  }

  // If the script was already loaded (e.g. client-side nav), init on mount.
  useEffect(() => {
    if (typeof window !== "undefined" && window.Paddle) initPaddle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleUpgrade() {
    if (!paddleReady || !window.Paddle) {
      alert("Checkout is still loading — please try again in a moment.");
      return;
    }
    if (!PADDLE_TOKEN || !PADDLE_PRICE) {
      alert("Billing isn't configured yet.");
      return;
    }
    window.Paddle.Checkout.open({
      items: [{ priceId: PADDLE_PRICE, quantity: 1 }],
      ...(email ? { customer: { email } } : {}),
      ...(companyId ? { customData: { company_id: companyId } } : {}),
      settings: {
        displayMode: "overlay",
        theme: "light",
        successUrl: `${window.location.origin}/settings?upgraded=1`,
      },
    });
  }

  async function handleManageBilling() {
    setBillingBusy(true);
    try {
      const { url } = await api.openBillingPortal();
      window.location.href = url;        // redirect to Paddle customer portal
    } catch (e: any) {
      alert(e.message ?? "Could not open billing portal.");
      setBillingBusy(false);
    }
  }

  // Load saved notification preferences
  useEffect(() => {
    api.getNotifications()
      .then(p => {
        setNotifyComplete(p.notify_on_completion);
        setNotifyException(p.notify_on_exceptions);
        setNotifyWeekly(p.notify_weekly_digest);
      })
      .catch(() => { /* keep defaults */ });
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
      // Persist notification preferences
      await api.updateNotifications({
        notify_on_completion: notifyComplete,
        notify_on_exceptions: notifyException,
        notify_weekly_digest: notifyWeekly,
      });
      // Persist company-wide reconciliation settings
      await api.updateSettings({
        default_currency:       LABEL_TO_CURRENCY[currency] ?? "USD",
        amount_tolerance:       parseFloat(tolerance) || 0.01,
        pdf_extraction_method:  (LABEL_TO_METHOD[pdfMethod] ?? "auto") as any,
        flag_unapplied_credits: flagCredits,
        auto_export:            autoExport,
      });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (err: any) {
      alert(err?.errors?.[0]?.message ?? err.message ?? "Save failed");
      setSaveState("idle");
    }
  }

  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAll() {
    const ok = window.confirm(
      "Permanently delete ALL reconciliation jobs, statements, and ledger files " +
      "for your company? This cannot be undone."
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await api.deleteAllData();
      const d = res.deleted;
      alert(`Deleted ${d.jobs} jobs, ${d.statements} statements, ${d.ledgers} ledgers (${d.files} files removed).`);
    } catch (err: any) {
      alert(err.message ?? "Delete failed.");
    } finally {
      setDeleting(false);
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

            <Script src="https://cdn.paddle.com/paddle/v2/paddle.js" strategy="afterInteractive" onLoad={initPaddle} />

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
                  options={CURRENCY_OPTIONS}
                />
              </Field>
            </Section>

            {/* Billing */}
            <Section title="Billing & Plan" desc="Your subscription. Pro unlocks AI extraction for the toughest files.">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-700">Current plan</p>
                    {plan === null ? (
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-bold bg-slate-100 text-slate-400 animate-pulse">…</span>
                    ) : (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        plan === "free"
                          ? "bg-slate-100 text-slate-600"
                          : "bg-indigo-100 text-indigo-700"
                      }`}>
                        {plan === "free" ? "Free" : plan.charAt(0).toUpperCase() + plan.slice(1)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {plan === null
                      ? "Checking your subscription…"
                      : plan === "free"
                      ? "Standard parsing (CSV, Excel, clean PDFs, OCR). Upgrade for AI extraction on tough files."
                      : "AI extraction enabled. Manage or cancel anytime."}
                  </p>
                </div>
                {plan === null ? (
                  <div className="h-[42px] w-32 rounded-xl bg-slate-100 animate-pulse" />
                ) : plan === "free" ? (
                  <button
                    onClick={handleUpgrade}
                    disabled={!paddleReady}
                    className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-wait">
                    {paddleReady ? "Upgrade to Pro" : "Loading…"}
                  </button>
                ) : (
                  <button
                    onClick={handleManageBilling}
                    disabled={billingBusy}
                    className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60">
                    {billingBusy ? "Opening…" : "Manage billing"}
                  </button>
                )}
              </div>
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
                  options={METHOD_OPTIONS}
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
                <button
                  onClick={handleDeleteAll}
                  disabled={deleting}
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-60 disabled:cursor-wait">
                  {deleting ? "Deleting…" : "Delete all data"}
                </button>
              </div>
            </div>

          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
