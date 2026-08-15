import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = Boolean(req.auth);
  const isProtectedApp = pathname.startsWith("/app");
  const isProtectedApi =
    pathname.startsWith("/api/") && !pathname.startsWith("/api/auth");

  if (!isLoggedIn && isProtectedApi) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!isLoggedIn && isProtectedApp) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  if (isLoggedIn && pathname === "/") {
    return NextResponse.redirect(new URL("/app", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/", "/app/:path*", "/api/command", "/api/items/:path*", "/api/classes/:path*", "/api/dashboard"],
};
