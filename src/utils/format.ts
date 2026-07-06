import type { FoodAnalysis } from "../types";

export function formatMealCard(analysis: FoodAnalysis): string {
  const confidencePct = Math.round(analysis.confidence * 100);
  let text = `🍽 <b>${escapeHtml(analysis.dish_name)}</b>\n\n`;
  text += `🔥 <b>${analysis.calories}</b> ккал\n\n`;
  text += `📊 Макросы:\n`;
  text += `  • Белки: ${analysis.protein_g}g\n`;
  text += `  • Жиры: ${analysis.fat_g}g\n`;
  text += `  • Углеводы: ${analysis.carbs_g}g\n`;
  text += `\n<i>Точность: ${confidencePct}%</i>`;

  if (analysis.advice) {
    text += `\n\n💡 ${escapeHtml(analysis.advice)}`;
  }

  return text;
}

export function formatDailySummary(
  totalCalories: number,
  goalKcal: number,
  mealCount: number
): string {
  const remaining = goalKcal - totalCalories;
  const emoji = remaining >= 0 ? "✅" : "⚠️";
  return (
    `${emoji} Сегодня: <b>${totalCalories}</b> / ${goalKcal} ккал\n` +
    `Приёмов пищи: ${mealCount}\n` +
    (remaining >= 0
      ? `Осталось: ${remaining} ккал`
      : `Превышение: ${Math.abs(remaining)} ккал`)
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}
