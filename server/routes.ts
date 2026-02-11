import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { WebSocketServer, WebSocket } from "ws";
import { streamAgentResponse, routeToAgent, listAgents } from "../src/agents/agents";
import { getProactiveTasks, createProactiveTask, toggleProactiveTask, deleteProactiveTask, executeTaskNow, DEFAULT_TASK_TEMPLATES, getAuditLog, getAuditStats } from "../src/agents/proactive";

const ChatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string().min(1).max(10000),
    })
  ).min(1).max(50),
  agent: z.enum(["orchestrator", "scheduler", "research", "device"]).optional(),
});

const TaskCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  cronExpression: z.string().min(1).max(50),
  agent: z.enum(["orchestrator", "scheduler", "research", "device"]).default("orchestrator"),
  prompt: z.string().min(1).max(5000),
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
      const agent = validation.data.agent || "orchestrator";
      const result = streamAgentResponse(validation.data.messages, agent);

      for await (const chunk of result.textStream) {
        if (chunk) {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }
      }

      try {
        const steps = await result.steps;
        const toolCalls = Array.isArray(steps)
          ? steps
              .flatMap((step: any) => step.toolCalls || [])
              .map((tc: any) => ({ tool: tc.toolName, args: tc.args, result: tc.result }))
          : [];

        if (toolCalls.length > 0) {
          res.write(`data: ${JSON.stringify({ toolCalls, agent })}\n\n`);
        }
      } catch (toolErr: any) {
        console.error("[SecureClaw] Tool extraction error:", toolErr.message);
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

  app.get("/api/agents", async (_req: Request, res: Response) => {
    try {
      res.json({ agents: listAgents() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/agents/route", async (req: Request, res: Response) => {
    const validation = ChatRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.issues });
    }

    if (!process.env.XAI_API_KEY) {
      return res.status(503).json({ error: "AI not configured" });
    }

    try {
      const result = await routeToAgent(
        validation.data.messages,
        validation.data.agent as any
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/agents/tasks", async (_req: Request, res: Response) => {
    try {
      res.json({ tasks: getProactiveTasks() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/agents/tasks", async (req: Request, res: Response) => {
    const validation = TaskCreateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.issues });
    }

    try {
      const task = createProactiveTask(validation.data);
      res.json({ task });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/agents/tasks/templates", async (_req: Request, res: Response) => {
    try {
      res.json({ templates: DEFAULT_TASK_TEMPLATES });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/agents/tasks/:id/toggle", async (req: Request, res: Response) => {
    try {
      const enabled = req.body.enabled !== false;
      const task = toggleProactiveTask(req.params.id, enabled);
      if (!task) return res.status(404).json({ error: "Task not found" });
      res.json({ task });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/agents/tasks/:id/run", async (req: Request, res: Response) => {
    try {
      const result = await executeTaskNow(req.params.id);
      if (!result) return res.status(404).json({ error: "Task not found" });
      res.json({ result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/agents/tasks/:id", async (req: Request, res: Response) => {
    try {
      const success = deleteProactiveTask(req.params.id);
      if (!success) return res.status(404).json({ error: "Task not found" });
      res.json({ deleted: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/audit", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const agent = req.query.agent as string | undefined;
      res.json({ log: getAuditLog(limit, agent) });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/audit/stats", async (_req: Request, res: Response) => {
    try {
      res.json(getAuditStats());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "SecureClaw Gateway",
      ai: !!process.env.XAI_API_KEY ? "configured" : "not configured",
      agents: {
        orchestrator: true,
        scheduler: true,
        research: true,
        device: true,
      },
      proactive: true,
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
        auditLog: true,
      },
      ai: {
        provider: "xAI",
        model: "grok-4",
        available: !!process.env.XAI_API_KEY,
      },
      agents: {
        orchestrator: { enabled: true, proactive: true },
        scheduler: { enabled: true, proactive: true },
        research: { enabled: true, proactive: false },
        device: { enabled: true, proactive: false },
      },
      toolAllowlist: [
        "web_search", "summarize", "schedule_task", "send_notification",
        "get_weather", "get_time", "read_rss", "calculate", "translate", "set_reminder",
      ],
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
          const result = await routeToAgent(raw.messages || [], raw.agent);
          ws.send(JSON.stringify({
            type: "chat_response",
            content: result.response,
            agent: result.agent,
            toolCalls: result.toolCalls,
          }));
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
