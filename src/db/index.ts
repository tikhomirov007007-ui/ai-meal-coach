import { Pool } from "pg";
import { newDb } from "pg-mem";
import fs from "fs";
import path from "path";
import { config } from "../config";
import type { DailyStats, Meal, User, WeeklyStats } from "../types";

function createPool(): Pool {
  if (config.databaseUrl === "memory") {
    const db = newDb({ autoCreateForeignKeyIndices: true });
    db.public.registerFunction({
      name: "current_date",
      returns: "date" as never,
      implementation: () => new Date().toISOString().slice(0, 10),
    });
    db.public.registerFunction({
      name: "now",
      returns: "timestamptz" as never,
      implementation: () => new Date(),
    });
    const { Pool: MemPool } = db.adapters.createPg();
    return new MemPool();
  }
  return new Pool({ connectionString: config.databaseUrl });
}

export const pool = createPool();

export async function migrate(): Promise<void> {
  const schemaPath = path.join(__dirname, "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf-8");
  await pool.query(sql);
}

export async function ensureUser(
  userId: number,
  firstName?: string,
  lastName?: string,
  username?: string
): Promise<User> {
  const result = await pool.query<User>(
    `INSERT INTO users (user_id, first_name, last_name, username)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       first_name = COALESCE(EXCLUDED.first_name, users.first_name),
       last_name = COALESCE(EXCLUDED.last_name, users.last_name),
       username = COALESCE(EXCLUDED.username, users.username)
     RETURNING *`,
    [userId, firstName ?? null, lastName ?? null, username ?? null]
  );
  return result.rows[0];
}

export async function getUser(userId: number): Promise<User | null> {
  const result = await pool.query<User>("SELECT * FROM users WHERE user_id = $1", [userId]);
  return result.rows[0] ?? null;
}

export async function updateUserGoal(userId: number, goalKcal: number): Promise<User> {
  const result = await pool.query<User>(
    "UPDATE users SET goal_kcal = $2 WHERE user_id = $1 RETURNING *",
    [userId, goalKcal]
  );
  return result.rows[0];
}

export async function updateUserTimezone(userId: number, timezone: string): Promise<User> {
  const result = await pool.query<User>(
    "UPDATE users SET timezone = $2 WHERE user_id = $1 RETURNING *",
    [userId, timezone]
  );
  return result.rows[0];
}

export function isPremiumActive(user: User): boolean {
  if (!user.is_premium) return false;
  if (!user.premium_until) return true;
  return new Date(user.premium_until) > new Date();
}

export async function setPremium(userId: number, days: number): Promise<void> {
  await pool.query(
    `UPDATE users SET is_premium = TRUE,
     premium_until = GREATEST(COALESCE(premium_until, NOW()), NOW()) + ($2 * INTERVAL '1 day')
     WHERE user_id = $1`,
    [userId, days]
  );
}

export async function getTodayUploadCount(userId: number): Promise<number> {
  await pool.query(
    `INSERT INTO daily_uploads (user_id, upload_date, count)
     VALUES ($1, CURRENT_DATE, 0)
     ON CONFLICT (user_id, upload_date) DO NOTHING`,
    [userId]
  );
  const result = await pool.query<{ count: number }>(
    "SELECT count FROM daily_uploads WHERE user_id = $1 AND upload_date = CURRENT_DATE",
    [userId]
  );
  return result.rows[0]?.count ?? 0;
}

export async function incrementUploadCount(userId: number): Promise<number> {
  const result = await pool.query<{ count: number }>(
    `INSERT INTO daily_uploads (user_id, upload_date, count)
     VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (user_id, upload_date)
     DO UPDATE SET count = daily_uploads.count + 1
     RETURNING count`,
    [userId]
  );
  return result.rows[0].count;
}

