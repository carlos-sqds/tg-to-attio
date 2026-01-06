import { NextResponse } from "next/server";
import { getWebhookHandler } from "@/src/lib/telegram/bot.setup";

/**
 * Telegram webhook handler.
 * Uses grammY's webhookCallback for stateless request handling.
 * State is persisted in Vercel KV between requests.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const handleUpdate = getWebhookHandler();
    return await handleUpdate(req);
  } catch (error) {
    console.error("[Webhook] Error:", error);
    // Always return 200 to Telegram to prevent retries
    return NextResponse.json({ ok: true });
  }
}

/**
 * Health check endpoint.
 */
export async function GET(): Promise<Response> {
  return NextResponse.json({
    status: "Attio-TG webhook is active",
    version: "2.0.0",
  });
}
