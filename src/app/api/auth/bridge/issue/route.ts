import { safePulseReturn } from "@/lib/auth-return";
import { randomBytes, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { authForHeaders } from "@/lib/auth";
import { metadataPool } from "@/lib/analytics/postgres";
import { validBridgeState } from "@/lib/analytics/session-bridge";
export async function GET(request: Request) {
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  const state = new URL(request.url).searchParams.get("state") || "";
  if (host !== "pulse.axxes.club" || !validBridgeState(state))
    return new Response("Invalid handoff", { status: 400 });
  const session = await authForHeaders(request.headers).api.getSession({
    headers: request.headers,
  });
  if (!session)
    return NextResponse.redirect(
      "https://handshake.axxes.club/sign-in?redirect=" +
        encodeURIComponent(
          "https://pulse.axxes.club/api/auth/bridge/issue?state=" + state + "&returnTo=" + encodeURIComponent(safePulseReturn(new URL(request.url).searchParams.get("returnTo"))),
        ),
    );
  const code = randomBytes(32).toString("base64url");
  const hash = (v: string) => createHash("sha256").update(v).digest("hex");
  await metadataPool().query(
    "insert into pulse_session_handoffs(code_hash,state_hash,session_id) values($1,$2,$3)",
    [hash(code), hash(state), session.session.id],
  );
  const response = NextResponse.redirect(
    "https://pulse.axxes.app/api/auth/bridge/consume?code=" + code,
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
