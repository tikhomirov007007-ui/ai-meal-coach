import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getMealsLastDays } from "../../../src/db";
import { requireTelegramUser } from "../../../src/lib/vercel";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const userId = requireTelegramUser(req, res);
    if (!userId) return;

    const days = parseInt(typeof req.query.days === "string" ? req.query.days : "7", 10);
    const meals = await getMealsLastDays(userId, days);

    const grouped: Record<string, typeof meals> = {};
    for (const meal of meals) {
      const dateKey = meal.meal_date.toString().slice(0, 10);
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(meal);
    }

    res.status(200).json({ days, grouped });
  } catch (err) {
    console.error("GET /api/meals/history error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
