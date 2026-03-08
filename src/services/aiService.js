export const callGeminiAPI = async (prompt) => {

  try {

    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      }),
    });

    if (!response.ok) {
      throw new Error("API Error");
    }

    const data = await response.json();

    return data.candidates?.[0]?.content?.parts?.[0]?.text;

  } catch (error) {

    console.log("AI Error:", error);

    throw error;

  }

};