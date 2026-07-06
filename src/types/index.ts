export interface User {
  user_id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  goal_kcal: number;
  timezone: string;
  is_premium: boolean;
  premium_until: Date | null;
  created_at: Date;
}

export interface Meal {
  id: number;
  user_id: number;
  meal_date: string;
  dish_name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  created_at: Date;
}

export interface FoodAnalysis {
  dish_name: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  confidence: number;
  advice?: string;
}

export interface DailyStats {
  date: string;
  total_calories: number;
  total_protein: number;
  total_fat: number;
  total_carbs: number;
  meal_count: number;
}

export interface WeeklyStats {
  days: DailyStats[];
  avg_calories: number;
  avg_protein: number;
  avg_fat: number;
  avg_carbs: number;
  top_dishes: { dish_name: string; count: number }[];
}
