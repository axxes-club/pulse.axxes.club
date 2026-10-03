import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { headers } from "next/headers";
import { authDomain } from "@/lib/analytics/session-bridge";
import { db, schema } from "@/lib/db";

const baseURL =
  process.env.BETTER_AUTH_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

// Shares the user/session/account tables with members.axxes.club, so every
// AXXES account can sign in here with the same credentials.
// With Handshake (handshake.axxes.club), every *.axxes.club app shares one session cookie
const cookieDomain = process.env.AUTH_COOKIE_DOMAIN;
const parentDomain = (cookieDomain || "axxes.club").replace(/^\./, "");

// Central AXXES sign-in; when unset the app uses its own sign-in page
export const HANDSHAKE_URL =
  process.env.HANDSHAKE_URL?.replace(/\/$/, "") || null;

function makeAuth(url: string, domain: string | undefined) {
  return betterAuth({
    baseURL: url,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [
      url,
      `https://${parentDomain}`,
      `https://*.${parentDomain}`,
      ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ],
    advanced: domain
      ? { crossSubDomainCookies: { enabled: true, domain } }
      : undefined,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: { enabled: true },
  });
}

export const auth = makeAuth(baseURL, cookieDomain);
const appAuth = makeAuth("https://pulse.axxes.app", ".axxes.app");
const clubAuth = makeAuth("https://pulse.axxes.club", ".axxes.club");
export function authForHeaders(h: Headers) {
  const host = (h.get("x-forwarded-host") || h.get("host") || "").split(":")[0];
  const domain = authDomain(host);
  return domain === ".axxes.app"
    ? appAuth
    : domain === ".axxes.club"
      ? clubAuth
      : auth;
}
export async function requestAuth() {
  return authForHeaders(await headers());
}
