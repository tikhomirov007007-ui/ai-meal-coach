import type { VercelRequest, VercelResponse } from "@vercel/node";
import serverless from "serverless-http";
import { getApp } from "../src/app";

let handler: ReturnType<typeof serverless> | null = null;

export default async function (req: VercelRequest, res: VercelResponse) {
  if (!handler) {
    const app = await getApp();
    handler = serverless(app);
  }
  return handler(req, res);
}