export async function savePendingMeal(
  userId: number,
  meal: { dish_name: string; calories: number; protein: number; fat: number; carbs: number; advice?: string }
): Promise<number> {
  const result = await pool.query<{ id: number }>(
    `INSERT INTO pending_meals (user_id, dish_name, calories, protein, fat, carbs, advice)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [userId, meal.dish_name, meal.calories, meal.protein, meal.fat, meal.carbs, meal.advice ?? null]
  );
  return result.rows[0].id;
}

export async function getPendingMeal(id: number, userId: number) {
  const result = await pool.query(
    "SELECT * FROM pending_meals WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return result.rows[0] ?? null;
}

export async function saveMeal(
  userId: number,
  meal: { dish_name: string; calories: number; protein: number; fat: number; carbs: number; meal_date?: string }
): Promise<Meal> {
  const result = await pool.query<Meal>(
    `INSERT INTO meals (user_id, dish_name, calories, protein, fat, carbs, meal_date)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::date, CURRENT_DATE))
     RETURNING *`,
    [userId, meal.dish_name, meal.calories, meal.protein, meal.fat, meal.carbs, meal.meal_date ?? null]
  );
  return result.rows[0];
}

export async function deletePendingMeal(id: number): Promise<void> {
  await pool.query("DELETE FROM pending_meals WHERE id = $1", [id]);
}

export async function getMealsForDate(userId: number, date: string): Promise<Meal[]> {
  const result = await pool.query<Meal>(
    "SELECT * FROM meals WHERE user_id = $1 AND meal_date = $2 ORDER BY created_at ASC",
    [userId, date]
  );
  return result.rows;
}

export async function getMealsLastDays(userId: number, days: number): Promise<Meal[]> {
  const result = await pool.query<Meal>(
    `SELECT * FROM meals WHERE user_id = $1 AND meal_date >= CURRENT_DATE - $2::INTEGER
     ORDER BY meal_date DESC, created_at DESC`,
    [userId, days - 1]
  );
  return result.rows;
}

export async function getDailyStats(userId: number, date: string): Promise<DailyStats> {
  const result = await pool.query<DailyStats>(
    `SELECT $2::date AS date,
       COALESCE(SUM(calories), 0)::INTEGER AS total_calories,
       COALESCE(SUM(protein), 0)::REAL AS total_protein,
       COALESCE(SUM(fat), 0)::REAL AS total_fat,
       COALESCE(SUM(carbs), 0)::REAL AS total_carbs,
       COUNT(*)::INTEGER AS meal_count
     FROM meals WHERE user_id = $1 AND meal_date = $2`,
    [userId, date]
  );
  return result.rows[0];
}

export async function getWeeklyStats(userId: number): Promise<WeeklyStats> {
  const daysResult = await pool.query<DailyStats>(
    `SELECT meal_date::text AS date,
       SUM(calories)::INTEGER AS total_calories,
       SUM(protein)::REAL AS total_protein,
       SUM(fat)::REAL AS total_fat,
       SUM(carbs)::REAL AS total_carbs,
       COUNT(*)::INTEGER AS meal_count
     FROM meals
     WHERE user_id = $1 AND meal_date >= CURRENT_DATE - 6
     GROUP BY meal_date
     ORDER BY meal_date ASC`,
    [userId]
  );

  const days = daysResult.rows;
  const activeDays = days.filter((d) => d.meal_count > 0);
  const avg = (field: keyof DailyStats) =>
    activeDays.length
      ? activeDays.reduce((sum, d) => sum + (Number(d[field]) || 0), 0) / activeDays.length
      : 0;

  const topResult = await pool.query<{ dish_name: string; count: number }>(
    `SELECT dish_name, COUNT(*)::INTEGER AS count FROM meals
     WHERE user_id = $1 AND meal_date >= CURRENT_DATE - 6
     GROUP BY dish_name ORDER BY count DESC LIMIT 5`,
    [userId]
  );

  return {
    days,
    avg_calories: Math.round(avg("total_calories")),
    avg_protein: Math.round(avg("total_protein")),
    avg_fat: Math.round(avg("total_fat")),
    avg_carbs: Math.round(avg("total_carbs")),
    top_dishes: topResult.rows,
  };
}

export async function getAllUserIds(): Promise<number[]> {
  const result = await pool.query<{ user_id: number }>("SELECT user_id FROM users");
  return result.rows.map((r) => r.user_id);
}

export async function updateMealPortion(
  mealId: number,
  userId: number,
  multiplier: number
): Promise<Meal | null> {
  const existing = await pool.query<Meal>(
    "SELECT * FROM meals WHERE id = $1 AND user_id = $2",
    [mealId, userId]
  );
  if (!existing.rows[0]) return null;

  const meal = existing.rows[0];
  const result = await pool.query<Meal>(
    `UPDATE meals SET
       calories = ROUND($3 * $4),
       protein = ROUND(($5 * $4)::numeric, 1),
       fat = ROUND(($6 * $4)::numeric, 1),
       carbs = ROUND(($7 * $4)::numeric, 1)
     WHERE id = $1 AND user_id = $2 RETURNING *`,
    [mealId, userId, meal.calories, multiplier, meal.protein, meal.fat, meal.carbs]
  );
  return result.rows[0];
}
