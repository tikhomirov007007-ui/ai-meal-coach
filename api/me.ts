import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  ensureUser,
  getUser,
  isPremiumActive,
  updateUserGoal,
  updateUserTimezone,
} from "../../src/db";
import { validateInitData } from "../../src/services/telegramAuth";
import { requireTelegramUser } from "../../src/lib/vercel";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method === "GET") {
      const userId = requireTelegramUser(req, res);
      if (!userId) return;

      const initData = req.headers["x-telegram-init-data"] as string;
      const tgUser = validateInitData(initData);

      const user = await ensureUser(
        userId,
        tgUser?.first_name,
        tgUser?.last_name,
        tgUser?.username
      );

      res.status(200).json({
        user_id: user.user_id,
        first_name: user.first_name,
        goal_kcal: user.goal_kcal,
        timezone: user.timezone,
        is_premium: isPremiumActive(user),
        premium_until: user.premium_until,
      });
      return;
    }

    if (req.method === "PATCH") {
      const userId = requireTelegramUser(req, res);
      if (!userId) return;

      const body = readJsonBody<{ goal_kcal?: number; timezone?: string }>(req);
      let user = await getUser(userId);
      if (!user) user = await ensureUser(userId);

      if (body.goal_kcal !== undefined) {
        const value = parseInt(String(body.goal_kcal), 10);
        if (value >= 500 && value <= 10000) {
          user = await updateUserGoal(userId, value);
        }
      }

      if (body.timezone !== undefined && typeof body.timezone === "string") {
        user = await updateUserTimezone(userId, body.timezone);
      }

      res.status(200).json({
        user_id: user.user_id,
        goal_kcal: user.goal_kcal,
        timezone: user.timezone,
        is_premium: isPremiumActive(user),
      });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("GET/PATCH /api/me error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
