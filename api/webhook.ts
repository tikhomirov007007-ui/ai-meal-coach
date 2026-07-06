import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBotInstance } from "../src/bot/instance";
import { withTimeout } from "../src/lib/vercel";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === "GET") {
    res.status(200).json({ status: "webhook ready" });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const secret = typeof req.query.secret === "string" ? req.query.secret : "";
    const expected = process.env.WEBHOOK_SECRET ?? "";

    if (!expected || secret !== expected) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const update = req.body;
    if (!update || typeof update !== "object") {
      res.status(400).json({ error: "Empty update" });
      return;
    }

    const bot = await withTimeout(getBotInstance(), 15_000, "Bot init");
    await bot.handleUpdate(update);

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    // Telegram expects a quick 200 to stop retrying
    res.status(200).json({ ok: true });
  }
}
