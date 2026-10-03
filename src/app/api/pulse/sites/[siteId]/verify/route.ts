import { randomBytes, createHash } from "node:crypto";
import { errorResponse, requireSameOrigin } from "@/lib/analytics/http";
import { requireAnalyticsAccess } from "@/lib/analytics/sites";
import { analyticsPool, metadataPool } from "@/lib/analytics/postgres";
import { connectionStatus } from "@/lib/analytics/storage";
import { matchVerification } from "@/lib/analytics/verification";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  try {
    requireSameOrigin(request);
    const { site } = await requireAnalyticsAccess(
      (await params).siteId,
      "manage",
    );
    const token = "v_" + randomBytes(24).toString("base64url");
    const result = await metadataPool().query(
      "insert into pulse_verifications(token_hash,site_id,environment) values($1,$2,$3) returning expires_at",
      [createHash("sha256").update(token).digest("hex"), site.id, site.environment],
    );
    return Response.json(
      { token, expiresAt: result.rows[0].expires_at },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  try {
    const { site } = await requireAnalyticsAccess((await params).siteId);
    const token = new URL(request.url).searchParams.get("token");
    if (!token)
      return Response.json(await connectionStatus(site), {
        headers: { "Cache-Control": "no-store" },
      });
    const challenge = await metadataPool().query(
      'select token_hash,environment,issued_at as "issuedAt",expires_at as "expiresAt" from pulse_verifications where token_hash=$1 and site_id=$2',
      [createHash("sha256").update(token).digest("hex"), site.id],
    );
    const event = await analyticsPool().query(
      "select properties->>'verification_token' as token,environment,received_at as \"receivedAt\" from pulse_events where tenant_id=$1 and site_id=$2 and environment=$3 and name='pulse.verify' and properties->>'verification_token'=$4 order by received_at desc limit 1",
      [site.tenantId, site.id, site.environment, token],
    );
    const c = challenge.rows[0];
    const connected = c
      ? matchVerification(
          {
            ...c,
            token,
            issuedAt: new Date(c.issuedAt).toISOString(),
            expiresAt: new Date(c.expiresAt).toISOString(),
          },
          event.rows[0]
            ? {
                ...event.rows[0],
                receivedAt: new Date(event.rows[0].receivedAt).toISOString(),
              }
            : null,
        )
      : false;
    return Response.json(
      {
        connected,
        expired: !c || new Date(c.expiresAt).getTime() <= Date.now(),
        lastEventAt: connected ? event.rows[0].receivedAt : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
