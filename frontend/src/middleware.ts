import { authMiddleware } from "@clerk/nextjs/server";

export default authMiddleware({
  // Public routes — no login required
  publicRoutes: ["/", "/login", "/demo"],
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
