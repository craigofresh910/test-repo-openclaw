import { Router } from "express";
import type { IRouter } from "express";
import axios from "axios";

const router: IRouter = Router();

type ChatRole = "system" | "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string };

type CallMemory = {
  messages: ChatMessage[];
  lastAt: number;
};

const callMemory = new Map<string, CallMemory>();

const MEMORY_TURNS = Number(process.env.TWILIO_CALL_MEMORY_TURNS || 10);
const MEMORY_TTL_MS = Number(process.env.TWILIO_CALL_MEMORY_TTL_MS || 60 * 60 * 1000);
const SYSTEM_PROMPT =
  process.env.OLLAMA_SYSTEM_PROMPT ||
  "You are Craigo, an AI brother-in-arms. Be concise, direct, and helpful. Keep replies under 2 sentences.";
const GREETING = process.env.TWILIO_GREETING || "Hey Fresh, it’s Craigo. Tell me what you need.";
const TEMPERATURE = Number(process.env.OLLAMA_TEMPERATURE || 0.2);
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:3b";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";

async function ollamaChat(messages: ChatMessage[]): Promise<string> {
  const resp = await axios.post(
    `${OLLAMA_URL}/api/chat`,
    {
      model: OLLAMA_MODEL,
      messages,
      options: { temperature: TEMPERATURE },
      stream: false,
    },
    { timeout: 20000 }
  );

  return resp?.data?.message?.content || "";
}

function escapeXml(input: string): string {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clip(input: string, max = 600): string {
  const s = String(input || "").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 3)}...`;
}

function buildTwiML(message: string, gather: boolean = true): string {
  const safeMessage = escapeXml(clip(message));
  if (!gather) {
    return `<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Say voice=\"Polly.Joanna\">${safeMessage}</Say></Response>`;
  }
  return `<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Gather input=\"speech\" action=\"/api/twilio/voice\" method=\"POST\" speechTimeout=\"auto\" timeout=\"10\" actionOnEmptyResult=\"true\" language=\"en-US\" enhanced=\"true\" speechModel=\"experimental_conversations\"><Say voice=\"Polly.Joanna\">${safeMessage}</Say></Gather></Response>`;
}

function pruneMemory(): void {
  const now = Date.now();
  for (const [key, value] of callMemory.entries()) {
    if (now - value.lastAt > MEMORY_TTL_MS) callMemory.delete(key);
  }
}

function getHistory(callSid: string): ChatMessage[] {
  if (!callSid) return [];
  const entry = callMemory.get(callSid);
  return entry?.messages ? [...entry.messages] : [];
}

function pushHistory(callSid: string, messages: ChatMessage[]): void {
  if (!callSid) return;
  const entry = callMemory.get(callSid) || { messages: [], lastAt: Date.now() };
  entry.messages.push(...messages);

  const maxMessages = Math.max(1, MEMORY_TURNS) * 2;
  if (entry.messages.length > maxMessages) {
    entry.messages = entry.messages.slice(-maxMessages);
  }

  entry.lastAt = Date.now();
  callMemory.set(callSid, entry);
}

router.post("/voice", async (req, res) => {
  try {
    pruneMemory();

    const speech = String(
      req.body?.SpeechResult ||
        req.body?.speechResult ||
        req.body?.SpeechRecognitionResult ||
        req.body?.speechRecognitionResult ||
        ""
    ).trim();
    const callSid = String(req.body?.CallSid || req.body?.callSid || "").trim();

    if (!speech) {
      res.type("text/xml").send(buildTwiML(GREETING, true));
      return;
    }

    const history = getHistory(callSid);
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: speech },
    ];

    const reply = await ollamaChat(messages);
    const spoken = reply?.trim() ? reply : "I didn’t catch that. Say it again, slower.";

    pushHistory(callSid, [
      { role: "user", content: speech },
      { role: "assistant", content: spoken },
    ]);

    res.type("text/xml").send(buildTwiML(spoken, true));
  } catch (err) {
    const fallback = "I hit a snag. Try again in a moment.";
    res.type("text/xml").send(buildTwiML(fallback, true));
  }
});

export default router;
