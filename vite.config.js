import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { proxyGeminiRequest } from "./api/geminiProxy.js";

const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
};

const readJsonBody = async (req) => {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

const devGeminiApiPlugin = (apiKey) => ({
  name: "dev-gemini-api",
  configureServer(server) {
    server.middlewares.use("/api/gemini", async (req, res) => {
      if (req.method !== "POST") {
        sendJson(res, 405, { error: "Method not allowed" });
        return;
      }

      try {
        const body = await readJsonBody(req);
        const result = await proxyGeminiRequest(body, apiKey);
        sendJson(res, result.status, result.body);
      } catch (error) {
        console.error("Gemini API error:", error);
        sendJson(res, 500, { error: "AI request failed" });
      }
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const geminiApiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  return {
    plugins: [react(), devGeminiApiPlugin(geminiApiKey)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
