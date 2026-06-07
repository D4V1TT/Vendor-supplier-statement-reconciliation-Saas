import { PublicFooter } from "@/components/LegalShell";
import { SignedIn, SignedOut } from "@clerk/nextjs";

export const metadata = { title: "Pricing — VendorRecon" };

const FREE = [
  "CSV, Excel & clean-PDF reconciliation",
  "OCR for scanned statements",
  "Exceptions dashboard (mismatches, missing, duplicates, credits)",
  "Excel export of results",
  "Limited reconciliations per month",
];

const PRO = [
  "Everything in Free",
  "AI extraction for messy & scanned files",
  "Unlimited reconciliations",
  "Email alerts on completion & exceptions",
  "Priority email support",
];

function Check() {
  return (
    <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col">
      <header className="border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="font-extrabold text-indigo-600">VendorRecon</a>
          <SignedOut>
            <a href="/login" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">Sign in</a>
          </SignedOut>
          <SignedIn>
            <a href="/dashboard" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">Go to dashboard →</a>
          </SignedIn>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-16">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Simple, transparent pricing</h1>
          <p className="mt-3 text-slate-500">Start free. Upgrade when your statements get messy.</p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 max-w-3xl mx-auto">
          {/* Free */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Free</p>
            <p className="mt-3"><span className="text-4xl font-extrabold text-slate-900">$0</span>
              <span className="text-slate-400">/month</span></p>
            <p className="mt-2 text-sm text-slate-500">For occasional reconciliations and clean files.</p>
            <ul className="mt-6 space-y-2.5 text-sm text-slate-600">
              {FREE.map((f) => <li key={f} className="flex gap-2"><Check />{f}</li>)}
            </ul>
            <a href="/signup"
               className="mt-8 block text-center rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
              Start free
            </a>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border-2 border-indigo-600 bg-white p-8 shadow-md relative">
            <span className="absolute -top-3 left-8 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-bold text-white">Most popular</span>
            <p className="text-sm font-bold text-indigo-600 uppercase tracking-wide">Pro</p>
            <p className="mt-3"><span className="text-4xl font-extrabold text-slate-900">$99</span>
              <span className="text-slate-400">/month</span></p>
            <p className="mt-2 text-sm text-slate-500">For teams handling tough, high-volume statements.</p>
            <ul className="mt-6 space-y-2.5 text-sm text-slate-600">
              {PRO.map((f) => <li key={f} className="flex gap-2"><Check />{f}</li>)}
            </ul>
            <a href="/signup"
               className="mt-8 block text-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 transition-colors">
              Get started
            </a>
            <p className="mt-3 text-center text-xs text-slate-400">Upgrade anytime in Settings.</p>
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-slate-400 max-w-xl mx-auto">
          Prices in USD. Taxes are calculated at checkout. Payments are securely processed by Paddle.com, our
          Merchant of Record. Backed by a{" "}
          <a href="/refund" className="text-indigo-600 underline">14-day money-back guarantee</a>.
        </p>
      </main>

      <PublicFooter />
    </div>
  );
}
