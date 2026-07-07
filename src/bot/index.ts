import { Bot, Context, InlineKeyboard, Keyboard } from "grammy";
import { config } from "../config";
import {
  ensureUser,
  getDailyStats,
  getMealsForDate,
  getPendingMeal,
  getTodayUploadCount,
  getUser,
  incrementUploadCount,
  isPremiumActive,
  saveMeal,
  savePendingMeal,
  deletePendingMeal,
  updateUserGoal,
} from "../db";
import { analyzeFoodPhoto } from "../services/vision";
import { formatDailySummary, formatMealCard, todayDateStr } from "../utils/format";

export function createBot(): Bot {
  const bot = new Bot(config.botToken);

  bot.catch(async (err) => {
    console.error("Bot handler error:", err.error);
    const ctx = err.ctx;
    try {
      await ctx.reply("❌ Произошла ошибка. Попробуй ещё раз или отправь /start.");
    } catch {
      // ignore secondary failures
    }
  });

  void bot.api.setMyCommands([
    { command: "photo", description: "Загрузить фото блюда" },
    { command: "history", description: "История за сегодня" },
    { command: "stats", description: "Статистика за неделю" },
    { command: "goal", description: "Установить норму калорий" },
    { command: "premium", description: "Premium подписка" },
    { command: "help", description: "FAQ" },
  ]);

  bot.command("start", async (ctx) => {
    try {
      await registerUser(ctx);
    } catch (err) {
      console.error("registerUser failed:", err);
    }

    await ctx.reply(
      "👋 Привет! Я <b>AI Meal Coach</b> — твой персональный тренер по питанию.\n\n" +
        "📸 Загрузи фото блюда — узнаешь калории и макросы за 3 секунды.\n\n" +
        "Используй /photo или просто отправь фото прямо в чат!",
      { parse_mode: "HTML", reply_markup: textKeyboard() }
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "<b>Как пользоваться:</b>\n\n" +
        "📸 /photo — отправь фото блюда\n" +
        "📋 /history — что ел сегодня\n" +
        "📊 /stats — статистика за неделю\n" +
        "🎯 /goal 2000 — установить дневную норму\n" +
        "⭐ /premium — безлимитное распознавание\n\n" +
        "<b>Free:</b> 3 фото в день\n" +
        "<b>Premium:</b> безлимит + расширенная аналитика",
      { parse_mode: "HTML" }
    );
  });

  bot.command("photo", async (ctx) => {
    await ctx.reply("📸 Отправь фото блюда — я распознаю и посчитаю калории!");
  });

  bot.command("history", async (ctx) => {
    if (!ctx.from) return;
    const user = await ensureUser(ctx.from.id);
    const meals = await getMealsForDate(ctx.from.id, todayDateStr());

    if (meals.length === 0) {
      await ctx.reply("Сегодня ещё ничего не записано. Отправь фото блюда!");
      return;
    }

    const stats = await getDailyStats(ctx.from.id, todayDateStr());
    let text = formatDailySummary(stats.total_calories, user.goal_kcal, stats.meal_count) + "\n\n";

    for (const meal of meals) {
      text += `• ${meal.dish_name} — ${meal.calories} ккал\n`;
    }

    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: statsKeyboard(),
    });
  });

  bot.command("stats", async (ctx) => {
    await ctx.reply("📊 Открой статистику в приложении:", {
      reply_markup: miniAppKeyboard("stats"),
    });
  });

  bot.command("goal", async (ctx) => {
    if (!ctx.from) return;
    const args = ctx.message?.text?.split(" ");
    const value = parseInt(args?.[1] ?? "", 10);

    if (!value || value < 500 || value > 10000) {
      const user = await getUser(ctx.from.id);
      await ctx.reply(
        `🎯 Текущая норма: <b>${user?.goal_kcal ?? 2000}</b> ккал/день\n\n` +
          "Чтобы изменить: /goal 2000",
        { parse_mode: "HTML" }
      );
      return;
    }

    await updateUserGoal(ctx.from.id, value);
    await ctx.reply(`✅ Дневная норма установлена: <b>${value}</b> ккал`, {
      parse_mode: "HTML",
    });
  });

  bot.command("premium", async (ctx) => {
    await sendPremiumOffer(ctx);
  });

  bot.hears("📸 Фото", async (ctx) => {
    await ctx.reply("📸 Отправь фото блюда — я распознаю и посчитаю калории!");
  });

  bot.hears("📋 История", async (ctx) => {
    if (!ctx.from) return;
    const user = await ensureUser(ctx.from.id);
    const meals = await getMealsForDate(ctx.from.id, todayDateStr());

    if (meals.length === 0) {
      await ctx.reply("Сегодня ещё ничего не записано. Отправь фото блюда!");
      return;
    }

    const stats = await getDailyStats(ctx.from.id, todayDateStr());
    let text = formatDailySummary(stats.total_calories, user.goal_kcal, stats.meal_count) + "\n\n";
    for (const meal of meals) {
      text += `• ${meal.dish_name} — ${meal.calories} ккал\n`;
    }
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: statsKeyboard() });
  });

  bot.on("message:photo", async (ctx) => {
    if (!ctx.from) return;
    await handlePhoto(ctx);
  });

  bot.on("message:document", async (ctx) => {
    if (!ctx.from) return;
    const doc = ctx.message.document;
    if (!doc.mime_type?.startsWith("image/")) return;
    await handlePhoto(ctx, doc.file_id);
  });

  bot.callbackQuery(/^save:(\d+)$/, async (ctx) => {
    if (!ctx.from) return;
    const pendingId = parseInt(ctx.match[1], 10);
    const pending = await getPendingMeal(pendingId, ctx.from.id);

    if (!pending) {
      await ctx.answerCallbackQuery({ text: "Блюдо не найдено", show_alert: true });
      return;
    }

    await saveMeal(ctx.from.id, {
      dish_name: pending.dish_name,
      calories: pending.calories,
      protein: pending.protein,
      fat: pending.fat,
      carbs: pending.carbs,
    });
    await deletePendingMeal(pendingId);

    const user = await getUser(ctx.from.id);
    const stats = await getDailyStats(ctx.from.id, todayDateStr());

    await ctx.answerCallbackQuery({ text: "✅ Сохранено в историю!" });
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    await ctx.reply(
      `✅ <b>${pending.dish_name}</b> сохранено!\n\n` +
        formatDailySummary(stats.total_calories, user?.goal_kcal ?? 2000, stats.meal_count),
      {
        parse_mode: "HTML",
        reply_markup: statsKeyboard(),
      }
    );
  });

  bot.callbackQuery("open_app", async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("premium_weekly", async (ctx) => {
    if (!ctx.from) return;
    await ctx.answerCallbackQuery();
    await sendInvoice(ctx, "weekly");
  });

  bot.callbackQuery("premium_monthly", async (ctx) => {
    if (!ctx.from) return;
    await ctx.answerCallbackQuery();
    await sendInvoice(ctx, "monthly");
  });

  bot.on("pre_checkout_query", async (ctx) => {
    await ctx.answerPreCheckoutQuery(true);
  });

  bot.on("message:successful_payment", async (ctx) => {
    if (!ctx.from) return;
    const payment = ctx.message.successful_payment;
    const payload = payment.invoice_payload;

    const days = payload.includes("monthly") ? 30 : 7;
    const { setPremium } = await import("../db");
    await setPremium(ctx.from.id, days);

    await ctx.reply(
      `⭐ Premium активирован на ${days} дней!\n\n` +
        "Теперь у тебя безлимитное распознавание фото и расширенная аналитика.",
      { reply_markup: mainKeyboard() }
    );
  });

  return bot;
}

