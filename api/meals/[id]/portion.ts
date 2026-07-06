import type { VercelRequest, VercelResponse } from "@vercel/node";
import { updateMealPortion } from "../../../src/db";
import { readJsonBody, requireTelegramUser } from "../../../src/lib/vercel";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "PATCH") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const userId = requireTelegramUser(req, res);
    if (!userId) return;

    const mealId = parseInt(String(req.query.id), 10);
    if (!mealId) {
      res.status(400).json({ error: "Missing meal id" });
      return;
    }

    const body = readJsonBody<{ grams?: number; base_grams?: number }>(req);
    const base = parseFloat(String(body.base_grams)) || 100;
    const newGrams = parseFloat(String(body.grams)) || base;
    const multiplier = newGrams / base;

    const meal = await updateMealPortion(mealId, userId, multiplier);
    if (!meal) {
      res.status(404).json({ error: "Meal not found" });
      return;
    }

    res.status(200).json(meal);
  } catch (err) {
    console.error("PATCH /api/meals/[id]/portion error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
