import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBot, ensureInitialized } from "../src/app";
import { sendDailyReminders } from "../src/services/notifications";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  await ensureInitialized();
  const bot = getBot();
  if (!bot) {
    res.status(503).json({ error: "Bot not configured" });
    return;
  }

  const sent = await sendDailyReminders(bot);
  res.json({ ok: true, sent });
}
