export class AnalyticsError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function authorizeSite(
  context: { tenantId: string; role: string },
  site: { tenantId: string; enabled: boolean },
  action: "read" | "manage",
): true {
  if (context.tenantId !== site.tenantId)
    throw new AnalyticsError("App not found", 404);
  if (!site.enabled) throw new AnalyticsError("App is disabled", 403);
  if (action === "manage" && !["owner", "admin"].includes(context.role))
    throw new AnalyticsError(
      "An organization administrator must manage this app",
      403,
    );
  return true;
}
