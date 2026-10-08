import {admitWrite} from "@/lib/security/admission";
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
export async function listSites(includeDisabled=false) {
  const ctx = await getContext();
  if (!ctx)
    throw new AnalyticsError("Sign in with AXXES to connect your app", 401);
  const result = await metadataPool().query<AnalyticsSite>(
    `select ${columns} from pulse_sites where tenant_id=$1 and ($2::boolean or enabled=true) order by created_at desc`,
    [ctx.tenant.id,includeDisabled && ["owner","admin"].includes(ctx.role)],
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
  if (action === "manage") await admitWrite(ctx);
  return { site, ctx };
}
const createSchema = z
  .object({
    integrationKey: z.string().regex(/^[a-z0-9_-]{1,60}$/).optional(),
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
  await admitWrite(ctx);
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
  if (value.platform === "axxes") {
    const app = await metadataPool().query("select url from axxes_product where key=$1 and status in ('live','beta')",[value.integrationKey]);
    if(!app.rows[0] || new URL(app.rows[0].url).origin !== origins[0]) throw new AnalyticsError("Choose an available AXXES app from the catalog");
  }
  const publicId = `app_${randomUUID().replaceAll("-", "")}`;
  const result = await metadataPool().query<AnalyticsSite>(
    `insert into pulse_sites (tenant_id,public_id,name,platform,collection,environment,allowed_origins,identity_mode,integration_key) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9) returning ${columns}`,
    [
      ctx.tenant.id,
      publicId,
      value.name,
      value.platform,
      collection,
      value.environment,
      JSON.stringify(origins),
      value.identityMode,
      value.platform === "axxes" ? value.integrationKey : null,
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

export async function updateSite(publicId:string,input:unknown){
 const {site}=await requireAnalyticsAccess(publicId,"manage");
 const value=z.object({name:z.string().trim().min(1).max(100),timezone:z.string().max(100),enabled:z.boolean(),allowedOrigins:z.array(z.string().url().max(2048)).max(10),identityMode:z.enum(["ephemeral","persistent"]).optional()}).strict().parse(input);
 try{new Intl.DateTimeFormat("en",{timeZone:value.timezone}).format()}catch{throw new AnalyticsError("Choose a valid reporting timezone")}
 const origins=value.allowedOrigins.map(raw=>{const u=new URL(raw);if(u.username||u.password||!["https:","http:"].includes(u.protocol)||(site.environment==="production"&&u.protocol!=="https:"))throw new AnalyticsError("Production origins require HTTPS");return u.origin});
 if(site.collection==="browser"&&!origins.length)throw new AnalyticsError("Browser apps need an allowed origin");
 await metadataPool().query("update pulse_sites set name=$1,timezone=$2,enabled=$3,allowed_origins=$4::jsonb,identity_mode=$5 where id=$6 and tenant_id=$7",[value.name,value.timezone,value.enabled,JSON.stringify([...new Set(origins)]),value.identityMode ?? site.identityMode,site.id,site.tenantId]);return {ok:true};
}
export async function revokeServerCredential(publicId:string,credentialId:string){const {site}=await requireAnalyticsAccess(publicId,"manage");if(!z.string().uuid().safeParse(credentialId).success)throw new AnalyticsError("Invalid credential");await metadataPool().query("update pulse_server_credentials set revoked_at=now() where id=$1 and site_id=$2",[credentialId,site.id]);return {ok:true}}
