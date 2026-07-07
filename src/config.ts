import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const devMode = process.env.DEV_MODE === "true";
const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "";
const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
const publicBaseUrl =
  process.env.WEBHOOK_URL || vercelProductionUrl || vercelUrl || `http://localhost:${process.env.PORT ?? "3000"}`;

export const config = {
  devMode,
  skipBot: process.env.SKIP_BOT === "true" || (devMode && !process.env.VERCEL),
  botToken: devMode && !process.env.VERCEL ? (process.env.BOT_TOKEN ?? "dev-token") : required("BOT_TOKEN"),
  webhookUrl: process.env.WEBHOOK_URL || vercelProductionUrl || vercelUrl,
  webhookSecret: process.env.WEBHOOK_SECRET ?? "dev-secret",
  openaiApiKey: devMode && !process.env.VERCEL ? (process.env.OPENAI_API_KEY ?? "sk-dev") : required("OPENAI_API_KEY"),
  databaseUrl: process.env.DATABASE_URL ?? (devMode && !process.env.VERCEL ? "memory" : required("DATABASE_URL")),
  port: parseInt(process.env.PORT ?? "3000", 10),
  miniAppUrl: process.env.MINI_APP_URL ?? `${publicBaseUrl}/mini-app`,
  nodeEnv: process.env.NODE_ENV ?? "development",
  premiumWeeklyStars: parseInt(process.env.PREMIUM_WEEKLY_STARS ?? "99", 10),
  premiumMonthlyStars: parseInt(process.env.PREMIUM_MONTHLY_STARS ?? "299", 10),
  freeDailyPhotos: parseInt(process.env.FREE_DAILY_PHOTOS ?? "3", 10),
};

export const isProduction = config.nodeEnv === "production";
