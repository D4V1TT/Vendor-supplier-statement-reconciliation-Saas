import { LegalShell, H2, CONTACT_EMAIL } from "@/components/LegalShell";

export const metadata = { title: "Cookie Policy | VendorRecon", alternates: { canonical: "/cookies" } };

const COOKIES = [
  { name: "__cf_bm", provider: "Cloudflare", purpose: "Bot management and abuse prevention", expiry: "30 minutes" },
  { name: "_cfuvid", provider: "Cloudflare", purpose: "Identifies trusted traffic for security and performance", expiry: "Session" },
  { name: "__client", provider: "Clerk", purpose: "Keeps you signed in (authentication session)", expiry: "Up to ~10 years" },
  { name: "__client_uat", provider: "Clerk", purpose: "Tracks your authentication state", expiry: "Up to ~10 years" },
  { name: "__clerk_environment", provider: "Clerk", purpose: "Stores sign-in configuration (browser local storage)", expiry: "Persistent" },
];

export default function CookiesPage() {
  return (
    <LegalShell title="Cookie Policy" updated="July 2026">
      <p>
        This Cookie Policy explains how VendorRecon uses cookies and similar technologies when you visit our
        website. It covers what these technologies are, why we use them, and how you can control them.
      </p>

      <H2>What are cookies?</H2>
      <p>
        Cookies are small data files placed on your device when you visit a website. They are widely used to
        make websites work, to keep you signed in, and to keep the service secure. Cookies set by the site you
        are visiting are called first-party cookies; cookies set by other parties are third-party cookies.
      </p>

      <H2>Why we use cookies</H2>
      <p>
        We use only essential (strictly necessary) cookies. They keep you signed in and protect the service
        against abuse. We do not use advertising or interest-based tracking cookies, and we do not sell your
        data. Our product analytics (Vercel Analytics) is cookieless and does not identify you.
      </p>

      <H2>The cookies we use</H2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm mt-2">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-4 font-semibold">Name</th>
              <th className="py-2 pr-4 font-semibold">Provider</th>
              <th className="py-2 pr-4 font-semibold">Purpose</th>
              <th className="py-2 font-semibold">Expires</th>
            </tr>
          </thead>
          <tbody>
            {COOKIES.map((c) => (
              <tr key={c.name} className="border-b border-slate-100 align-top">
                <td className="py-2 pr-4 font-mono text-[13px] text-slate-800">{c.name}</td>
                <td className="py-2 pr-4 text-slate-600">{c.provider}</td>
                <td className="py-2 pr-4 text-slate-600">{c.purpose}</td>
                <td className="py-2 text-slate-600">{c.expiry}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>How to control cookies</H2>
      <p>
        Because we use only strictly necessary cookies, the site cannot work correctly without them, so there is
        no separate consent banner to manage. You can still block or delete cookies through your browser
        settings, though doing so may sign you out or break parts of the app. Browser instructions:{" "}
        <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">Chrome</a>,{" "}
        <a href="https://support.apple.com/en-ie/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">Safari</a>,{" "}
        <a href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">Firefox</a>, and{" "}
        <a href="https://support.microsoft.com/en-us/windows/microsoft-edge-browsing-data-and-privacy-bb8174ba-9d73-dcf2-9b4a-c582b4e640dd" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">Edge</a>.
      </p>

      <H2>Other technologies</H2>
      <p>
        Our transactional emails may include a standard pixel that indicates whether a message was delivered and
        opened, so we can keep alerts reliable. We do not use web beacons or tracking pixels for advertising.
      </p>

      <H2>Targeted advertising</H2>
      <p>
        We do not serve targeted or interest-based advertising, and we do not allow third-party advertising
        cookies on the site.
      </p>

      <H2>Changes to this policy</H2>
      <p>
        We may update this Cookie Policy to reflect changes to the cookies we use or for legal reasons. The date
        at the top shows when it was last updated.
      </p>

      <H2>Contact</H2>
      <p>
        Questions about our use of cookies? Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-600 underline">{CONTACT_EMAIL}</a>.
      </p>
    </LegalShell>
  );
}
