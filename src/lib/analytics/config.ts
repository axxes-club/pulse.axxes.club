import "server-only";
import { z } from "zod";
import { requireAnalyticsAccess } from "./sites";
import { metadataPool } from "./postgres";
import { AnalyticsError } from "./access";
const eventName = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/);
export async function getReportConfig(publicId: string) {
  const { site } = await requireAnalyticsAccess(publicId);
  const [goals, funnels] = await Promise.all([
    metadataPool().query(
      "select event_name from pulse_goals where site_id=$1 order by created_at",
      [site.id],
    ),
    metadataPool().query(
      'select id,name,steps,window_ms as "windowMs" from pulse_funnels where site_id=$1 order by created_at desc',
      [site.id],
    ),
  ]);
  return {
    goals: goals.rows.map((r) => r.event_name as string),
    funnels: funnels.rows as Array<{
      id: string;
      name: string;
      steps: string[];
      windowMs: number;
    }>,
  };
}
export async function createGoal(publicId: string, input: unknown) {
  const { site } = await requireAnalyticsAccess(publicId, "manage");
  const value = z.object({ eventName }).strict().parse(input);
  await metadataPool().query(
    "insert into pulse_goals(site_id,event_name) values($1,$2) on conflict(site_id,event_name) do nothing",
    [site.id, value.eventName],
  );
  return { eventName: value.eventName };
}
export async function createFunnel(publicId: string, input: unknown) {
  const { site } = await requireAnalyticsAccess(publicId, "manage");
  const value = z
    .object({
      name: z.string().trim().min(1).max(100),
      steps: z.array(eventName).min(2).max(8),
      windowMs: z.number().int().min(60000).max(86400000).default(1800000),
    })
    .strict()
    .parse(input);
  const result = await metadataPool().query(
    "insert into pulse_funnels(site_id,name,steps,window_ms) values($1,$2,$3::jsonb,$4) returning id",
    [site.id, value.name, JSON.stringify(value.steps), value.windowMs],
  );
  return result.rows[0];
}
export async function deleteGoal(publicId: string, input: unknown) {
  const { site } = await requireAnalyticsAccess(publicId, "manage");
  const value = z.object({ eventName }).strict().parse(input);
  const result = await metadataPool().query(
    "delete from pulse_goals where site_id=$1 and event_name=$2 returning event_name",
    [site.id, value.eventName],
  );
  if (!result.rows.length) throw new AnalyticsError("Conversion goal not found", 404);
  return { ok: true };
}
export async function deleteFunnel(publicId: string, input: unknown) {
  const { site } = await requireAnalyticsAccess(publicId, "manage");
  const value = z.object({ funnelId: z.string().uuid() }).strict().parse(input);
  const result = await metadataPool().query(
    "delete from pulse_funnels where site_id=$1 and id=$2 returning id",
    [site.id, value.funnelId],
  );
  if (!result.rows.length) throw new AnalyticsError("Funnel not found", 404);
  return { ok: true };
}
