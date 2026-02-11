import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { WebSocketServer, WebSocket } from "ws";

const ChatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string().min(1).max(10000),
    })
  ).min(1).max(50),
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Rate limit exceeded. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export async function registerRoutes(app: Express): Promise<Server> {
  app.use("/api", apiLimiter);

  app.post("/api/chat", async (req: Request, res: Response) => {
    const validation = ChatRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: validation.error.issues,
      });
    }

    if (!process.env.XAI_API_KEY) {
      return res.status(503).json({
        error: "AI service not configured. Set XAI_API_KEY environment variable.",
      });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    try {
      const { streamGrok } = await import("../src/agents/providers/xai");
      const result = await streamGrok(validation.data.messages);

      for await (const chunk of result.textStream) {
        if (chunk) {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error: any) {
      console.error("[SecureClaw] AI streaming error:", error.message);
      res.write(
        `data: ${JSON.stringify({ error: error.message || "AI service error" })}\n\n`
      );
      res.write("data: [DONE]\n\n");
      res.end();
    }
  });

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "SecureClaw Gateway",
      ai: !!process.env.XAI_API_KEY ? "configured" : "not configured",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/config", (_req: Request, res: Response) => {
    res.json({
      name: "SecureClaw",
      version: "1.0.0",
      security: {
        dmPolicy: "pairing",
        sandboxMode: "all",
        biometricAuth: true,
        encryption: "TLS1.3",
      },
      ai: {
        provider: "xAI",
        model: "grok-4",
        available: !!process.env.XAI_API_KEY,
      },
    });
  });

  const httpServer = createServer(app);

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  const wsRateLimit = new Map<string, { count: number; resetTime: number }>();

  wss.on("connection", (ws, req) => {
    const ip = req.socket.remoteAddress || "unknown";
    console.log(`[SecureClaw WS] Client connected: ${ip}`);

    ws.on("message", async (data) => {
      const now = Date.now();
      const entry = wsRateLimit.get(ip);
      if (entry && now < entry.resetTime && entry.count >= 30) {
        ws.send(JSON.stringify({ type: "error", message: "Rate limit exceeded" }));
        return;
      }
      if (!entry || now > (entry?.resetTime || 0)) {
        wsRateLimit.set(ip, { count: 1, resetTime: now + 60000 });
      } else {
        entry.count++;
      }

      try {
        const raw = JSON.parse(data.toString());

        const TokenSchema = z.object({
          token: z.string().min(32),
          action: z.enum(["auth", "chat", "ping"]),
        });

        const baseValidation = TokenSchema.safeParse(raw);
        if (!baseValidation.success) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid request" }));
          return;
        }

        const validToken = process.env.SECURECLAW_AUTH_TOKEN;
        if (validToken && raw.token !== validToken) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid token" }));
          return;
        }

        if (raw.action === "auth") {
          ws.send(JSON.stringify({ type: "auth_success" }));
        } else if (raw.action === "ping") {
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        } else if (raw.action === "chat") {
          if (!process.env.XAI_API_KEY) {
            ws.send(JSON.stringify({ type: "error", message: "AI not configured" }));
            return;
          }
          const { callGrok } = await import("../src/agents/providers/xai");
          const response = await callGrok(raw.messages || []);
          ws.send(JSON.stringify({ type: "chat_response", content: response }));
        }
      } catch (err: any) {
        ws.send(JSON.stringify({ type: "error", message: err.message }));
      }
    });

    ws.on("close", () => {
      console.log(`[SecureClaw WS] Client disconnected: ${ip}`);
    });
  });

  return httpServer;
}
