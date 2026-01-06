import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { searchRecords } from "@/src/workflows/attio.actions";

/**
 * Health check endpoint to verify all services are working.
 *
 * GET /api/test/health
 */
export async function GET(): Promise<Response> {
  const checks: Record<string, { status: "ok" | "error"; message?: string; latency?: string }> = {};

  // Check KV connection
  const kvStart = Date.now();
  try {
    await kv.set("health-check", Date.now(), { ex: 60 });
    const value = await kv.get("health-check");
    if (value) {
      checks.kv = { status: "ok", latency: `${Date.now() - kvStart}ms` };
    } else {
      checks.kv = { status: "error", message: "Could not read value" };
    }
  } catch (error) {
    checks.kv = {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  // Check Attio API
  const attioStart = Date.now();
  try {
    const results = await searchRecords("companies", "test");
    checks.attio = {
      status: "ok",
      latency: `${Date.now() - attioStart}ms`,
      message: `Found ${results.length} results`,
    };
  } catch (error) {
    checks.attio = {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  // Check environment variables
  const requiredEnvVars = [
    "ATTIO_API_KEY",
    "BOT_TOKEN",
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
    "AI_GATEWAY_API_KEY",
  ];

  const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);
  if (missingEnvVars.length === 0) {
    checks.env = { status: "ok" };
  } else {
    checks.env = {
      status: "error",
      message: `Missing: ${missingEnvVars.join(", ")}`,
    };
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok");

  return NextResponse.json(
    {
      status: allOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allOk ? 200 : 503 }
  );
}
