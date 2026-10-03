import { requireContext } from "@/lib/context"
import { getVitals } from "@/lib/metrics"
import { PageHeader, Stat } from "@/components/ui"
import { product } from "@/product.config"

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
const pct = (n: number | null) => (n === null ? "—" : `${(n * 100).toFixed(1)}%`)

const PORTAL = "https://members.axxes.club"

function Sparkline({ series }: { series: { day: string; total: number }[] }) {
  const max = Math.max(...series.map((d) => d.total), 1)
  const w = 600
  const h = 120
  const step = w / (series.length - 1)
  const pts = series.map((d, i) => `${(i * step).toFixed(1)},${(h - (d.total / max) * (h - 8) - 4).toFixed(1)}`)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full" preserveAspectRatio="none" role="img" aria-label="Captured order value in USD per day, last 30 days">
      <defs>
        <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts.join(" ")} ${w},${h}`} fill="url(#fill)" />
      <polyline points={pts.join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export default async function PulsePage() {
  const ctx = await requireContext()
  const v = await getVitals(ctx.tenant.id)
  const change = v.revenueChange === null ? "No prior period" : `${v.revenueChange >= 0 ? "▲" : "▼"} ${pct(Math.abs(v.revenueChange))} vs previous 30 days`

  return (
    <>
      <PageHeader title={`${ctx.tenant.name} · vitals`} description={product.tagline} />

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted">Captured order value · USD · 30 days</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{usd(v.revenue)}</p>
            <p className="mt-2 text-xs text-muted">Captured USD orders, before refund adjustments. Authorizations are excluded.</p>
            {v.currencyTotals.filter(c=>c.currency!=="USD").map(c=><p key={c.currency} className="mt-1 text-xs text-muted">{new Intl.NumberFormat("en-US",{style:"currency",currency:c.currency}).format(c.total)} in {c.currency} · shown separately</p>)}
            <p className="mt-1 text-sm text-muted">{v.orders} paid orders · {change}</p>
          </div>
        </div>
        <div className="mt-6"><Sparkline series={v.series} /></div>
      </section>

      <h2 className="mb-3 mt-10 font-mono text-[11px] uppercase tracking-[0.15em] text-muted">Audience</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Contacts" value={v.contacts.toLocaleString()} hint={`+${v.newContacts} in 30 days`} href={`${PORTAL}/crm`} />
        <Stat label="Emails sent" value={v.emailsSent.toLocaleString()} hint="Campaigns, last 60 days" href={`${PORTAL}/newsletter/campaigns`} />
        <Stat label="Open rate" value={pct(v.openRate)} hint={`Click rate ${pct(v.clickRate)}`} />
        <Stat label="Social posts" value={v.published} hint={`${v.scheduled} scheduled`} href={`${PORTAL}/social/posts`} />
      </div>

      <h2 className="mb-3 mt-10 font-mono text-[11px] uppercase tracking-[0.15em] text-muted">Operations</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Upcoming events" value={v.upcoming} hint="Published" href={`${PORTAL}/events`} />
        <Stat label="Active products" value={v.activeProducts} />
        <Stat label="Low stock" value={v.lowStock} hint="At or below threshold" href="https://manifest.axxes.club" />
        <Stat label="Active projects" value={v.projects} href={`${PORTAL}/projects`} />
      </div>
    </>
  )
}
