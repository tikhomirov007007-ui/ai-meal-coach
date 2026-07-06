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
    const bot = await withTimeout(getBotInstance(), 15_000, "Setup");

    const webhookUrl = `${config.webhookUrl}/api/webhook?secret=${config.webhookSecret}`;
    await bot.api.setWebhook(webhookUrl, { drop_pending_updates: true });

    await bot.api.setChatMenuButton({
      menu_button: {
        type: "web_app",
        text: "Open App",
        web_app: { url: config.miniAppUrl },
      },
    });

    res.status(200).json({
      ok: true,
      message: "Database migrated and Telegram webhook configured",
      mini_app: config.miniAppUrl,
      webhook: webhookUrl,
    });
  } catch (err) {
    console.error("Setup error:", err);
    res.status(500).json({
      error: "Setup failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
