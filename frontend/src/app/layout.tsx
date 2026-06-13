import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ApiAuthProvider } from "@/components/ApiAuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://vendorrecon.org"),
  alternates: { canonical: "/" },
  title: "VendorRecon — AP Statement Reconciliation",
  description:
    "Reconcile vendor & supplier statements against your accounts-payable ledger in seconds — automatically catch amount mismatches, missing invoices, duplicate billing, and unapplied credits.",
  applicationName: "VendorRecon",
  keywords: [
    "statement reconciliation",
    "vendor statement reconciliation",
    "supplier statement reconciliation",
    "accounts payable automation",
    "invoice matching",
    "AP reconciliation software",
  ],
  openGraph: {
    type: "website",
    url: "https://vendorrecon.org",
    siteName: "VendorRecon",
    title: "VendorRecon — AP Statement Reconciliation",
    description:
      "Reconcile vendor statements against your AP ledger in seconds. Catch mismatches, missing invoices, duplicates, and unapplied credits.",
  },
  twitter: {
    card: "summary",
    title: "VendorRecon — AP Statement Reconciliation",
    description: "Reconcile vendor statements against your AP ledger in seconds.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full">
        <body className="h-full bg-slate-50 text-slate-900">
          <ApiAuthProvider>{children}</ApiAuthProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
