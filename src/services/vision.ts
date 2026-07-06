import OpenAI from "openai";
import { config } from "../config";
import type { FoodAnalysis } from "../types";

const openai = new OpenAI({ apiKey: config.openaiApiKey });

const SYSTEM_PROMPT = `You are a nutrition expert. Analyze food photos and estimate nutritional values.
Respond ONLY with valid JSON in this exact format:
{
  "dish_name": "Name of the dish in Russian",
  "calories": 450,
  "protein_g": 25,
  "fat_g": 15,
  "carbs_g": 40,
  "confidence": 0.85,
  "advice": "Brief friendly advice in Russian (1 sentence)"
}
Be realistic with portion sizes. If multiple items visible, combine into one dish name or list main dish.`;

export async function analyzeFoodPhoto(imageBuffer: Buffer, mimeType = "image/jpeg"): Promise<FoodAnalysis> {
  const base64 = imageBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 500,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Identify all food items, estimate portion size, calculate calories and macros.",
          },
          { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
        ],
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from Vision API");
  }

  const parsed = JSON.parse(content) as FoodAnalysis;
  return {
    dish_name: parsed.dish_name ?? "Неизвестное блюдо",
    calories: Math.round(parsed.calories ?? 0),
    protein_g: Math.round((parsed.protein_g ?? 0) * 10) / 10,
    fat_g: Math.round((parsed.fat_g ?? 0) * 10) / 10,
    carbs_g: Math.round((parsed.carbs_g ?? 0) * 10) / 10,
    confidence: parsed.confidence ?? 0.7,
    advice: parsed.advice,
  };
}
