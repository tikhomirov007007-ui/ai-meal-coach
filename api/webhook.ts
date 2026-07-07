import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Update } from "grammy/types";
import { getBotInstance } from "../src/bot/instance";

async function readUpdate(req: VercelRequest): Promise<Update> {
  const body = req.body;

  if (body && typeof body === "object" && !Buffer.isBuffer(body)) {
    return body as Update;
  }

  if (typeof body === "string" && body.length > 0) {
    return JSON.parse(body) as Update;
  }

  if (Buffer.isBuffer(body)) {
    return JSON.parse(body.toString("utf8")) as Update;
  }

  const chunks: Buffer[] = [];
  const readPromise = new Promise<void>((resolve, reject) => {
    req.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve());
    req.on("error", reject);
  });

  const timeout = new Promise<void>((_, reject) => {
    setTimeout(() => reject(new Error("Body read timeout")), 5000);
  });

  await Promise.race([readPromise, timeout]);

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) {
    throw new Error("Empty webhook body");
  }

  return JSON.parse(raw) as Update;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === "GET") {
    res.status(200).json({ status: "webhook ready" });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const secret = typeof req.query.secret === "string" ? req.query.secret : "";
  const expected = process.env.WEBHOOK_SECRET ?? "";

  if (!expected || secret !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const update = await readUpdate(req);
    console.log("Processing update:", update.update_id);

    const bot = await getBotInstance();
    await bot.handleUpdate(update);

    console.log("Update processed:", update.update_id);
    res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook error:", err);
    if (!res.headersSent) {
      res.status(200).send("OK");
    }
  }
}
