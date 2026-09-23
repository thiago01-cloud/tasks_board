// Next.js middleware: runs before every page matching the "matcher"
// below, even before the server component itself runs. It protects the
// dashboard and handles multi-step login:
//   - an authenticated account that hasn't chosen/created a company yet
//     (pre-session) is sent to /login/choose-company rather than
//     /dashboard (that page then decides, from the database, whether to
//     send it to /create-company instead — see that file);
//   - a fully connected account has nothing to do on public pages (home,
//     login, signup) nor on pre-session pages: it's sent to /dashboard.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "./lib/token";
import { SESSION_COOKIE_NAME, PRE_SESSION_COOKIE_NAME } from "./lib/constants";
import type { SessionPayload } from "./lib/auth";

const PUBLIC_PAGES = ["/", "/login", "/signup"];
const PRE_SESSION_PAGES = ["/login/choose-company", "/create-company"];

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const preToken = request.cookies.get(PRE_SESSION_COOKIE_NAME)?.value;
  const payload = token
    ? await verifyToken<SessionPayload>(token, process.env.JWT_SECRET as string)
    : null;
  const prePayload = preToken
    ? await verifyToken<{ userId: string }>(preToken, process.env.JWT_SECRET as string)
    : null;
  const isLoggedIn = Boolean(payload);
  const awaitingPreSession = !isLoggedIn && Boolean(prePayload);

  const { pathname } = request.nextUrl;

  // Dashboard: reserved for fully connected accounts (company chosen).
  if (pathname.startsWith("/dashboard") && !isLoggedIn) {
    const url = request.nextUrl.clone();
    if (awaitingPreSession) {
      url.pathname = "/login/choose-company";
    } else {
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(url);
  }

  // Pre-session pages (choosing or creating a company): reserved for
  // authenticated accounts that don't have a full session yet.
  if (PRE_SESSION_PAGES.includes(pathname) && !isLoggedIn && !awaitingPreSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // A fully connected account has nothing to do on public/login/signup
  // pages, nor on pre-session pages.
  if ((PUBLIC_PAGES.includes(pathname) || PRE_SESSION_PAGES.includes(pathname)) && isLoggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // An account in pre-session (authenticated, company not chosen/created
  // yet) visiting a public or login/signup page is sent to the next step.
  if (PUBLIC_PAGES.includes(pathname) && awaitingPreSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login/choose-company";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/login", "/login/choose-company", "/signup", "/create-company"],
};
