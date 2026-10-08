import {rateLimited} from "@/lib/security/admission";
import { safePulseReturn, pulseSignInPath } from "@/lib/auth-return";
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { metadataPool } from "@/lib/analytics/postgres";
import {
  validBridgeState,
  validTenantPreference,
  cookieSignature,
  consumeHandoffSql,
} from "@/lib/analytics/session-bridge";
function expired(request:NextRequest) {
  const returnTo=safePulseReturn(request.cookies.get("__Host-pulse_return")?.value);
  const href=pulseSignInPath(returnTo);
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Continue to Pulse</title><main><h1>Your sign-in link expired</h1><p>Return to Pulse to continue signing in.</p><a href="${href}">Continue to Pulse</a></main></html>`,{status:400,headers:{"Content-Type":"text/html;charset=utf-8","Cache-Control":"no-store","Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'none'","X-Content-Type-Options":"nosniff"}});
}
async function handleGET(request: NextRequest) {
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  const code = request.nextUrl.searchParams.get("code") || "";
  const state = request.cookies.get("__Host-pulse_bridge")?.value || "";
  const secret = process.env.BETTER_AUTH_SECRET;
  if (
    host !== "pulse.axxes.app" ||
    !validBridgeState(code) ||
    !validBridgeState(state) ||
    !secret
  )
    return expired(request);
  const hash = (v: string) => createHash("sha256").update(v).digest("hex");
  const result = await metadataPool().query(
    consumeHandoffSql,
    [hash(code), hash(state)],
  );
  const session = result.rows[0];
  if (!session)
    return expired(request);
  const returnTo=safePulseReturn(request.cookies.get("__Host-pulse_return")?.value);
  const tenant=request.cookies.get("__Host-pulse_tenant")?.value || "";
  const response = NextResponse.redirect(validTenantPreference(tenant)?"https://pulse.axxes.app/api/organization/open?tenant="+tenant+"&returnTo="+encodeURIComponent(returnTo):"https://pulse.axxes.app"+returnTo);
  response.cookies.set(
    "__Secure-better-auth.session_token",
    cookieSignature(session.token, secret),
    {
      secure: true,
      httpOnly: true,
      sameSite: "lax",
      domain: ".axxes.app",
      path: "/",
      expires: new Date(session.expires_at),
    },
  );
  response.cookies.delete("__Host-pulse_bridge");
  response.cookies.delete("__Host-pulse_tenant");
  response.cookies.delete("__Host-pulse_return");
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export const GET=rateLimited(handleGET,"bridge:consume");
