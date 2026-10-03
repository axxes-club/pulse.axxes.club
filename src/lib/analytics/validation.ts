import { createHmac } from "node:crypto";
import { AnalyticsError } from "./access";
import { z } from "zod";
const props = z
  .record(
    z.string().max(64),
    z.union([z.string().max(256), z.number().finite(), z.boolean()]),
  )
  .refine((p) => Object.keys(p).length <= 20, "Too many event properties")
  .refine(p=>!Object.keys(p).some(key=>/^(password|passwd|secret|token|access_token|refresh_token|email|phone|credit_card|card_number|message_body|document_content|ip_address)$/i.test(key)),"Sensitive event properties are not allowed");
const event = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
    name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/),
    timestamp: z.string().datetime(),
    url: z.string().url().max(2048).optional(),
    referrer: z.string().max(2048).optional(),
    properties: props.optional(),
    visitorId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,100}$/)
      .optional(),
    anonymousVisitorId: z.string().regex(/^[a-f0-9]{32}$/).optional(),
    sessionId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,100}$/)
      .optional(),
  })
  .strict();
const batchSchema = z
  .object({
    schemaVersion: z.literal(1).optional(),
    siteId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
    environment: z.enum(["production", "development"]).default("production"),
    events: z.array(event).min(1).max(50),
  })
  .strict();
export type EventBatch = z.infer<typeof batchSchema>;
export function validateBatch(input: unknown, now = new Date()): EventBatch {
  const parsed = batchSchema.parse(input);
  for (const e of parsed.events) {
    const time = Date.parse(e.timestamp);
    if (time < now.getTime() - 86400000 || time > now.getTime() + 300000)
      throw new AnalyticsError("Event timestamp outside acceptance window");
    if (e.url) {
      const u = new URL(e.url);
      if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
        throw new AnalyticsError("Invalid event URL");
    }
  }
  return parsed;
}
export function sanitizeUrl(value: string): {
  path: string;
  campaign: Record<string, string>;
} {
  const u = new URL(value);
  const campaign: Record<string, string> = {};
  for (const k of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ]) {
    const v = u.searchParams.get(k);
    if (v) campaign[k] = v.slice(0, 256);
  }
  return { path: u.pathname.slice(0, 1024), campaign };
}
export function visitorKey(
  secret: string,
  siteId: string,
  ip: string,
  ua: string,
  rotation: string,
): string {
  return createHmac("sha256", secret)
    .update(JSON.stringify([siteId, ip, ua, rotation]))
    .digest("hex")
    .slice(0, 32);
}
export function safeSource(
  referrer: string | undefined,
  campaign: Record<string, string>,
): string {
  if (campaign.utm_source) return campaign.utm_source;
  try {
    const host = new URL(referrer || "").hostname;
    if (host.includes("google.")) return "Google";
    if (host.includes("instagram.")) return "Instagram";
    if (host.includes("axxes.")) return "AXXES";
    return host || "Direct";
  } catch {
    return "Direct";
  }
}
