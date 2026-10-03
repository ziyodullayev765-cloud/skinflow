// Vercel serverless entry: every /api/* request is rewritten here (see vercel.json).
import { createApp } from "../server/app.js";

const app = createApp();

export default app;
