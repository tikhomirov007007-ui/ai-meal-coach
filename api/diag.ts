import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBotInstance } from "../src/bot/instance";
import { config } from "../src/config";
import { pool } from "../src/db";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const key = typeof req.query.key === "string" ? req.query.key : "";
  const setupSecret = process.env.SETUP_SECRET ?? "";

  if (!setupSecret || key !== setupSecret) {
    res.status(401).json({ error: "Unauthorized. Use ?key=YOUR_SETUP_SECRET" });
    return;
  }

  try {
    const bot = await getBotInstance();
    const webhookInfo = await bot.api.getWebhookInfo();
    const me = await bot.api.getMe();

    let dbOk = false;
    let dbError: string | null = null;
    try {
      await pool.query("SELECT 1");
      dbOk = true;
    } catch (err) {
      dbError = err instanceof Error ? err.message : String(err);
    }

    res.status(200).json({
      ok: true,
      bot: { id: me.id, username: me.username },
      urls: {
        webhook: `${config.webhookUrl}/api/webhook?secret=***`,
        mini_app: config.miniAppUrl,
      },
      env: {
        has_bot_token: Boolean(process.env.BOT_TOKEN),
        has_database: Boolean(process.env.DATABASE_URL),
        has_openai: Boolean(process.env.OPENAI_API_KEY),
        has_webhook_secret: Boolean(process.env.WEBHOOK_SECRET),
      },
      database: { ok: dbOk, error: dbError },
      webhook_info: {
        url: webhookInfo.url,
        pending_update_count: webhookInfo.pending_update_count,
        last_error_message: webhookInfo.last_error_message,
        last_error_date: webhookInfo.last_error_date,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: "Diagnostic failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
