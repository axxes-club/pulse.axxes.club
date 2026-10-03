import "server-only";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { getContext } from "@/lib/context";
import { metadataPool } from "./postgres";
import { AnalyticsError, authorizeSite } from "./access";
export type AnalyticsSite = {
  id: string;
  tenantId: string;
  publicId: string;
  name: string;
  platform: string;
  collection: "browser" | "server";
  environment: "production" | "development";
  allowedOrigins: string[];
  enabled: boolean;
  timezone: string;
  identityMode: "ephemeral" | "persistent";
};
const columns =
  'id, tenant_id as "tenantId", public_id as "publicId", name, platform, collection, environment, allowed_origins as "allowedOrigins", enabled, timezone, identity_mode as "identityMode"';
export async function listSites() {
  const ctx = await getContext();
  if (!ctx)
    throw new AnalyticsError("Sign in with AXXES to connect your app", 401);
  const result = await metadataPool().query<AnalyticsSite>(
    `select ${columns} from pulse_sites where tenant_id=$1 and enabled=true order by created_at desc`,
    [ctx.tenant.id],
  );
  return result.rows;
}
export async function findPublicSite(publicId: string) {
  const result = await metadataPool().query<AnalyticsSite>(
    `select ${columns} from pulse_sites where public_id=$1 and enabled=true`,
    [publicId],
  );
  return result.rows[0] || null;
}
export async function requireAnalyticsAccess(
  publicId: string,
  action: "read" | "manage" = "read",
) {
  const ctx = await getContext();
  if (!ctx) throw new AnalyticsError("Sign in with AXXES", 401);
  const result = await metadataPool().query<AnalyticsSite>(
    `select ${columns} from pulse_sites where public_id=$1 and tenant_id=$2`,
    [publicId, ctx.tenant.id],
  );
  const site = result.rows[0];
  if (!site) throw new AnalyticsError("App not found", 404);
  authorizeSite({ tenantId: ctx.tenant.id, role: ctx.role }, site, action);
  return { site, ctx };
}
const createSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    origin: z.string().max(2048).optional(),
    platform: z.enum([
      "html",
      "react",
      "next",
      "vue",
      "svelte",
      "node",
      "http",
      "axxes",
    ]),
    environment: z.enum(["production", "development"]).default("production"),
    identityMode: z.enum(["ephemeral", "persistent"]).default("ephemeral"),
  })
  .strict();
export async function createSite(input: unknown) {
  const ctx = await getContext();
  if (!ctx)
    throw new AnalyticsError("Sign in with AXXES to create an app", 401);
  if (!["owner", "admin"].includes(ctx.role))
    throw new AnalyticsError(
      "An organization administrator must create this app",
      403,
    );
  const value = createSchema.parse(input);
  const collection = ["node", "http"].includes(value.platform)
    ? "server"
    : "browser";
  let origins: string[] = [];
  if (collection === "browser") {
    let url: URL;
    try {
      url = new URL(value.origin || "");
    } catch {
      throw new AnalyticsError("Enter a valid app URL");
    }
    if (
      url.username ||
      url.password ||
      !["http:", "https:"].includes(url.protocol) ||
      (url.protocol === "http:" && value.environment === "production")
    )
      throw new AnalyticsError("Production apps require an HTTPS origin");
    origins = [url.origin];
  }
  const publicId = `app_${randomUUID().replaceAll("-", "")}`;
  const result = await metadataPool().query<AnalyticsSite>(
    `insert into pulse_sites (tenant_id,public_id,name,platform,collection,environment,allowed_origins,identity_mode) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) returning ${columns}`,
    [
      ctx.tenant.id,
      publicId,
      value.name,
      value.platform,
      collection,
      value.environment,
      JSON.stringify(origins),
      value.identityMode,
    ],
  );
  return result.rows[0];
}
export async function issueServerCredential(publicId: string) {
  const { site } = await requireAnalyticsAccess(publicId, "manage");
  const secret = `pulse_sk_${randomBytes(32).toString("base64url")}`;
  await metadataPool().query(
    "insert into pulse_server_credentials (site_id,secret_hash) values ($1,$2)",
    [site.id, createHash("sha256").update(secret).digest("hex")],
  );
  return secret;
}
export async function verifyCredential(secret: string, siteId: string) {
  if (!/^pulse_sk_[A-Za-z0-9_-]{43}$/.test(secret)) return null;
  const result = await metadataPool().query<AnalyticsSite>(
    `select ${columns
      .split(",")
      .map((x) => x.trim())
      .map((x) =>
        x.replace(
          /^(id|tenant_id|public_id|name|platform|collection|environment|allowed_origins|enabled|timezone|identity_mode)/,
          "s.$1",
        ),
      )
      .join(
        ", ",
      )} from pulse_sites s join pulse_server_credentials c on c.site_id=s.id where c.secret_hash=$1 and s.public_id=$2 and c.revoked_at is null and s.enabled=true`,
    [createHash("sha256").update(secret).digest("hex"), siteId],
  );
  return result.rows[0] || null;
}
