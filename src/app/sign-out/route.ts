import { NextResponse, type NextRequest } from "next/server";
import { authForHeaders } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const result = await authForHeaders(req.headers)
    .api.signOut({ headers: req.headers, asResponse: true })
    .catch(() => null);
  const res = NextResponse.redirect(new URL("/sign-in", req.url));
  result?.headers
    .getSetCookie()
    .forEach((cookie) => res.headers.append("set-cookie", cookie));
  return res;
}
