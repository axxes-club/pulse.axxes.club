import { AnalyticsError } from "./access";
import { ZodError } from "zod";
export async function readJson(request: Request) {
  if (
    !["application/json", "text/plain"].some((type) =>
      request.headers.get("content-type")?.startsWith(type),
    )
  )
    throw new AnalyticsError("Send JSON or text/plain", 415);
  if (Number(request.headers.get("content-length") || 0) > 32768)
    throw new AnalyticsError("Payload too large", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AnalyticsError("Request body required");
  let size = 0,
    text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32768) {
        await reader.cancel();
        throw new AnalyticsError("Payload too large", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch (e) {
    if (e instanceof AnalyticsError) throw e;
    throw new AnalyticsError("Invalid JSON");
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof AnalyticsError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return Response.json(
      {
        error: "Invalid request fields",
        fields: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23505"
  )
    return Response.json(
      { error: "An app with this name already exists in this environment" },
      { status: 409 },
    );
  console.error(
    "Pulse request failed",
    error instanceof Error ? error.name : "Unknown",
  );
  return Response.json(
    { error: "Pulse could not complete this request. Try again shortly." },
    { status: 503 },
  );
}
export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const allowed = [
    "https://pulse.axxes.app",
    "https://pulse.axxes.club",
    process.env.BETTER_AUTH_URL,
  ];
  if (process.env.NODE_ENV !== "production") {
    const local = new URL(request.url);
    if (["localhost", "127.0.0.1"].includes(local.hostname))
      allowed.push(local.origin);
  }
  if (!origin || !allowed.includes(origin))
    throw new AnalyticsError(
      "Cross-origin administration is not permitted",
      403,
    );
}
