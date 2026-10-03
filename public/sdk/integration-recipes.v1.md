# AXXES Pulse integration recipes v1

These examples are integration patterns to adapt and verify in your app. Generated app IDs and scoped credentials come from Pulse → Integrations. They are not published packages or certified mobile SDKs.

## Same-origin Next.js proxy

Install the browser tracker with `data-endpoint="https://YOUR_APP/api/analytics"`. Keep its public app ID and configured environment. Your app route forwards bounded requests to Pulse; preserve the browser Origin and reject other origins. Configure YOUR_APP as an allowed origin in Pulse. Do not forward IP addresses or attach a server credential to this public route.

```ts
// app/api/analytics/route.ts
export async function POST(request: Request) {
  if (request.headers.get('origin') !== process.env.APP_ORIGIN)
    return new Response('Forbidden', { status: 403 });
  if (Number(request.headers.get('content-length') || 0) > 32768)
    return new Response('Too large', { status: 413 });
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > 32768)
    return new Response('Too large', { status: 413 });
  const response = await fetch('https://pulse.axxes.app/api/pulse/collect', {
    method: 'POST', headers: {
      'content-type': 'application/json', 'origin': process.env.APP_ORIGIN!,
    }, body, cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  return new Response(await response.text(), {
    status: response.status, headers: { 'content-type': 'application/json' },
  });
}
```

## Python backend

Send only committed outcomes. Keep the event ID stable across retries and the credential in your secret manager. HTTPS errors must remain retryable in a durable job queue; do not retry every HTTP 4xx.

```python
import json, os, urllib.request
from datetime import datetime, timezone

def record_signup(committed_signup_id):
    payload = {'schemaVersion': 1, 'siteId': os.environ['PULSE_SITE_ID'],
      'environment': 'production', 'events': [{
        'id': 'signup_' + str(committed_signup_id), 'name': 'signup',
        'timestamp': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'properties': {'channel': 'native'}}]}
    request = urllib.request.Request(
      'https://pulse.axxes.app/api/pulse/server-events',
      data=json.dumps(payload).encode(), method='POST', headers={
        'Authorization': 'Bearer ' + os.environ['PULSE_SERVER_KEY'],
        'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.load(response)
```

## Swift / Kotlin clients

Use your app's existing authenticated backend action (for example a committed signup endpoint). The backend validates the action and records the event with the server SDK. Never ship a Pulse server credential in a mobile binary. There is no public native SDK in v1.

```swift
// Illustrative: your authenticated backend owns analytics acceptance.
var request = URLRequest(url: URL(string: "https://YOUR_APP/api/signup")!)
request.httpMethod = "POST"
request.setValue("Bearer \(yourAppSession)", forHTTPHeaderField: "Authorization")
let (_, response) = try await URLSession.shared.data(for: request)
// Backend queues signup after its own transaction commits.
```

```kotlin
// Illustrative: use your existing authenticated HTTP client.
val response = client.post("https://YOUR_APP/api/signup") {
    bearerAuth(yourAppSession)
}
// Backend queues signup after its own transaction commits.
```

## Collection limits and methods

A batch contains 1–50 events, at most 32 KiB; each event has at most 20 scalar properties. Accepted timestamps are no more than one day old or five minutes ahead. Public collection cannot submit revenue. Server purchase events use nonnegative integer minor units and a three-letter currency; reports keep currencies separate. Stable IDs deduplicate retries.

Raw retention is 90 days; daily operational aggregates are retained for 365 days. Report requests read at most 100,000 events and return a capacity error above that threshold. Default visitor identity rotates daily and remains scoped to the app; persistent identity requires opt-in consent. Do not include user contents or personal information in custom properties.
