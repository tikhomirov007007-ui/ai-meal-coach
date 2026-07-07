import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBotInstance, resetBotInstance } from "../src/bot/instance";
import { config } from "../src/config";
import { withTimeout } from "../src/lib/vercel";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const key = typeof req.query.key === "string" ? req.query.key : "";
    const setupSecret = process.env.SETUP_SECRET ?? "";

    if (!setupSecret || key !== setupSecret) {
      res.status(401).json({ error: "Unauthorized. Use ?key=YOUR_SETUP_SECRET" });
      return;
    }

    resetBotInstance();
    const bot = await withTimeout(getBotInstance(), 20_000, "Setup");

    const webhookUrl = `${config.webhookUrl}/api/webhook?secret=${config.webhookSecret}`;

    await bot.api.deleteWebhook({ drop_pending_updates: true });
    await bot.api.setWebhook(webhookUrl, {
      drop_pending_updates: true,
      allowed_updates: ["message", "callback_query", "pre_checkout_query"],
    });

    try {
      await bot.api.setChatMenuButton({
        menu_button: {
          type: "web_app",
          text: "Open App",
          web_app: { url: config.miniAppUrl },
        },
      });
    } catch (menuErr) {
      console.warn("Menu button setup failed:", menuErr);
    }

    const webhookInfo = await bot.api.getWebhookInfo();
    const me = await bot.api.getMe();

    res.status(200).json({
      ok: true,
      message: "Database migrated and Telegram webhook configured",
      bot: { id: me.id, username: me.username },
      mini_app: config.miniAppUrl,
      webhook_url: webhookUrl,
      webhook_info: {
        url: webhookInfo.url,
        pending_update_count: webhookInfo.pending_update_count,
        last_error_message: webhookInfo.last_error_message,
        last_error_date: webhookInfo.last_error_date,
      },
    });
  } catch (err) {
    console.error("Setup error:", err);
    res.status(500).json({
      error: "Setup failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
