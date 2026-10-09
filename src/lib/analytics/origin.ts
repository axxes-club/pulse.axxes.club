import { AnalyticsError } from "./access";

export type OriginRejection =
  | "empty"
  | "unparseable"
  | "unsupported_scheme"
  | "insecure_in_production"
  | "credentials";

const MAX_ECHO = 80;
// A scheme is letters then ":"; "example.com:443" is a host and port, not a scheme.
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:(?!\d)/i;

// Echo what we received so people can see exactly what was rejected.
// Control characters and invisible spaces are shown, since pasted text often carries them.
function echo(raw: string) {
  const shown = raw
    .replace(/[\u0000-\u001f\u007f-\u009f\u00a0\u200b-\u200f\u2028\u2029\ufeff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)
    .slice(0, MAX_ECHO);
  return raw.length > MAX_ECHO ? `${shown}…` : shown;
}

export class OriginError extends AnalyticsError {
  constructor(
    message: string,
    public reason: OriginRejection,
    public received: string,
  ) {
    super(message, 400);
  }
}

/**
 * Turns what someone typed in "Website address" into an origin, or explains precisely why not.
 * A missing scheme is treated as https. Production origins must be https.
 */
export function parseAppOrigin(
  input: unknown,
  environment: "production" | "development",
): string {
  const raw = typeof input === "string" ? input : "";
  const value = raw.trim().replace(/^[\u200b-\u200f\ufeff\u00a0]+|[\u200b-\u200f\ufeff\u00a0]+$/g, "");
  if (!value)
    throw new OriginError(
      "Enter your website address, for example https://example.com",
      "empty",
      raw,
    );
  // "example.com" or "example.com:443" has no scheme; URL would read "example.com:" as one.
  const bare = value.replace(/^\/\//, "");
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(bare);
  const candidate = HAS_SCHEME.test(value) ? value : `${local && environment === "development" ? "http" : "https"}://${bare}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new OriginError(
      `"${echo(raw)}" is not a website address. Use the form https://example.com`,
      "unparseable",
      raw,
    );
  }
  if (!url.hostname || url.hostname.includes(" "))
    throw new OriginError(
      `"${echo(raw)}" has no valid domain. Use the form https://example.com`,
      "unparseable",
      raw,
    );
  if (url.username || url.password)
    throw new OriginError(
      `"${echo(raw)}" contains a username or password. Remove everything before the @`,
      "credentials",
      raw,
    );
  if (!["http:", "https:"].includes(url.protocol))
    throw new OriginError(
      `"${echo(raw)}" uses ${url.protocol.replace(/:$/, "")}. Website addresses start with https://`,
      "unsupported_scheme",
      raw,
    );
  if (url.protocol === "http:" && environment === "production")
    throw new OriginError(
      `"${echo(raw)}" uses http. Production apps need https://${url.host}, or choose the Development environment for local testing`,
      "insecure_in_production",
      raw,
    );
  return url.origin;
}

/** One log line per rejection: what kind, and the scheme/host we parsed, never the full raw text. */
export function logOriginRejection(error: OriginError, context: Record<string, string>) {
  let scheme = "", host = "";
  try {
    const u = new URL(HAS_SCHEME.test(error.received.trim()) ? error.received.trim() : `https://${error.received.trim()}`);
    scheme = u.protocol;
    host = u.host;
  } catch {}
  console.warn(
    "pulse_origin_rejected",
    JSON.stringify({ reason: error.reason, scheme, host, length: error.received.length, ...context }),
  );
}
