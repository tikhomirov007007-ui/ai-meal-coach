import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateInitData } from "../services/telegramAuth";

export function getTelegramUserId(req: VercelRequest): number | null {
  const initData =
    (req.headers["x-telegram-init-data"] as string) ??
    (typeof req.query.initData === "string" ? req.query.initData : undefined);

  if (!initData) return null;

  const user = validateInitData(initData);
  return user?.id ?? null;
}

export function requireTelegramUser(req: VercelRequest, res: VercelResponse): number | null {
  const userId = getTelegramUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Missing or invalid initData" });
    return null;
  }
  return userId;
}

export function readJsonBody<T = Record<string, unknown>>(req: VercelRequest): T {
  if (req.body && typeof req.body === "object") {
    return req.body as T;
  }
  if (typeof req.body === "string" && req.body.length > 0) {
    return JSON.parse(req.body) as T;
  }
  return {} as T;
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
