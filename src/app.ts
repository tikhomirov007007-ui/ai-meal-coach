import type { Application } from "express";
import type { Bot } from "grammy";
import { migrate } from "./db";
import { createBot, setupBotMenu } from "./bot";
import { createApp } from "./api/server";
import { config } from "./config";

let initialized = false;
let initPromise: Promise<void> | null = null;
let app: Application | null = null;
let bot: Bot | null = null;

export async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await migrate();
    app = createApp({ serveStatic: !process.env.VERCEL });
    if (!config.skipBot) {
      bot = createBot();
    }
    initialized = true;
  })();

  return initPromise;
}

export async function getApp(): Promise<Application> {
  await ensureInitialized();
  return app!;
}

export function getBot(): Bot | null {
  return bot;
}

export async function setupTelegramWebhook(): Promise<void> {
  if (!bot || !config.webhookUrl) return;

  const webhookUrl = `${config.webhookUrl}/api/webhook?secret=${config.webhookSecret}`;
  await bot.api.setWebhook(webhookUrl, { drop_pending_updates: true });
  await setupBotMenu(bot);
}
