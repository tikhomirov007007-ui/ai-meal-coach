import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUser, getWeeklyStats } from "../../src/db";
import { requireTelegramUser } from "../../src/lib/vercel";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const userId = requireTelegramUser(req, res);
    if (!userId) return;

    const [stats, user] = await Promise.all([getWeeklyStats(userId), getUser(userId)]);

    res.status(200).json({
      ...stats,
      goal_kcal: user?.goal_kcal ?? 2000,
    });
  } catch (err) {
    console.error("GET /api/stats/weekly error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
