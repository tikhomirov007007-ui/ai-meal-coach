import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBotInstance } from "../src/bot/instance";
import { withTimeout } from "../src/lib/vercel";

function parseUpdate(req: VercelRequest): Record<string, unknown> | null {
  const body = req.body;

  if (body && typeof body === "object" && !Buffer.isBuffer(body)) {
    return body as Record<string, unknown>;
  }

  if (typeof body === "string" && body.length > 0) {
    return JSON.parse(body) as Record<string, unknown>;
  }

  if (Buffer.isBuffer(body)) {
    return JSON.parse(body.toString("utf8")) as Record<string, unknown>;
  }

  return null;
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
    const update = parseUpdate(req);
    if (!update) {
      res.status(400).json({ error: "Empty update body" });
      return;
    }

    console.log("Webhook update:", update.update_id, Object.keys(update));

    const bot = await withTimeout(getBotInstance(), 20_000, "Bot init");
    await withTimeout(bot.handleUpdate(update), 55_000, "Handle update");

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(200).json({ ok: true, error: err instanceof Error ? err.message : String(err) });
  }
}
