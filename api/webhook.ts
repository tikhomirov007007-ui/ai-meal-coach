import type { VercelRequest, VercelResponse } from "@vercel/node";
import { webhookCallback } from "grammy";
import { getBotInstance } from "../src/bot/instance";

let webhookHandler: ReturnType<typeof webhookCallback> | null = null;

async function getHandler() {
  if (!webhookHandler) {
    const bot = await getBotInstance();
    webhookHandler = webhookCallback(bot, "http");
  }
  return webhookHandler;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === "GET") {
    res.status(200).json({ status: "webhook ready" });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const secret = typeof req.query.secret === "string" ? req.query.secret : "";
  const expected = process.env.WEBHOOK_SECRET ?? "";

  if (!expected || secret !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const handle = await getHandler();
    await handle(req, res);
  } catch (err) {
    console.error("Webhook error:", err);
    if (!res.headersSent) {
      res.status(200).json({ ok: true });
    }
  }
}
