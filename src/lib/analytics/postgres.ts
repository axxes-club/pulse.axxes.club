import "server-only";
import pg from "pg";
import { AnalyticsError } from "./access";
const globalPools = globalThis as unknown as {
  pulseMetadataPool?: pg.Pool;
  pulseAnalyticsPool?: pg.Pool;
};
function createPool(connectionString:string,max:number){const pool=new pg.Pool({connectionString,max,idleTimeoutMillis:10000,connectionTimeoutMillis:5000});pool.on("error",()=>{console.error("Pulse database idle connection failed");});return pool;}
export function metadataPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new AnalyticsError("AXXES database is not configured", 503);
  return (globalPools.pulseMetadataPool ||= createPool(connectionString,2));
}
export function analyticsPool(): pg.Pool {
  const connectionString = process.env.ANALYTICS_DATABASE_URL;
  if (!connectionString)
    throw new AnalyticsError("Analytics storage is not configured yet", 503);
  if (connectionString === process.env.DATABASE_URL)
    throw new AnalyticsError("Analytics requires isolated storage", 503);
  return (globalPools.pulseAnalyticsPool ||= createPool(connectionString,3));
}
