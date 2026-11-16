import { config } from "./config.js";

export async function streamChat({ messages, onDelta, signal }) {
  if (!config.aiKey) throw new Error(`AI provider is not configured. Add ${config.aiProvider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY"} to server/.env.`);
  const body = {
    model: config.aiModel,
    messages,
    stream: true,
    temperature: 0.5
  };
  if (config.aiProvider === "openai" && config.aiModel.startsWith("gpt-6")) body.reasoning_effort = "none";
  const response = await fetch(`${config.aiBaseUrl}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      "Authorization": `Bearer ${config.aiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AI provider returned ${response.status}: ${detail.slice(0, 700)}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let full = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const lines = pending.split("\n");
    pending = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content || "";
        if (delta) { full += delta; onDelta(delta); }
      } catch {}
    }
  }
  return full;
}
