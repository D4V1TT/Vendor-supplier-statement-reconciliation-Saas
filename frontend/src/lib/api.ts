/**
 * Typed API client — thin wrapper around fetch.
 * All requests attach the JWT from localStorage.
 */

import { getToken } from "./auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  total_supplier_lines:    number;
  count_matched:           number;
  count_amount_mismatch:   number;
  count_missing_in_ledger: number;
  count_unapplied_credit:  number;
  total_variance:          number;
  exception_count:         number;
  match_rate_pct:          number;
}

export interface ExceptionsReport {
  job_id:             string;
  status:             string;
  summary:            ReportSummary;
  amount_mismatches:  ExceptionsBucket;
  missing_in_ledger:  ExceptionsBucket;
  unapplied_credits:  ExceptionsBucket;
  matched_count:      number;
  export_url:         string;
}

export interface Job {
  id:     string;
  status: "pending" | "running" | "completed" | "failed";
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
  // joined from statement
  vendor_name?:            string;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export const api = {
  uploadStatement: (form: FormData) =>
    fetch(`${BASE}/upload/statement`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    }).then((r) => r.json()),

  uploadLedger: (form: FormData) =>
    fetch(`${BASE}/upload/ledger`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    }).then((r) => r.json()),

  listJobs: () =>
    request<JobListItem[]>("/jobs"),

  reconcile: (statement_id: string, ledger_id: string) =>
    request<Job>("/reconcile", {
      method: "POST",
      body: JSON.stringify({ statement_id, ledger_id }),
    }),

  pollJob: (jobId: string) =>
    request<Job>(`/jobs/${jobId}`),

  getReport: (jobId: string) =>
    request<ExceptionsReport>(`/jobs/${jobId}/report`),

  getExportUrl: (jobId: string) =>
    `${BASE}/jobs/${jobId}/export/xlsx`,
};
