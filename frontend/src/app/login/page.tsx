import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-6">
        {/* Logo above the Clerk widget */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <p className="text-base font-bold text-slate-900 leading-none">VendorRecon</p>
            <p className="text-[11px] text-slate-400">AP Statement Reconciliation</p>
          </div>
        </div>

        {/* Clerk drop-in: email/password + Google + Microsoft out of the box */}
        <SignIn
          appearance={{
            elements: {
              rootBox: "shadow-sm",
              card: "rounded-2xl border border-slate-200 shadow-sm",
              headerTitle: "text-slate-900 font-bold",
              headerSubtitle: "text-slate-400",
              socialButtonsBlockButton:
                "border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors",
              formButtonPrimary:
                "bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold transition-colors",
              footerActionLink: "text-indigo-600 font-semibold hover:text-indigo-800",
              formFieldInput:
                "rounded-xl border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-400 focus:border-transparent",
            },
          }}
        />

        <p className="text-xs text-slate-400">
          Your data is encrypted at rest with AES-256.
        </p>
      </div>
    </div>
  );
}
