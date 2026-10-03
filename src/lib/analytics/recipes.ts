export type IntegrationPlatform =
  "html" | "react" | "next" | "vue" | "svelte" | "node" | "http" | "axxes";
export const platforms: Array<{
  id: IntegrationPlatform;
  name: string;
  symbol: string;
  description: string;
}> = [
  {
    id: "html",
    name: "Any website",
    symbol: "</>",
    description: "One script. Automatic pageviews.",
  },
  {
    id: "next",
    name: "Next.js",
    symbol: "N",
    description: "App Router or Pages Router.",
  },
  {
    id: "react",
    name: "React",
    symbol: "⚛︎",
    description: "Single-page apps, fully covered.",
  },
  {
    id: "vue",
    name: "Vue",
    symbol: "V",
    description: "Add it to your app shell.",
  },
  {
    id: "svelte",
    name: "Svelte",
    symbol: "S",
    description: "Simple lifecycle integration.",
  },
  {
    id: "node",
    name: "Node.js",
    symbol: "⬡",
    description: "Track trusted backend events.",
  },
  {
    id: "http",
    name: "HTTP API",
    symbol: "{ }",
    description: "Any backend. Any language.",
  },
  {
    id: "axxes",
    name: "AXXES apps",
    symbol: "AX",
    description: "Your ecosystem, connected.",
  },
];
export function getInstallationRecipe(
  platform: IntegrationPlatform,
  config: {
    publicSiteId: string;
    endpoint: string;
    environment: "production" | "development";
  },
) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(config.publicSiteId))
    throw new Error("Invalid public app identifier");
  const endpoint = new URL(config.endpoint);
  if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost")
    throw new Error("HTTPS is required");
  const base = endpoint.origin;
  const src = `${base}/pulse.v1.js`,
    id = config.publicSiteId;
  const html = `<script\n  src="${src}"\n  data-site="${id}"\n  data-environment="${config.environment}"\n  data-performance="true"\n  defer\n></script>`;
  if (platform === "next")
    return {
      file: "app/layout.tsx",
      instruction:
        "Add the hosted script to your root layout. Pulse tracks client-side navigation automatically.",
      code: `import Script from 'next/script'\n\n// Inside your root layout's <body>:\n<Script\n  src="${src}"\n  data-site="${id}"\n  data-environment="${config.environment}"\n  data-performance="true"\n  strategy="afterInteractive"\n/>`,
    };
  if (platform === "react")
    return {
      file: "index.html",
      instruction:
        "Add this to your HTML entry. It works with React Router without another pageview call.",
      code: html,
    };
  if (platform === "vue")
    return {
      file: "index.html",
      instruction:
        "Add this to your HTML entry. Pulse observes Vue Router navigation automatically.",
      code: html,
    };
  if (platform === "svelte")
    return {
      file: "src/app.html",
      instruction:
        "Add this before </head> in SvelteKit, or to index.html in a Svelte app.",
      code: html,
    };
  if (platform === "node")
    return {
      file: "server.ts",
      instruction:
        "Keep your scoped server credential in PULSE_SERVER_KEY. Send events after the operation succeeds.",
      code: `await fetch('${base}/api/pulse/server-events', {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n    Authorization: \`Bearer \${process.env.PULSE_SERVER_KEY}\`,\n  },\n  body: JSON.stringify({\n    schemaVersion: 1,\n    siteId: '${id}',\n    environment: '${config.environment}',\n    events: [{\n      id: crypto.randomUUID(),\n      name: 'signup',\n      timestamp: new Date().toISOString(),\n      properties: { plan: 'starter' },\n    }],\n  }),\n})`,
    };
  if (platform === "http")
    return {
      file: "Terminal · server only",
      instruction:
        "Use this from a trusted backend. Mobile apps call your backend; keep this credential out of client code.",
      code: `curl '${base}/api/pulse/server-events' \\\n  -H "Authorization: Bearer $PULSE_SERVER_KEY" \\\n  -H 'Content-Type: application/json' \\\n  -d '{\n    "schemaVersion": 1,\n    "siteId": "${id}",\n    "environment": "${config.environment}",\n    "events": [{\n      "id": "YOUR_UNIQUE_EVENT_ID",\n      "name": "signup",\n      "timestamp": "CURRENT_ISO_TIMESTAMP",\n      "properties": { "plan": "starter" }\n    }]\n  }'`,
    };
  if (platform === "axxes")
    return {
      file: "AXXES app layout",
      instruction:
        "Use the same organization in both apps. Add the tracker to the app layout, then verify a real event.",
      code: html,
    };
  return {
    file: "index.html",
    instruction:
      "Paste this just before </head>. Your app identifier is public; do not put a server credential here.",
    code: html,
  };
}
