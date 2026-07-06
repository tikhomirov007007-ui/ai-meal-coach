import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDailyStats, getMealsForDate, getUser } from "../../src/db";
import { todayDateStr } from "../../src/utils/format";
import { requireTelegramUser } from "../../src/lib/vercel";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const userId = requireTelegramUser(req, res);
    if (!userId) return;

    const date = typeof req.query.date === "string" ? req.query.date : todayDateStr();
    const [meals, stats, user] = await Promise.all([
      getMealsForDate(userId, date),
      getDailyStats(userId, date),
      getUser(userId),
    ]);

    res.status(200).json({
      date,
      meals,
      stats,
      goal_kcal: user?.goal_kcal ?? 2000,
    });
  } catch (err) {
    console.error("GET /api/meals/today error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
