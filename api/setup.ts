import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureInitialized, setupTelegramWebhook } from "../src/app";
import { config } from "../src/config";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = req.query.key as string;
  const setupSecret = process.env.SETUP_SECRET;

  if (!setupSecret || key !== setupSecret) {
    res.status(401).json({ error: "Unauthorized. Use ?key=YOUR_SETUP_SECRET" });
    return;
  }

  await ensureInitialized();
  await setupTelegramWebhook();

  res.json({
    ok: true,
    message: "Database migrated and Telegram webhook configured",
    mini_app: config.miniAppUrl,
    webhook: `${config.webhookUrl}/api/webhook?secret=${config.webhookSecret}`,
  });
}
