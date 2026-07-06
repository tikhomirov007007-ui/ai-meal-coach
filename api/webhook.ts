import type { VercelRequest, VercelResponse } from "@vercel/node";
import { webhookCallback } from "grammy";
import { getBot, ensureInitialized } from "../src/app";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = req.query.secret as string;
  const expected = process.env.WEBHOOK_SECRET;

  if (!expected || secret !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  await ensureInitialized();
  const bot = getBot();
  if (!bot) {
    res.status(503).json({ error: "Bot not configured" });
    return;
  }

  const fn = webhookCallback(bot, "https");
  return fn(req, res);
}
