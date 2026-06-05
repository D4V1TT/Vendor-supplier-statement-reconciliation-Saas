import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VendorRecon — Statement Reconciliation",
  description: "Automated vendor statement reconciliation for finance teams",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
