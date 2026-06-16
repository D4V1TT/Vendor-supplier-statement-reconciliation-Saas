import React from "react";
import { SignedIn, SignedOut } from "@clerk/nextjs";

export const CONTACT_EMAIL = "info@vendorrecon.org";

export const FOOTER_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/guide/vendor-statement-reconciliation", label: "Guide" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refund", label: "Refunds" },
  { href: "/contact", label: "Contact" },
];

/** Shared header + footer chrome for the public legal / info pages. */
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col">
      <header className="border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="font-extrabold text-indigo-600">VendorRecon</a>
          <SignedOut>
            <a href="/login" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">Sign in</a>
          </SignedOut>
          <SignedIn>
            <a href="/dashboard" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">Go to dashboard →</a>
          </SignedIn>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-extrabold text-slate-900">{title}</h1>
        {updated && <p className="mt-1 text-sm text-slate-400">Last updated: {updated}</p>}
        <div className="mt-8 space-y-4 text-sm leading-relaxed text-slate-600">{children}</div>
      </main>

      <PublicFooter />
    </div>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-100 py-8">
      <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-slate-400">© 2026 VendorRecon. All data encrypted at rest.</p>
        <div className="flex flex-wrap gap-5">
          {FOOTER_LINKS.map((l) => (
            <a key={l.href} href={l.href}
               className="text-xs text-slate-400 hover:text-slate-700 transition-colors">
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

/** Section heading used inside legal page bodies. */
export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-slate-900 pt-4">{children}</h2>;
}

/** Readable body paragraph for guide/article pages. */
export function Para({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-7 text-slate-600">{children}</p>;
}

/** Shared call-to-action box for guide pages. */
export function GuideCTA() {
  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-6 mt-6">
      <p className="font-bold text-slate-900">Reconcile your first statement free</p>
      <p className="text-sm text-slate-600 mt-1">
        Upload a real vendor statement and your AP ledger and see the exceptions in seconds — no credit card needed.
      </p>
      <a href="/signup"
         className="mt-4 inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition-colors">
        Start free
      </a>
      <span className="ml-3 text-xs text-slate-400">or see <a href="/pricing" className="text-indigo-600 underline">pricing</a></span>
    </div>
  );
}

/** Related-guides link list for cross-linking the content cluster. */
export function RelatedGuides({ links }: { links: { href: string; label: string }[] }) {
  return (
    <div className="pt-6 mt-6 border-t border-slate-100">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Related guides</p>
      <ul className="mt-3 space-y-1.5">
        {links.map((l) => (
          <li key={l.href}>
            <a href={l.href} className="text-[15px] text-indigo-600 hover:text-indigo-700 underline">{l.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
