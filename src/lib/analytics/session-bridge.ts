import { createHmac } from "node:crypto";
export function authDomain(host: string) {
  return host === "pulse.axxes.app"
    ? ".axxes.app"
    : host === "pulse.axxes.club"
      ? ".axxes.club"
      : null;
}
export function validBridgeState(state: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(state);
}
export function cookieSignature(value: string, secret: string) {
  return (
    value + "." + createHmac("sha256", secret).update(value).digest("base64")
  );
}

export const consumeHandoffSql = "with consumed as (delete from pulse_session_handoffs where code_hash=$1 and state_hash=$2 and expires_at>now() returning session_id) select s.token,s.expires_at from session s join consumed c on c.session_id=s.id where s.expires_at>now()";

export function validTenantPreference(value:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)}
