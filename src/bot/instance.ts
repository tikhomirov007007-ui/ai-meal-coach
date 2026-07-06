import { createBot } from "./index";
import type { Bot } from "grammy";
import { migrate } from "../db";

let bot: Bot | null = null;
let initPromise: Promise<Bot> | null = null;

export async function getBotInstance(): Promise<Bot> {
  if (bot) return bot;

  if (!initPromise) {
    initPromise = (async () => {
      await migrate();
      bot = createBot();
      return bot;
    })();
  }

  return initPromise;
}

export function resetBotInstance(): void {
  bot = null;
  initPromise = null;
}
