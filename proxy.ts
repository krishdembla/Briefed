import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ONBOARDED_COOKIE = "briefed_onboarded";

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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — do not remove this, it keeps tokens alive
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isRoot = pathname === "/";
  const isAuthPage = pathname.startsWith("/auth");
  const isResetPassword = pathname.startsWith("/auth/reset-password");
  const isOnboarding = pathname.startsWith("/onboarding");
  const isAdmin = pathname.startsWith("/admin");
  const isPin = pathname.startsWith("/pin");
  const isPublic = isRoot || isAuthPage || isPin;
  const hasOnboarded = request.cookies.has(ONBOARDED_COOKIE);

  // Authenticated users landing on the marketing page go straight to the map
  if (user && isRoot) {
    const url = request.nextUrl.clone();
    url.pathname = "/map";
    return NextResponse.redirect(url);
  }

  // Unauthenticated users can only access public pages
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    return NextResponse.redirect(url);
  }

  // Authenticated users don't need the auth page — but reset-password must stay
  // accessible because the recovery session is established before the form loads.
  if (user && isAuthPage && !isResetPassword) {
    const url = request.nextUrl.clone();
    url.pathname = hasOnboarded ? "/map" : "/onboarding";
    return NextResponse.redirect(url);
  }

  // Send authenticated users who haven't onboarded to /onboarding.
  // Skip for /onboarding itself, /admin, and /pin pages.
  if (user && !isPublic && !isOnboarding && !isAdmin && !isPin && !hasOnboarded) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // Run on all routes except static assets and API routes
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
