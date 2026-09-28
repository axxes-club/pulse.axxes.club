import "server-only"
import { and, count, eq, gte, lte, sql, sum } from "drizzle-orm"
import { db, schema as s } from "@/lib/db"
import { countRows, scope } from "@/lib/data"

const DAY = 86_400_000

export async function getVitals(tenantId: string) {
  const now = new Date()
  const d30 = new Date(now.getTime() - 30 * DAY)
  const d60 = new Date(now.getTime() - 60 * DAY)
  const paid = sql`${s.orders.paymentStatus} in ('captured', 'authorized')`

  const [
    [rev30],
    [revPrev],
    contacts,
    newContacts,
    upcoming,
    activeProducts,
    lowStock,
    [campaigns],
    published,
    scheduled,
    projects,
    daily,
  ] = await Promise.all([
    db.select({ total: sum(s.orders.total), n: count() }).from(s.orders).where(scope(s.orders, tenantId, gte(s.orders.createdAt, d30), paid)),
    db.select({ total: sum(s.orders.total) }).from(s.orders).where(scope(s.orders, tenantId, gte(s.orders.createdAt, d60), lte(s.orders.createdAt, d30), paid)),
    countRows(s.contacts, tenantId),
    countRows(s.contacts, tenantId, gte(s.contacts.createdAt, d30)),
    countRows(s.events, tenantId, and(gte(s.events.startsAt, now), eq(s.events.status, "published"))),
    countRows(s.products, tenantId, eq(s.products.status, "active")),
    countRows(s.products, tenantId, sql`${s.products.trackInventory} and ${s.products.quantity} <= coalesce(${s.products.lowStockThreshold}, 5)`),
    db
      .select({ sent: sum(s.newsletterCampaigns.sentCount), opened: sum(s.newsletterCampaigns.openedCount), clicked: sum(s.newsletterCampaigns.clickedCount) })
      .from(s.newsletterCampaigns)
      .where(scope(s.newsletterCampaigns, tenantId, gte(s.newsletterCampaigns.createdAt, d60))),
    countRows(s.socialPosts, tenantId, and(eq(s.socialPosts.status, "published"), gte(s.socialPosts.publishedAt, d30))),
    countRows(s.socialPosts, tenantId, eq(s.socialPosts.status, "scheduled")),
    countRows(s.projects, tenantId, eq(s.projects.status, "active")),
    db
      .select({ day: sql<string>`to_char(date_trunc('day', ${s.orders.createdAt}), 'YYYY-MM-DD')`, total: sum(s.orders.total) })
      .from(s.orders)
      .where(scope(s.orders, tenantId, gte(s.orders.createdAt, d30), paid))
      .groupBy(sql`1`),
  ])

  const byDay = new Map(daily.map((d) => [d.day, Number(d.total ?? 0)]))
  const series = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now.getTime() - (29 - i) * DAY).toISOString().slice(0, 10)
    return { day: d, total: byDay.get(d) ?? 0 }
  })

  const revenue = Number(rev30?.total ?? 0)
  const prev = Number(revPrev?.total ?? 0)
  const sent = Number(campaigns?.sent ?? 0)

  return {
    revenue,
    revenueChange: prev > 0 ? (revenue - prev) / prev : null,
    orders: rev30?.n ?? 0,
    series,
    contacts,
    newContacts,
    upcoming,
    activeProducts,
    lowStock,
    openRate: sent > 0 ? Number(campaigns?.opened ?? 0) / sent : null,
    clickRate: sent > 0 ? Number(campaigns?.clicked ?? 0) / sent : null,
    emailsSent: sent,
    published,
    scheduled,
    projects,
  }
}
