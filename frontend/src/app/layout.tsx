import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ApiAuthProvider } from "@/components/ApiAuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "VendorRecon — AP Statement Reconciliation",
  description: "Eliminate the yellow highlighter. Match vendor statements against your AP ledger in seconds.",
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
