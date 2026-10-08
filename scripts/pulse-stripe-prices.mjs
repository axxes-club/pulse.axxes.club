// Creates Pulse's recurring prices on the AXXES Payments Stripe account, one per plan and
// interval, under stable lookup keys (pulse_<plan>_<monthly|annual>). Idempotent: existing
// lookup keys are left alone, so running it twice changes nothing.
//
//   STRIPE_SECRET_KEY=sk_test_... node scripts/pulse-stripe-prices.mjs          # dry run
//   STRIPE_SECRET_KEY=sk_test_... node scripts/pulse-stripe-prices.mjs --apply  # create
//
// The key is read from the environment and never printed. Keep prices in sync with src/lib/billing/plans.ts.
const PLANS = [
  ["e25k", "25k", 500],
  ["e100k", "100k", 900],
  ["e250k", "250k", 1400],
  ["e1m", "1M", 1900],
  ["e5m", "5M", 4900],
  ["e10m", "10M", 7900],
];
const key = process.env.STRIPE_SECRET_KEY;
if (!/^sk_(live|test)_/.test(key || "")) throw new Error("Set STRIPE_SECRET_KEY to the AXXES Payments account key");
const mode = key.startsWith("sk_live_") ? "live" : "test";
const apply = process.argv.includes("--apply");

async function stripe(method, path, params) {
  const body = params ? new URLSearchParams(params).toString() : undefined;
  const url = `https://api.stripe.com/v1/${path}${method === "GET" && params ? `?${body}` : ""}`;
  const response = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
    body: method === "GET" ? undefined : body,
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`Stripe ${path}: ${json.error?.message || response.status}`);
  return json;
}

const wanted = PLANS.flatMap(([plan, label, monthly]) => [
  { lookup: `pulse_${plan}_monthly`, label, amount: monthly, interval: "month" },
  { lookup: `pulse_${plan}_annual`, label, amount: monthly * 10, interval: "year" },
]);
const existing = new Map();
for (let i = 0; i < wanted.length; i += 10) {
  const query = new URLSearchParams({ active: "true", limit: "100" });
  for (const w of wanted.slice(i, i + 10)) query.append("lookup_keys[]", w.lookup);
  const list = await fetch(`https://api.stripe.com/v1/prices?${query}`, { headers: { authorization: `Bearer ${key}` } }).then((r) => r.json());
  for (const price of list.data || []) existing.set(price.lookup_key, price);
}

const missing = wanted.filter((w) => !existing.has(w.lookup));
for (const w of wanted) {
  const found = existing.get(w.lookup);
  if (found && (found.unit_amount !== w.amount || found.recurring?.interval !== w.interval || found.currency !== "usd"))
    console.warn(`MISMATCH ${w.lookup}: Stripe has ${found.unit_amount} ${found.currency}/${found.recurring?.interval}, expected ${w.amount} usd/${w.interval}`);
}
console.log(`${mode}: ${wanted.length - missing.length} present, ${missing.length} to create`);
if (!missing.length || !apply) {
  if (missing.length) console.log("Dry run. Re-run with --apply to create:", missing.map((w) => w.lookup).join(", "));
  process.exit(0);
}

const products = await stripe("GET", "products/search", { query: "metadata['axxes_product']:'pulse'" });
const product =
  products.data?.[0] ||
  (await stripe("POST", "products", {
    name: "Pulse",
    description: "AXXES Pulse analytics",
    "metadata[axxes_product]": "pulse",
  }));
for (const w of missing) {
  await stripe("POST", "prices", {
    product: product.id,
    currency: "usd",
    unit_amount: String(w.amount),
    "recurring[interval]": w.interval,
    lookup_key: w.lookup,
    nickname: `Pulse ${w.label} events/month (${w.interval === "year" ? "annual" : "monthly"})`,
    "metadata[axxes_product]": "pulse",
  });
  console.log(`created ${w.lookup}`);
}
