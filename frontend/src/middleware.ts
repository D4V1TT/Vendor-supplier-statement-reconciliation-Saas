import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Routes that never require authentication
const isPublic = createRouteMatcher([
  "/",
  "/login(.*)",
  "/signup(.*)",
  "/demo(.*)",
  "/pricing(.*)",
  "/terms(.*)",
  "/privacy(.*)",
  "/cookies(.*)",
  "/dpa(.*)",
  "/subprocessors(.*)",
  "/refund(.*)",
  "/contact(.*)",
  "/guide(.*)",
  "/icon(.*)",        // generated PNG favicon route (no file extension)
  "/api/webhooks(.*)",
]);

export default clerkMiddleware((auth, request) => {
  // Canonical host: permanently redirect www → apex so Google sees a single
  // canonical URL (fixes "Duplicate without user-selected canonical").
  const host = request.headers.get("host") || "";
  if (host.startsWith("www.")) {
    return NextResponse.redirect(
      `https://vendorrecon.org${request.nextUrl.pathname}${request.nextUrl.search}`,
      308,
    );
  }
  if (!isPublic(request)) {
    auth().protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|txt|xml)).*)",
    "/(api|trpc)(.*)",
  ],
};
