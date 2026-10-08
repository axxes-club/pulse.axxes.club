import Link from "next/link";
import { PulseBrand } from "@/components/pulse/brand";
import { ThemeToggle } from "@/components/pulse/theme";
import { Icon } from "@/components/pulse/icon";
import { PricingPlans } from "@/components/pulse/pricing-plans";
import { OVERAGE_GRACE, TRIAL_DAYS, TRIAL_EVENTS, formatEvents } from "@/lib/billing/plans";

export const metadata = {
  title: "Pricing · Pulse",
  description: "Every Pulse feature on every plan. Pay only for monthly events, from $5 a month. 30-day free trial, no card needed.",
};

const FAQ = [
  [
    "What counts as an event?",
    "A pageview or a custom event such as a signup or a purchase. Performance samples (Core Web Vitals) and installation checks are free. One plan covers every app and environment in your organization.",
  ],
  [
    "What happens if I go over?",
    `Nothing breaks and nothing is charged automatically. Pulse keeps collecting up to ${OVERAGE_GRACE}× your plan for the rest of the month and tells you. Past that, new events pause until the month resets or you move to a larger plan.`,
  ],
  [
    "How does the free trial work?",
    `${TRIAL_DAYS} days with every feature and up to ${formatEvents(TRIAL_EVENTS)} events, no card needed. If you choose a plan during the trial, you still are not charged until the trial ends.`,
  ],
  [
    "What if I stop paying?",
    "Collection pauses. Your reports, history and exports stay available, and choosing a plan resumes collection right away.",
  ],
  [
    "How long is data kept?",
    "Every plan keeps detailed events for 90 days, and reports and exports cover that whole window.",
  ],
  [
    "Are reports exact at high volume?",
    "Totals for very large periods are estimated from a fixed share of whole visitors and clearly labelled, which keeps every report fast. Live activity and recent events are always exact.",
  ],
  [
    "Can I change or cancel?",
    "Any time from Plan & billing. Switching plans is prorated on the same subscription. Payments are handled securely by AXXES Payments with Stripe.",
  ],
];

export default function Pricing() {
  return (
    <div className="pulse-site">
      <nav className="marketing-nav">
        <PulseBrand />
        <div className="marketing-links">
          <Link href="/#product">Product</Link>
          <Link href="/#integrate">Integrations</Link>
          <Link href="/pricing" aria-current="page">Pricing</Link>
          <Link href="/docs">Developers</Link>
        </div>
        <div className="nav-actions">
          <ThemeToggle />
          <Link href="/sign-in" className="text-link">Sign in</Link>
          <Link href="/dashboard/integrations" className="button primary small">
            Start free trial <Icon name="arrow" size={15} />
          </Link>
        </div>
      </nav>
      <main className="pricing-page">
        <span className="tiny-label blue">PRICING</span>
        <h1>
          Every feature. Every plan.
          <br />
          Pay only for traffic.
        </h1>
        <p>
          Unlimited apps, unlimited teammates, funnels, retention, performance and revenue on every plan. Start with a{" "}
          {TRIAL_DAYS}-day free trial, no card needed.
        </p>
        <PricingPlans />
        <section className="pricing-faq">
          {FAQ.map(([question, answer]) => (
            <article className="feature-card" key={question}>
              <h3>{question}</h3>
              <p>{answer}</p>
            </article>
          ))}
        </section>
      </main>
      <section className="bottom-cta">
        <span className="tiny-label">{TRIAL_DAYS} DAYS FREE</span>
        <h2>See your traffic today.</h2>
        <p>Connect your first app in minutes. No card, no commitment.</p>
        <Link href="/dashboard/integrations" className="button primary">
          Start free trial <Icon name="arrow" />
        </Link>
        <Link href="/demo">Or explore the demo ↗</Link>
      </section>
    </div>
  );
}
