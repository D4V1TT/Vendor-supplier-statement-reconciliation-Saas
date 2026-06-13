import type { MetadataRoute } from "next";

const BASE = "https://vendorrecon.org";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: { path: string; priority: number; freq: "weekly" | "monthly" }[] = [
    { path: "",         priority: 1.0, freq: "weekly" },
    { path: "/pricing", priority: 0.9, freq: "weekly" },
    { path: "/guide/vendor-statement-reconciliation", priority: 0.8, freq: "monthly" },
    { path: "/guide/reconcile-vendor-statement-in-excel", priority: 0.7, freq: "monthly" },
    { path: "/guide/supplier-statement-reconciliation-checklist", priority: 0.7, freq: "monthly" },
    { path: "/guide/duplicate-invoice-detection", priority: 0.7, freq: "monthly" },
    { path: "/contact", priority: 0.5, freq: "monthly" },
    { path: "/terms",   priority: 0.4, freq: "monthly" },
    { path: "/privacy", priority: 0.4, freq: "monthly" },
    { path: "/refund",  priority: 0.4, freq: "monthly" },
  ];
  return routes.map((r) => ({
    url: `${BASE}${r.path}`,
    lastModified: now,
    changeFrequency: r.freq,
    priority: r.priority,
  }));
}
