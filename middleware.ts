import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ONBOARDED_COOKIE = "briefed_onboarded";

export async function middleware(request: NextRequest) {
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
  const isAuthPage = pathname.startsWith("/auth");
  const isResetPassword = pathname.startsWith("/auth/reset-password");
  const isOnboarding = pathname.startsWith("/onboarding");
  const isAdmin = pathname.startsWith("/admin");
  const isPublic = isAuthPage || isOnboarding;
  const hasOnboarded = request.cookies.has(ONBOARDED_COOKIE);

  // Unauthenticated users can only access /auth
  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    return NextResponse.redirect(url);
  }

  // Authenticated users don't need the auth page — but reset-password must stay
  // accessible because the recovery session is established before the form loads.
  if (user && isAuthPage && !isResetPassword) {
    const url = request.nextUrl.clone();
    url.pathname = hasOnboarded ? "/" : "/onboarding";
    return NextResponse.redirect(url);
  }

  // Send authenticated users who haven't onboarded to /onboarding.
  // Skip this for /onboarding itself and /admin (admin bypasses onboarding).
  if (user && !isPublic && !isAdmin && !hasOnboarded) {
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
