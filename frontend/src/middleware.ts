import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes that never require authentication
const isPublic = createRouteMatcher([
  "/",
  "/login(.*)",
  "/signup(.*)",
  "/demo(.*)",
  "/pricing(.*)",
  "/terms(.*)",
  "/privacy(.*)",
  "/refund(.*)",
  "/contact(.*)",
  "/guide(.*)",
  "/icon(.*)",        // generated PNG favicon route (no file extension)
  "/api/webhooks(.*)",
]);

export default clerkMiddleware((auth, request) => {
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
