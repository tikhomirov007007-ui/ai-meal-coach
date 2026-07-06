import { migrate } from "./db";
import { createBot, setupBotMenu } from "./bot";
import { createApp } from "./api/server";
import { startDailyNotifications } from "./services/notifications";
import { config, isProduction } from "./config";
import { webhookCallback } from "grammy";async function main(): Promise<void> {
  console.log("Starting AI Meal Coach...");

  await migrate();
  console.log("Database ready");

  const app = createApp({ serveStatic: true });

  if (!config.skipBot) {
    const bot = createBot();
    await setupBotMenu(bot);

    if (isProduction && config.webhookUrl) {
      const webhookPath = `/webhook/${config.webhookSecret}`;
      app.use(webhookPath, webhookCallback(bot, "express"));

      await bot.api.setWebhook(`${config.webhookUrl}${webhookPath}`, {
        drop_pending_updates: true,
      });
      console.log(`Webhook set: ${config.webhookUrl}${webhookPath}`);
    } else {
      bot.start({
        onStart: () => console.log("Bot polling started (dev mode)"),
      });
    }

    startDailyNotifications(bot);
  } else {
    console.log("Bot skipped (DEV_MODE / SKIP_BOT)");
  }

  app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port}`);
    console.log(`Mini App: ${config.miniAppUrl}`);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
