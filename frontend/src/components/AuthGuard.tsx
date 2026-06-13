"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

function Spinner() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
    </div>
  );
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justAccepted, setJustAccepted] = useState(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/login");
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded) return <Spinner />;
  if (!isSignedIn) return null;

  const accepted = justAccepted || Boolean(user?.unsafeMetadata?.termsAccepted);

  async function handleAccept() {
    if (!checked || !user || saving) return;
    setSaving(true);
    try {
      await api.acceptTerms();  // durable proof of consent recorded in our database
      await user.update({
        unsafeMetadata: {
          ...(user.unsafeMetadata ?? {}),
          termsAccepted: true,
          termsAcceptedAt: new Date().toISOString(),
        },
      });
      setJustAccepted(true);
    } catch {
      setSaving(false);
    }
  }

  // Gate: users must accept the Terms & Privacy Policy before using the tool.
  if (!accepted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white shadow-xl p-8 space-y-5">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0120 9.414V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Before you continue</h2>
            <p className="mt-1 text-sm text-slate-500">
              Please review and accept our terms to start using VendorRecon.
            </p>
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-600">
              I have read and agree to the{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">Terms of Service</a>{" "}
              and{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">Privacy Policy</a>.
            </span>
          </label>
          <button
            onClick={handleAccept}
            disabled={!checked || saving}
            className="w-full rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Agree & continue"}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
