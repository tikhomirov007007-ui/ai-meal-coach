import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBotInstance } from "../src/bot/instance";
import { sendDailyReminders } from "../src/services/notifications";
import { withTimeout } from "../src/lib/vercel";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const auth = req.headers.authorization ?? "";
    const cronSecret = process.env.CRON_SECRET ?? "";

    if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const bot = await withTimeout(getBotInstance(), 15_000, "Cron init");
    const sent = await sendDailyReminders(bot);

    res.status(200).json({ ok: true, sent });
  } catch (err) {
    console.error("Cron error:", err);
    res.status(500).json({
      error: "Cron failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
