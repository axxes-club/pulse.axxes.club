import { expect, it } from "vitest";
import {
  authDomain,
  validBridgeState,
  cookieSignature,
} from "@/lib/analytics/session-bridge";
import { createHmac } from "node:crypto";
it("selects cookies only for verified Pulse hosts and rejects malicious state", () => {
  expect(authDomain("pulse.axxes.app")).toBe(".axxes.app");
  expect(authDomain("pulse.axxes.club")).toBe(".axxes.club");
  expect(authDomain("evil.axxes.app.attacker.com")).toBe(null);
  expect(validBridgeState("x".repeat(43))).toBe(true);
  expect(validBridgeState("../redirect")).toBe(false);
});
it("matches Better Auth HMAC session cookie format", () => {
  expect(cookieSignature("session", "secret")).toBe(
    "session." +
      createHmac("sha256", "secret").update("session").digest("base64"),
  );
});
it('consumes a handoff once atomically and rejects expired, wrong-state and revoked sessions',async()=>{const {PGlite}=await import('@electric-sql/pglite');const {consumeHandoffSql}=await import('@/lib/analytics/session-bridge');const db=new PGlite();try{await db.exec("create table \"user\"(id text primary key);insert into \"user\" values('u');create table platform_subject_policy(subject_kind text,subject_id text,state text);create table session(id text primary key,token text,expires_at timestamptz,user_id text);create table pulse_session_handoffs(code_hash text primary key,state_hash text,session_id text,expires_at timestamptz);insert into session values('s','fixture',now()+interval '1 hour','u');insert into pulse_session_handoffs values('code','state','s',now()+interval '1 minute'),('expired','state','s',now()-interval '1 minute'),('revoked','state','gone',now()+interval '1 minute')");expect((await db.query(consumeHandoffSql,['code','wrong'])).rows).toHaveLength(0);const attempts=await Promise.all([db.query(consumeHandoffSql,['code','state']),db.query(consumeHandoffSql,['code','state'])]);expect(attempts.reduce((n,r)=>n+r.rows.length,0)).toBe(1);expect((await db.query(consumeHandoffSql,['expired','state'])).rows).toHaveLength(0);expect((await db.query(consumeHandoffSql,['revoked','state'])).rows).toHaveLength(0);await db.exec("insert into platform_subject_policy values('user','u','blocked');insert into pulse_session_handoffs values('blocked','state','s',now()+interval '1 minute')");expect((await db.query(consumeHandoffSql,['blocked','state'])).rows).toHaveLength(0)}finally{await db.close()}},20000);
