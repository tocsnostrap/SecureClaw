import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { callGrok } from "../agents/providers/xai";

const AuthTokenSchema = z.object({
  token: z.string().min(32, "Auth token must be at least 32 characters"),
  action: z.enum(["auth", "chat", "ping"]),
});

const ChatMessageSchema = z.object({
  token: z.string().min(32),
  action: z.literal("chat"),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string().min(1).max(10000),
    })
  ),
});

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 30;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

const authenticatedClients = new Set<WebSocket>();
const VALID_TOKENS = new Set<string>();

if (process.env.SECURECLAW_AUTH_TOKEN) {
  VALID_TOKENS.add(process.env.SECURECLAW_AUTH_TOKEN);
}

if (VALID_TOKENS.size === 0) {
  const defaultToken = "secureclaw_" + Array.from({ length: 32 }, () =>
    Math.random().toString(36).charAt(2)
  ).join("");
  VALID_TOKENS.add(defaultToken);
  console.log(`[SecureClaw] Generated default auth token: ${defaultToken}`);
}

function createServer() {
  const port = parseInt(process.env.GATEWAY_PORT || "18789", 10);
  const certPath = path.resolve(process.cwd(), "certs", "cert.pem");
  const keyPath = path.resolve(process.cwd(), "certs", "key.pem");

  let server: http.Server | https.Server;

  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const options = {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };
    server = https.createServer(options);
    console.log(`[SecureClaw Gateway] HTTPS mode enabled with self-signed certs`);
  } else {
    server = http.createServer();
    console.log(`[SecureClaw Gateway] Running in HTTP mode (no certs found)`);
  }

  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    const ip = req.socket.remoteAddress || "unknown";
    console.log(`[SecureClaw] New connection from ${ip}`);

    if (!checkRateLimit(ip)) {
      ws.send(JSON.stringify({ type: "error", message: "Rate limit exceeded" }));
      ws.close(1008, "Rate limit exceeded");
      return;
    }

    ws.on("message", async (data) => {
      try {
        if (!checkRateLimit(ip)) {
          ws.send(JSON.stringify({ type: "error", message: "Rate limit exceeded" }));
          return;
        }

        const raw = JSON.parse(data.toString());
        const baseValidation = AuthTokenSchema.safeParse(raw);

        if (!baseValidation.success) {
          ws.send(JSON.stringify({
            type: "error",
            message: "Invalid request format",
            errors: baseValidation.error.issues,
          }));
          return;
        }

        const { token, action } = baseValidation.data;

        if (!VALID_TOKENS.has(token)) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid auth token" }));
          return;
        }

        switch (action) {
          case "auth":
            authenticatedClients.add(ws);
            ws.send(JSON.stringify({ type: "auth_success", message: "Authenticated" }));
            break;

          case "ping":
            if (!authenticatedClients.has(ws)) {
              ws.send(JSON.stringify({ type: "error", message: "Not authenticated" }));
              return;
            }
            ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
            break;

          case "chat":
            if (!authenticatedClients.has(ws)) {
              ws.send(JSON.stringify({ type: "error", message: "Not authenticated" }));
              return;
            }

            const chatValidation = ChatMessageSchema.safeParse(raw);
            if (!chatValidation.success) {
              ws.send(JSON.stringify({
                type: "error",
                message: "Invalid chat format",
                errors: chatValidation.error.issues,
              }));
              return;
            }

            try {
              const response = await callGrok(chatValidation.data.messages);
              ws.send(JSON.stringify({ type: "chat_response", content: response }));
            } catch (err: any) {
              ws.send(JSON.stringify({
                type: "error",
                message: `AI error: ${err.message}`,
              }));
            }
            break;
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: "error", message: "Malformed request" }));
      }
    });

    ws.on("close", () => {
      authenticatedClients.delete(ws);
      console.log(`[SecureClaw] Client disconnected: ${ip}`);
    });

    ws.on("error", (err) => {
      console.error(`[SecureClaw] WebSocket error: ${err.message}`);
      authenticatedClients.delete(ws);
    });
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`[SecureClaw Gateway] Listening on port ${port}`);
    console.log(`[SecureClaw Gateway] Security: Rate limiting (${RATE_LIMIT_MAX}/min), Zod validation, token auth`);
  });

  return { server, wss };
}

if (require.main === module) {
  createServer();
}

export { createServer };