async function registerUser(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  await ensureUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
}

async function handlePhoto(ctx: Context, fileId?: string): Promise<void> {
  if (!ctx.from) return;

  const user = await ensureUser(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
  const premium = isPremiumActive(user);

  if (!premium) {
    const count = await getTodayUploadCount(ctx.from.id);
    if (count >= config.freeDailyPhotos) {
      await ctx.reply(
        `⚠️ Лимит free-тарифа: ${config.freeDailyPhotos} фото в день.\n\n` +
          "Upgrade to Premium для безлимитного распознавания!",
        { reply_markup: premiumKeyboard() }
      );
      return;
    }
  }

  const statusMsg = await ctx.reply("🔍 Анализирую фото...");

  try {
    const photoFileId =
      fileId ?? ctx.message?.photo?.[ctx.message.photo.length - 1]?.file_id;
    if (!photoFileId) {
      await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, "❌ Не удалось получить фото");
      return;
    }

    const file = await ctx.api.getFile(photoFileId);
    const fileUrl = `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`;
    const response = await fetch(fileUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    const analysis = await analyzeFoodPhoto(buffer);

    if (!premium) {
      await incrementUploadCount(ctx.from.id);
    }

    const pendingId = await savePendingMeal(ctx.from.id, {
      dish_name: analysis.dish_name,
      calories: analysis.calories,
      protein: analysis.protein_g,
      fat: analysis.fat_g,
      carbs: analysis.carbs_g,
      advice: analysis.advice,
    });

    const keyboard = new InlineKeyboard()
      .text("💾 Сохранить в историю", `save:${pendingId}`)
      .row()
      .webApp("📊 Открыть в приложении", `${config.miniAppUrl}?tab=today`);

    await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, formatMealCard(analysis), {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (err) {
    console.error("Photo analysis error:", err);
    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      "❌ Не удалось распознать блюдо. Попробуй другое фото или лучшее освещение."
    );
  }
}

async function sendPremiumOffer(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const user = await getUser(ctx.from.id);

  if (user && isPremiumActive(user)) {
    const until = user.premium_until
      ? new Date(user.premium_until).toLocaleDateString("ru-RU")
      : "бессрочно";
    await ctx.reply(`⭐ Premium активен до ${until}`, { reply_markup: mainKeyboard() });
    return;
  }

  await ctx.reply(
    "⭐ <b>AI Meal Coach Premium</b>\n\n" +
      "• Безлимитное распознавание фото\n" +
      "• История за 90 дней\n" +
      "• Расширенная аналитика макросов\n" +
      "• Персональные рекомендации\n\n" +
      `💫 ${config.premiumWeeklyStars} Stars/неделя или ${config.premiumMonthlyStars} Stars/месяц`,
    { parse_mode: "HTML", reply_markup: premiumKeyboard() }
  );
}

async function sendInvoice(ctx: Context, plan: "weekly" | "monthly"): Promise<void> {
  if (!ctx.from || !ctx.chat) return;

  const isMonthly = plan === "monthly";
  const stars = isMonthly ? config.premiumMonthlyStars : config.premiumWeeklyStars;
  const label = isMonthly ? "Premium — 30 дней" : "Premium — 7 дней";

  await ctx.api.sendInvoice(ctx.chat.id, label, "Безлимитное распознавание + аналитика", `premium_${plan}_${ctx.from.id}`, "XTR", [
    { label, amount: stars },
  ]);
}

function textKeyboard(): Keyboard {
  return new Keyboard().text("📸 Фото").text("📋 История").resized();
}

function mainKeyboard(): Keyboard {
  if (config.miniAppUrl.startsWith("https://")) {
    return new Keyboard()
      .webApp("📊 Открыть приложение", config.miniAppUrl)
      .row()
      .text("📸 Фото")
      .text("📋 История")
      .resized();
  }
  return textKeyboard();
}

function statsKeyboard(): InlineKeyboard {
  return new InlineKeyboard().webApp("📊 Статистика →", `${config.miniAppUrl}?tab=stats`);
}

function miniAppKeyboard(tab: string): InlineKeyboard {
  return new InlineKeyboard().webApp("📊 Открыть", `${config.miniAppUrl}?tab=${tab}`);
}

function premiumKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(`⭐ ${config.premiumWeeklyStars} Stars/неделя`, "premium_weekly")
    .row()
    .text(`⭐ ${config.premiumMonthlyStars} Stars/месяц`, "premium_monthly");
}

export async function setupBotMenu(bot: Bot): Promise<void> {
  await bot.api.setChatMenuButton({
    menu_button: { type: "web_app", text: "Open App", web_app: { url: config.miniAppUrl } },
  });
}
