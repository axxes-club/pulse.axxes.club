import { it, expect } from "vitest";
import {
  summarizeEvents,
  evaluateFunnel,
} from "../../src/lib/analytics/metrics";
it("deduplicates event ids and visitors across days and scopes environments", () => {
  const events = [
    {
      id: "1",
      name: "pageview",
      visitor: "v1",
      session: "s1",
      time: "2026-10-01T12:00:00Z",
      path: "/",
      source: "Google",
      country: "US",
      device: "Desktop",
      environment: "production",
    },
    {
      id: "1",
      name: "pageview",
      visitor: "v1",
      session: "s1",
      time: "2026-10-01T12:00:00Z",
      path: "/",
      source: "Google",
      country: "US",
      device: "Desktop",
      environment: "production",
    },
    {
      id: "2",
      name: "pageview",
      visitor: "v1",
      session: "s2",
      time: "2026-10-02T12:00:00Z",
      path: "/pricing",
      source: "Google",
      country: "US",
      device: "Desktop",
      environment: "production",
    },
    {
      id: "3",
      name: "pageview",
      visitor: "v2",
      session: "s3",
      time: "2026-10-02T12:00:00Z",
      path: "/",
      source: "Direct",
      country: "US",
      device: "Desktop",
      environment: "development",
    },
  ] as any;
  const report = summarizeEvents(
    events,
    {
      range: 7,
      source: "",
      metric: "visitors",
      environment: "production",
      compare: true,
    },
    new Date("2026-10-03T12:00:00Z"),
  );
  expect(report.visitors).toBe(1);
  expect(report.pageviews).toBe(2);
  expect(report.sessions).toBe(2);
});
it("funnels require ordered steps in the same session", () => {
  const events = [
    { id: "1", name: "signup", session: "s1", time: "2026-10-01T12:00:00Z" },
    { id: "2", name: "pageview", session: "s1", time: "2026-10-01T12:01:00Z" },
    { id: "3", name: "pageview", session: "s2", time: "2026-10-01T12:00:00Z" },
    { id: "4", name: "signup", session: "s2", time: "2026-10-01T12:01:00Z" },
  ] as any;
  expect(
    evaluateFunnel(events, ["pageview", "signup"], 1800000).map(
      (x) => x.sessions,
    ),
  ).toEqual([2, 1]);
});
it('filters pages and countries and keeps realtime to five minutes',()=>{const now=new Date('2026-10-03T12:00:00Z');const base={name:'pageview',visitor:'v',session:'s',source:'Direct',country:'US',device:'Desktop',environment:'production'};const input=[{...base,id:'old',path:'/',time:'2026-10-02T10:00:00Z'},{...base,id:'live',path:'/',time:'2026-10-03T11:58:00Z'},{...base,id:'other',path:'/other',time:'2026-10-03T11:59:00Z'}] as any;const q={range:7,source:'',path:'/',country:'US',metric:'visitors',environment:'production',compare:true} as any;const report=summarizeEvents(input,q,now);expect(report.live.map(e=>e.id)).toEqual(['live']);expect(report.pages.map(p=>p.name)).toEqual(['/'])});
it('does not invent website sessions from uncorrelated backend business events',()=>{const now=new Date('2026-10-03T12:00:00Z');const event={id:'native1',name:'purchase',session:'backend-write',visitor:'backend',time:'2026-10-02T12:00:00Z',path:'/',source:'Direct',country:'Unknown',device:'Unknown',environment:'production'} as any;const r=summarizeEvents([event],{range:7,source:'',metric:'visitors',environment:'production',compare:true},now,{goalNames:['purchase']});expect(r.sessions).toBe(0);expect(r.conversionRate).toBe(0);expect(r.events).toEqual([{name:'purchase',value:1}])});
it('attributes a session to its entry source even when a later URL changes campaign',()=>{const base={name:'pageview',visitor:'v',session:'s',country:'US',device:'Desktop',path:'/',environment:'production'};const events=[{...base,id:'first',time:'2026-10-02T10:00:00Z',source:'Google'},{...base,id:'next',time:'2026-10-02T10:01:00Z',source:'Instagram'},{...base,id:'goal',name:'signup',time:'2026-10-02T10:02:00Z',source:'Direct'}] as any;const r=summarizeEvents(events,{range:7,source:'Google',metric:'visitors',environment:'production',compare:true},new Date('2026-10-03T12:00:00Z'));expect(r.pageviews).toBe(2);expect(r.conversions).toBe(1)});
it('counts a browser interaction session without inventing one for server outcomes',()=>{const event={id:'interaction',name:'signup',session:'new-browser-session',visitor:'v',time:'2026-10-02T12:00:00Z',path:'/',source:'Direct',country:'Unknown',device:'Desktop',environment:'production',properties:{pulse_collection:'browser'}} as any;const report=summarizeEvents([event],{range:7,source:'',metric:'visitors',environment:'production',compare:true},new Date('2026-10-03T12:00:00Z'));expect(report.sessions).toBe(1);expect(report.conversions).toBe(1)});
