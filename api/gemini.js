import { proxyGeminiRequest } from "./geminiProxy.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { status, body } = await proxyGeminiRequest(req.body);
    res.status(status).json(body);
  } catch (error) {
    console.error("Gemini API error:", error);
    res.status(500).json({ error: "AI request failed" });
  }
}
