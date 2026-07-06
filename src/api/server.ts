import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import { config } from "../config";
import {
  ensureUser,
  getDailyStats,
  getMealsForDate,
  getMealsLastDays,
  getUser,
  getWeeklyStats,
  isPremiumActive,
  updateMealPortion,
  updateUserGoal,
  updateUserTimezone,
} from "../db";
import { validateInitData } from "../services/telegramAuth";
import { todayDateStr } from "../utils/format";

interface AuthedRequest extends Request {
  telegramUserId?: number;
}

function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction): void {
  const initData = (req.headers["x-telegram-init-data"] as string) ?? req.query.initData;

  if ((!initData || typeof initData !== "string") && config.devMode) {
    req.telegramUserId = 1;
    next();
    return;
  }

  if (!initData || typeof initData !== "string") {
    res.status(401).json({ error: "Missing initData" });
    return;
  }

  const user = validateInitData(initData);
  if (!user) {
    res.status(401).json({ error: "Invalid initData" });
    return;
  }

  req.telegramUserId = user.id;
  next();
}

export function createApiRouter(): express.Router {
  const router = express.Router();
  router.use(cors());
  router.use(express.json());

  router.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  router.use(authMiddleware);

  router.get("/me", async (req: AuthedRequest, res: Response) => {
    const userId = req.telegramUserId!;
    const tgUser = validateInitData(
      (req.headers["x-telegram-init-data"] as string) ?? (req.query.initData as string)
    );

    const user = await ensureUser(
      userId,
      tgUser?.first_name,
      tgUser?.last_name,
      tgUser?.username
    );

    res.json({
      user_id: user.user_id,
      first_name: user.first_name,
      goal_kcal: user.goal_kcal,
      timezone: user.timezone,
      is_premium: isPremiumActive(user),
      premium_until: user.premium_until,
    });
  });

  router.patch("/me", async (req: AuthedRequest, res: Response) => {
    const userId = req.telegramUserId!;
    const { goal_kcal, timezone } = req.body;

    let user = await getUser(userId);
    if (!user) {
      user = await ensureUser(userId);
    }

    if (goal_kcal !== undefined) {
      const value = parseInt(goal_kcal, 10);
      if (value >= 500 && value <= 10000) {
        user = await updateUserGoal(userId, value);
      }
    }

    if (timezone !== undefined && typeof timezone === "string") {
      user = await updateUserTimezone(userId, timezone);
    }

    res.json({
      user_id: user.user_id,
      goal_kcal: user.goal_kcal,
      timezone: user.timezone,
      is_premium: isPremiumActive(user),
    });
  });

  router.get("/meals/today", async (req: AuthedRequest, res: Response) => {
    const userId = req.telegramUserId!;
    const date = (req.query.date as string) ?? todayDateStr();
    const [meals, stats, user] = await Promise.all([
      getMealsForDate(userId, date),
      getDailyStats(userId, date),
      getUser(userId),
    ]);

    res.json({
      date,
      meals,
      stats,
      goal_kcal: user?.goal_kcal ?? 2000,
    });
  });

  router.get("/meals/history", async (req: AuthedRequest, res: Response) => {
    const userId = req.telegramUserId!;
    const days = parseInt((req.query.days as string) ?? "7", 10);
    const meals = await getMealsLastDays(userId, days);

    const grouped: Record<string, typeof meals> = {};
    for (const meal of meals) {
      const dateKey = meal.meal_date.toString().slice(0, 10);
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(meal);
    }

    res.json({ days, grouped });
  });

  router.get("/stats/weekly", async (req: AuthedRequest, res: Response) => {
    const userId = req.telegramUserId!;
    const [stats, user] = await Promise.all([getWeeklyStats(userId), getUser(userId)]);

    res.json({
      ...stats,
      goal_kcal: user?.goal_kcal ?? 2000,
    });
  });

  router.patch("/meals/:id/portion", async (req: AuthedRequest, res: Response) => {
    const userId = req.telegramUserId!;
    const mealId = parseInt(String(req.params.id), 10);
    const { grams, base_grams } = req.body;

    const base = parseFloat(base_grams) || 100;
    const newGrams = parseFloat(grams) || base;
    const multiplier = newGrams / base;

    const meal = await updateMealPortion(mealId, userId, multiplier);
    if (!meal) {
      res.status(404).json({ error: "Meal not found" });
      return;
    }

    res.json(meal);
  });

  return router;
}

export function createApp(options: { serveStatic?: boolean } = {}): express.Application {
  const { serveStatic = true } = options;
  const app = express();

  app.use("/api", createApiRouter());

  if (serveStatic) {
    const miniAppPath = path.join(__dirname, "../../mini-app");
    app.use("/mini-app", express.static(miniAppPath));
    app.get("/mini-app", (_req, res) => {
      res.sendFile(path.join(miniAppPath, "index.html"));
    });
  }

  return app;
}
