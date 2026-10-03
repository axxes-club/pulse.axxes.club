import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { metadataPool } from "@/lib/analytics/postgres";
import {
  validBridgeState,
  cookieSignature,
  consumeHandoffSql,
} from "@/lib/analytics/session-bridge";
export async function GET(request: NextRequest) {
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
    return new Response("Sign-in link expired. Start again from Pulse.", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  const hash = (v: string) => createHash("sha256").update(v).digest("hex");
  const result = await metadataPool().query(
    consumeHandoffSql,
    [hash(code), hash(state)],
  );
  const session = result.rows[0];
  if (!session)
    return new Response("Sign-in link expired. Start again from Pulse.", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  const response = NextResponse.redirect("https://pulse.axxes.app/dashboard");
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
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
