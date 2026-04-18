const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 50;
const responseCache = new Map();

const readCache = (key) => {
  if (!key || !responseCache.has(key)) return null;
  const entry = responseCache.get(key);
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  responseCache.delete(key);
  responseCache.set(key, entry);
  return entry.value;
};

const writeCache = (key, value) => {
  if (!key) return;
  if (responseCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = responseCache.keys().next().value;
    responseCache.delete(oldest);
  }
  responseCache.set(key, { value, ts: Date.now() });
};

const buildBody = (systemContext, userQuery) => {
  const text = systemContext
    ? `${systemContext}\n\n---\n\n${userQuery}`
    : userQuery;
  return { contents: [{ parts: [{ text }] }] };
};

export const callGeminiAPI = async (input) => {
  let systemContext = "";
  let userQuery = "";
  let useCache = false;

  if (typeof input === "string") {
    userQuery = input;
  } else if (input && typeof input === "object") {
    systemContext = input.systemContext || "";
    userQuery = input.userQuery || input.prompt || "";
    useCache = input.useCache !== false;
  }

  if (!userQuery) throw new Error("AI call missing userQuery");

  const cacheKey = useCache ? `${systemContext}\u0000${userQuery}` : null;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBody(systemContext, userQuery)),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || `API Error (${response.status})`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) throw new Error("Gemini returned an empty response");

    writeCache(cacheKey, text);
    return text;
  } catch (error) {
    console.error("AI Error:", error);
    throw error;
  }
};
