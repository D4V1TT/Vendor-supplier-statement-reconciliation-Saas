/**
 * Typed API client.
 * Uses Clerk's session token for every authenticated request.
 * Call `initApiAuth(getToken)` once in a top-level client component
 * to wire up the token getter from Clerk's useAuth() hook.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

// Clerk's getToken is async — we store a reference set once at app boot
let _getToken: (() => Promise<string | null>) | null = null;

export function initApiAuth(getToken: () => Promise<string | null>) {
  _getToken = getToken;
}

async function authHeader(): Promise<Record<string, string>> {
  if (!_getToken) throw new Error("Not authenticated — please sign in again.");
  const token = await _getToken();
  if (!token) throw new Error("Session expired — please sign in again.");
  return { Authorization: `Bearer ${token}` };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = await authHeader();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...headers,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LineItem {
  invoice_id:      string;
  invoice_date:    string | null;
  supplier_amount: number;
  ledger_amount:   number | null;
  variance:        number | null;
  category:        string;
  balance_due:     number | null;
  notes:           string;
}

export interface ExceptionsBucket {
  category:     string;
  count:        number;
  total_amount: number;
  items:        LineItem[];
}

export interface ReportSummary {
  total_supplier_lines:       number;
  count_matched:              number;
  count_amount_mismatch:      number;
  count_missing_in_ledger:    number;
  count_unapplied_credit:     number;
  count_likely_match:         number;
  count_missing_in_statement: number;
  count_duplicate:            number;
  total_variance:             number;
  exception_count:            number;
  match_rate_pct:             number;
}

export interface ExceptionsReport {
  job_id:               string;
  status:               string;
  summary:              ReportSummary;
  amount_mismatches:    ExceptionsBucket;
  missing_in_ledger:    ExceptionsBucket;
  unapplied_credits:    ExceptionsBucket;
  likely_matches:       ExceptionsBucket;
  missing_in_statement: ExceptionsBucket;
  duplicates:           ExceptionsBucket;
  matched_count:        number;
  export_url:           string;
}

export interface Job {
  id:     string;
  status: "pending" | "running" | "completed" | "failed";
}

export interface NotificationPrefs {
  notify_on_completion: boolean;
  notify_on_exceptions: boolean;
  notify_weekly_digest: boolean;
}

export interface ReconUsage {
  plan:      string;
  unlimited: boolean;
  used:      number;
  limit:     number | null;
  remaining: number | null;
}

export interface ReconSettings {
  default_currency:       string;
  amount_tolerance:       number;
  pdf_extraction_method:  "auto" | "pdfplumber" | "ocr" | "llm";
  flag_unapplied_credits: boolean;
  auto_export:            boolean;
}

export interface JobListItem {
  id:                      string;
  status:                  string;
  created_at:              string;
  statement_id:            string;
  ledger_id:               string;
  total_supplier_lines:    number | null;
  count_matched:           number | null;
  count_amount_mismatch:   number | null;
  count_missing_in_ledger: number | null;
  count_unapplied_credit:  number | null;
  total_variance:          number | null;
  vendor_name?:            string;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export const api = {
  uploadStatement: async (form: FormData) => {
    const headers = await authHeader();
    const res = await fetch(`${BASE}/upload/statement`, { method: "POST", headers, body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail ?? `Upload failed (${res.status})`);
    return data;
  },

  uploadLedger: async (form: FormData) => {
    const headers = await authHeader();
    const res = await fetch(`${BASE}/upload/ledger`, { method: "POST", headers, body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail ?? `Upload failed (${res.status})`);
    return data;
  },

  reconcile: (statement_id: string, ledger_id: string) =>
    request<Job>("/reconcile", {
      method: "POST",
      body: JSON.stringify({ statement_id, ledger_id }),
    }),

  pollJob: (jobId: string) =>
    request<Job>(`/jobs/${jobId}`),

  getReport: (jobId: string) =>
    request<ExceptionsReport>(`/jobs/${jobId}/report`),

  getMatched: (jobId: string, page = 1, pageSize = 100) =>
    request<LineItem[]>(`/jobs/${jobId}/matched?page=${page}&page_size=${pageSize}`),

  listJobs: () =>
    request<JobListItem[]>("/jobs"),

  getSettings: () =>
    request<ReconSettings>("/settings"),

  updateSettings: (settings: Partial<ReconSettings>) =>
    request<ReconSettings>("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),

  getNotifications: () =>
    request<NotificationPrefs>("/notifications"),

  updateNotifications: (prefs: Partial<NotificationPrefs>) =>
    request<NotificationPrefs>("/notifications", {
      method: "PUT",
      body: JSON.stringify(prefs),
    }),

  getCompany: () =>
    request<{ id: string; name: string; slug: string }>("/company"),

  getUsage: () =>
    request<ReconUsage>("/usage"),

  // Billing portal (Paddle) — returns a hosted URL to redirect the user to.
  // Checkout itself runs client-side via Paddle.js (see settings page).
  openBillingPortal: () =>
    request<{ url: string }>("/billing/portal", { method: "POST" }),

  deleteAllData: () =>
    request<{ status: string; deleted: Record<string, number> }>("/company/data", {
      method: "DELETE",
    }),

  updateCompany: (name: string) =>
    request<{ id: string; name: string; slug: string }>("/company", {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),

  // Public sandbox — no auth, no storage. Runs reconciliation in-memory.
  sandboxReconcile: async (statement: File, ledger: File) => {
    const form = new FormData();
    form.append("statement", statement);
    form.append("ledger", ledger);
    const res = await fetch(`${BASE}/sandbox/reconcile`, { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail ?? `Sandbox failed (${res.status})`);
    return data as {
      summary: ReportSummary;
      exceptions: LineItem[];
      truncated: boolean;
      total_exceptions: number;
    };
  },

  getExportUrl: (jobId: string) =>
    `${BASE}/jobs/${jobId}/export/xlsx`,

  /**
   * Downloads the Excel report with the auth token attached, then triggers
   * a browser "Save As" via an in-memory blob. A plain <a href> can't be used
   * because it wouldn't carry the Authorization header.
   */
  downloadExport: async (jobId: string, vendorName?: string) => {
    const headers = await authHeader();
    const res = await fetch(`${BASE}/jobs/${jobId}/export/xlsx`, { headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail ?? `Export failed (${res.status})`);
    }
    const blob = await res.blob();
    const url  = window.URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    const safeName = (vendorName ?? "reconciliation").replace(/[^\w\-]+/g, "_");
    a.download = `${safeName}_exceptions_${jobId.slice(0, 8)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};
