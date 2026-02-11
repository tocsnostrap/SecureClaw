import { createXai } from "@ai-sdk/xai";
import { generateText } from "ai";

const xai = createXai({
  apiKey: process.env.XAI_API_KEY || "",
});

const DEFAULT_MODEL = "grok-4";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function callGrok(
  messages: ChatMessage[],
  model: string = DEFAULT_MODEL
): Promise<string> {
  if (!process.env.XAI_API_KEY) {
    throw new Error("XAI_API_KEY is not set. Please configure it in your environment.");
  }

  const { text } = await generateText({
    model: xai(model),
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    maxTokens: 4096,
  });

  return text;
}

export async function streamGrok(
  messages: ChatMessage[],
  model: string = DEFAULT_MODEL
) {
  if (!process.env.XAI_API_KEY) {
    throw new Error("XAI_API_KEY is not set. Please configure it in your environment.");
  }

  const { streamText } = await import("ai");

  const result = streamText({
    model: xai(model),
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    maxTokens: 4096,
  });

  return result;
}

export { xai, DEFAULT_MODEL };
