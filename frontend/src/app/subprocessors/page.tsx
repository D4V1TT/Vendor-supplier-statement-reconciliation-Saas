import { LegalShell, H2, CONTACT_EMAIL } from "@/components/LegalShell";

export const metadata = { title: "Sub-processors | VendorRecon", alternates: { canonical: "/subprocessors" } };

const SUBPROCESSORS = [
  { name: "Clerk", purpose: "User authentication and account management", location: "United States" },
  { name: "Paddle", purpose: "Payments, billing, and Merchant of Record", location: "United Kingdom / United States" },
  { name: "Resend", purpose: "Transactional email (alerts and notifications)", location: "United States" },
  { name: "Anthropic", purpose: "AI-assisted extraction for hard-to-parse files (Pro plan only)", location: "United States" },
  { name: "Cloudflare", purpose: "Encrypted file storage (R2) and network delivery", location: "United States / global" },
  { name: "Railway", purpose: "Application hosting and database", location: "United States" },
  { name: "Vercel", purpose: "Frontend hosting and delivery", location: "United States" },
];

export default function SubprocessorsPage() {
  return (
    <LegalShell title="Sub-processors" updated="July 2026">
      <p>
        VendorRecon uses a small number of vetted service providers (sub-processors) to run the service. Each
        one processes data only on our behalf and only as needed for the purpose shown below. We do not sell
        your data, and we do not use your uploaded files to train AI models.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm mt-2">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-4 font-semibold">Provider</th>
              <th className="py-2 pr-4 font-semibold">Purpose</th>
              <th className="py-2 font-semibold">Data location</th>
            </tr>
          </thead>
          <tbody>
            {SUBPROCESSORS.map((s) => (
              <tr key={s.name} className="border-b border-slate-100 align-top">
                <td className="py-2 pr-4 font-semibold text-slate-800">{s.name}</td>
                <td className="py-2 pr-4 text-slate-600">{s.purpose}</td>
                <td className="py-2 text-slate-600">{s.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>Changes to this list</H2>
      <p>
        We may add or replace sub-processors as the service evolves. When we do, we will update this page. If
        you would like to be notified of changes, or you have questions about how a provider handles data,
        email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-600 underline">{CONTACT_EMAIL}</a>.
      </p>

      <H2>Related</H2>
      <p>
        See our <a href="/privacy" className="text-indigo-600 underline">Privacy Policy</a> and{" "}
        <a href="/dpa" className="text-indigo-600 underline">Data Processing Agreement</a>.
      </p>
    </LegalShell>
  );
}
