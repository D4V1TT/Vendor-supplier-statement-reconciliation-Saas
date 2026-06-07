import type { MetadataRoute } from "next";

const BASE = "https://vendorrecon.org";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private, auth-gated app routes shouldn't be indexed.
      disallow: ["/dashboard", "/settings", "/history", "/login", "/signup"],
    },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
