import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const requestSchema = z.object({
  mode: z.enum(["plan", "summary", "flashcards", "test", "tutor"]),
  className: z.string().min(1).max(120),
  context: z.string().max(24000).default(""),
  prompt: z.string().max(2000).default(""),
});

export const generateStudyContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => requestSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) throw new Error("The Gemini API key is not configured on the server.");
    const instruction = `You are StudiAI, a concise and supportive study coach. Create a ${data.mode} for ${data.className}. Use the supplied materials and notes when available, never pretend to have read a file whose text was not supplied, and format the result in clear Markdown. ${data.mode === "test" ? "Create a balanced mix of multiple-choice and short-answer questions, then include a clearly separated answer key." : ""} ${data.mode === "tutor" ? "Teach Socratically: explain clearly, ask one useful follow-up question, and guide rather than merely giving an answer." : ""}`;
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: instruction }] },
      contents: [{ role: "user", parts: [{ text: `Class materials:\n${data.context || "No readable class notes were provided."}\n\nStudent request: ${data.prompt || `Create my ${data.mode}.`}` }] }],
    });
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:streamGenerateContent?alt=sse";
    let response: Response | null = null;
    // Bounded retry for Gemini's transient 429/5xx "high demand" responses.
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(url, { method: "POST", headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" }, body });
      if (response.ok || !(response.status === 429 || response.status >= 500)) break;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt + Math.random() * 500));
    }
    if (!response || !response.ok) {
      const failure = await response?.json().catch(() => null) as { error?: { message?: string } } | null;
      const status = response?.status ?? 0;
      if (status === 503 || status === 429) throw new Error("Gemini is busy right now. Please try again in a minute.");
      throw new Error(failure?.error?.message ?? `StudiAI could not complete this request (${status}).`);
    }
    if (!response.body) throw new Error("StudiAI returned an empty response.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = JSON.parse(line.slice(6)) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
        for (const part of payload.candidates?.[0]?.content?.parts ?? []) if (part.text && !part.thought) content += part.text;
      }
    }
    if (!content.trim()) throw new Error("StudiAI did not generate an answer. Please try a more specific request.");
    return { content };
  });