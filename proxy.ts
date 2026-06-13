import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AB_COOKIE, AB_COOKIE_MAX_AGE, randomVariant } from "@/lib/ab";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  


  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired — IMPORTANT: do not remove this call
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  //console.log("→ MIDDLEWARE pathname:", pathname);

  // Protected routes — redirect to /login if not authenticated
  const protectedRoutes = ["/dashboard", "/onboarding"];
  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If already signed in and visiting /login or /signup → redirect to /dashboard
  const authRoutes = ["/login", "/signup"];
  if (authRoutes.includes(pathname) && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.searchParams.delete("redirectTo");
    return NextResponse.redirect(dashboardUrl);
  }

  // Force users with 0 integrations to /onboarding before they can use the dashboard
  // Skip: /onboarding itself, /api/*, /auth/callback (OAuth flow must be allowed through)
  // Also skip if the user explicitly clicked "Skip for now" (cookie set by the button)
  const skipOnboardingCheck =
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/") ||
    request.cookies.get("onboarding_skipped")?.value === "1";

  if (user && pathname.startsWith("/dashboard") && !skipOnboardingCheck) {
    const { data: integrations, error: intError } = await supabase
      .from("integrations")
      .select("platform")
      .eq("user_id", user.id)
      .limit(1);

    // data is null on RLS/network error — don't block in that case
    // data is [] when user has no integrations → send to onboarding
    if (!intError && Array.isArray(integrations) && integrations.length === 0) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/onboarding";
      // Forward OAuth error params so onboarding can show feedback
      // e.g. /dashboard?tab=settings&stripe=error  →  /onboarding?error=stripe
      const errorPlatform = Array.from(request.nextUrl.searchParams.entries()).find(
        ([k, v]) => !["tab", "syncing", "connect", "redirectTo"].includes(k) && v === "error"
      );
      onboardingUrl.search = errorPlatform ? `?error=${errorPlatform[0]}` : "";
      return NextResponse.redirect(onboardingUrl);
    }
  }

  return assignAbVariant(request, supabaseResponse);
}

// ─────────────────────────────────────────────────────────────────────────────
// Assign A/B variant cookie on first visit to the landing page
// ─────────────────────────────────────────────────────────────────────────────
function assignAbVariant(request: NextRequest, response: NextResponse): NextResponse {
  // Only assign for the home page
  if (request.nextUrl.pathname !== "/") return response;
  // Already assigned — don't re-roll
  if (request.cookies.get(AB_COOKIE)) return response;
  const variant = randomVariant();
  response.cookies.set(AB_COOKIE, variant, {
    path: "/",
    maxAge: AB_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: false, // readable by client analytics if needed
  });
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
