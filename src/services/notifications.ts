import type { Bot } from "grammy";
import { getAllUserIds, getUser } from "../db";

export async function sendDailyReminders(bot: Bot): Promise<number> {
  const userIds = await getAllUserIds();
  let sent = 0;

  for (const userId of userIds) {
    try {
      const user = await getUser(userId);
      if (!user) continue;

      await bot.api.sendMessage(
        userId,
        `🔔 Доброе утро${user.first_name ? `, ${user.first_name}` : ""}!\n\n` +
          `Твоя норма на сегодня: <b>${user.goal_kcal}</b> ккал.\n` +
          "Что на завтрак? Отправь фото блюда в чат!",
        { parse_mode: "HTML" }
      );
      sent++;
    } catch (err) {
      console.warn(`Failed to notify user ${userId}:`, err);
    }
  }

  return sent;
}

export function startDailyNotifications(bot: Bot): void {
  if (process.env.VERCEL) return;

  import("node-cron").then(({ default: cron }) => {
    cron.schedule("0 8 * * *", async () => {
      console.log("Sending daily reminders...");
      await sendDailyReminders(bot);
    });
    console.log("Daily notification cron scheduled (08:00 UTC)");
  });
}
