const API = import.meta.env.VITE_API_URL || "/api";
export function getToken() { return localStorage.getItem("pia_token") || ""; }
export function setToken(value) { value ? localStorage.setItem("pia_token", value) : localStorage.removeItem("pia_token"); }

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export async function streamChat(payload, { onMeta, onDelta, onError, signal }) {
  const response = await fetch(`${API}/chat/stream`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const event of events) {
      const line = event.split("\n").find(x => x.startsWith("data:"));
      if (!line) continue;
      const data = JSON.parse(line.slice(5).trim());
      if (data.type === "meta") onMeta?.(data);
      if (data.type === "delta") onDelta?.(data.content);
      if (data.type === "error") onError?.(data.error);
    }
  }
}
