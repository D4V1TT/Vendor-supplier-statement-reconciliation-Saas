import { LegalShell, H2, CONTACT_EMAIL } from "@/components/LegalShell";

export const metadata = { title: "Data Processing Agreement | VendorRecon", alternates: { canonical: "/dpa" } };

export default function DpaPage() {
  return (
    <LegalShell title="Data Processing Agreement" updated="July 2026">
      <p>
        This Data Processing Agreement (&quot;DPA&quot;) forms part of the{" "}
        <a href="/terms" className="text-indigo-600 underline">Terms of Service</a> between VendorRecon and any
        customer (&quot;Customer&quot;) that uses the service to process personal data on behalf of its own
        clients or other individuals. It describes how we process that data on your instructions. If you need a
        countersigned copy for your records, email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-600 underline">{CONTACT_EMAIL}</a>.
      </p>

      <H2>1. Roles</H2>
      <p>
        For personal data contained in the files you upload, you (the Customer) act as the data controller and
        VendorRecon acts as the data processor. VendorRecon processes that data only on your documented
        instructions, which include your use of the service and these Terms.
      </p>

      <H2>2. Scope and purpose</H2>
      <p>
        We process the data you upload (vendor statements, ledgers, and the results derived from them) for the
        sole purpose of providing the reconciliation service. We do not use it for any other purpose, do not
        sell it, and do not use it to train AI or machine-learning models.
      </p>

      <H2>3. Confidentiality</H2>
      <p>
        We keep your data confidential and ensure that anyone who processes it is bound by appropriate
        confidentiality obligations.
      </p>

      <H2>4. Security</H2>
      <p>
        We maintain technical and organisational measures appropriate to the risk, including encryption of
        uploaded files at rest (AES-256), encryption in transit (HTTPS/TLS), and access controls that isolate
        each customer&apos;s data through row-level security.
      </p>

      <H2>5. Sub-processors</H2>
      <p>
        You authorise us to engage the sub-processors listed on our{" "}
        <a href="/subprocessors" className="text-indigo-600 underline">Sub-processors</a> page. Each is bound by
        data-protection obligations consistent with this DPA. We will update that page before adding a new
        sub-processor, and you may object to a change on reasonable data-protection grounds.
      </p>

      <H2>6. Data subject requests</H2>
      <p>
        Taking into account the nature of the processing, we will assist you, as far as reasonably possible, in
        responding to requests from individuals to exercise their rights (such as access, correction, or
        deletion). You can also delete your data directly at any time from your account settings.
      </p>

      <H2>7. Personal data breach</H2>
      <p>
        If we become aware of a breach affecting your personal data, we will notify you without undue delay and
        provide the information you reasonably need to meet your own notification obligations.
      </p>

      <H2>8. Return and deletion</H2>
      <p>
        You can permanently delete your files and results at any time from your account settings, which also
        removes the encrypted files from storage. On termination, or on your request, we will delete your data
        within a reasonable period unless we are required by law to retain it.
      </p>

      <H2>9. International transfers</H2>
      <p>
        Where personal data is transferred across borders, we rely on appropriate safeguards, such as the
        European Commission&apos;s Standard Contractual Clauses, where they apply.
      </p>

      <H2>10. Audit</H2>
      <p>
        On reasonable written request, we will provide the information reasonably necessary to demonstrate our
        compliance with this DPA.
      </p>

      <H2>11. Contact</H2>
      <p>
        For any data-protection question, or to request a signed DPA, email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-600 underline">{CONTACT_EMAIL}</a>.
      </p>

      <p className="text-xs text-slate-400 mt-6">
        This page summarises our data-processing commitments in plain language. It is not legal advice. For a
        binding, signed agreement tailored to your requirements, contact us.
      </p>
    </LegalShell>
  );
}
