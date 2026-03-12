// background.js — Service worker for Groq API calls

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeCode") {
    handleAnalyzeCode(request.data)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true; // keep the message channel open for async response
  }
});

async function handleAnalyzeCode({ problemTitle, language, code }) {
  const { groq_api_key: apiKey } =
    await chrome.storage.local.get("groq_api_key");

  if (!apiKey) {
    throw new Error(
      "No API key found. Please set your Groq API key in the extension popup.",
    );
  }

  const prompt = `You are a competitive programming coach analyzing a LeetCode submission.

    Problem: ${problemTitle}
    Language: ${language}
    Code:
    ${code}

    Return JSON only, no markdown, no explanation:
    {
      "congratulations": "short personalized encouragement (1 sentence, varies based on code quality)",
      "approach": {
        "is_optimal": true,
        "current_tags": ["tag1", "tag2"],
        "suggested_tags": ["tag1", "tag2"],
        "key_idea": "one sentence describing the core algorithmic idea used in the code"
      },
      "efficiency": {
        "is_optimal": true,
        "current_complexity": "O(...)",
        "suggested_complexity": "O(...)",
        "suggestion": "2-3 sentences on whether the approach is optimal for time and space"
      },
      "code_style": {
        "is_optimal": false,
        "readability": 2,
        "structure": 3,
        "suggestion": "one sentence of specific actionable improvement"
      }
    }`;

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    },
  );

  if (!response.ok) {
    let errorMsg = `Groq API error (${response.status})`;
    try {
      const errorJson = await response.json();
      if (errorJson.error && errorJson.error.message) {
        if (errorJson.error.code === "invalid_api_key") {
          errorMsg = "Invalid API Key. Please click the gear icon to update it.";
        } else {
          errorMsg = errorJson.error.message;
        }
      } else {
        errorMsg += `: ${JSON.stringify(errorJson)}`;
      }
    } catch {
      // If reading json fails, we can't do much, just throw generic
      errorMsg += " - Unknown error occurred.";
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  try {
    return { result: JSON.parse(content) };
  } catch {
    throw new Error("Failed to parse AI response as JSON.");
  }
}
