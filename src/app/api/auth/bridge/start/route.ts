import { validTenantPreference } from "@/lib/analytics/session-bridge";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (host !== "pulse.axxes.app")
    return new Response("Invalid host", { status: 400 });
  const state = randomBytes(32).toString("base64url");
  const callback =
    "https://pulse.axxes.club/api/auth/bridge/issue?state=" + state;
  const response = NextResponse.redirect(
    "https://handshake.axxes.club/sign-in?redirect=" +
      encodeURIComponent(callback),
  );
  response.cookies.set("__Host-pulse_bridge", state, {
    secure: true,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });
  const tenant=new URL(request.url).searchParams.get("tenant") || "";
  if(validTenantPreference(tenant))response.cookies.set("__Host-pulse_tenant",tenant,{secure:true,httpOnly:true,sameSite:"lax",path:"/",maxAge:300});else response.cookies.delete("__Host-pulse_tenant");
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
