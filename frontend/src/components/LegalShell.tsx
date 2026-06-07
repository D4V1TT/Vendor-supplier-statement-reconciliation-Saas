import React from "react";

export const CONTACT_EMAIL = "vendorreconorg@gmail.com";

export const FOOTER_LINKS = [
  { href: "/pricing", label: "Pricing" },
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
          <a href="/login" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">Sign in</a>
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
