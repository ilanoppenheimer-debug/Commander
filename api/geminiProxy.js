const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_API_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent`;

export async function proxyGeminiRequest(body, apiKey = process.env.GEMINI_API_KEY) {
  if (!apiKey) {
    return {
      status: 500,
      body: {
        error: "Missing GEMINI_API_KEY. Add it to your local environment before using AI features.",
      },
    };
  }

  const response = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body ?? {}),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      status: response.status,
      body: {
        error: data?.error?.message || "Gemini request failed",
      },
    };
  }

  return {
    status: response.status,
    body: data,
  };
}
