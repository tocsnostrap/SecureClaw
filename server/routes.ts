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
    const startTime = Date.now();
    const userQuery = req.body?.messages?.[req.body.messages.length - 1]?.content || "";
    console.log(`[SecureClaw] Chat request received - Messages: ${req.body?.messages?.length || 0}, Query: "${userQuery.slice(0, 100)}..."`);

    const validation = ChatRequestSchema.safeParse(req.body);
    if (!validation.success) {
      console.error("[SecureClaw] ❌ Validation failed:", JSON.stringify(validation.error.issues));
      return res.status(400).json({
        error: "Invalid request",
        details: validation.error.issues,
      });
    }

    if (!process.env.XAI_API_KEY) {
      console.error("[SecureClaw] ❌ XAI_API_KEY not configured");
      return res.status(503).json({
        error: "AI service not configured. Set XAI_API_KEY environment variable.",
      });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let chunkCount = 0;
    let totalChars = 0;

    try {
      const agent = validation.data.agent || "orchestrator";
      console.log(`[SecureClaw] 🤖 Routing to agent: ${agent}`);
      
      const result = streamAgentResponse(validation.data.messages, agent);

      for await (const chunk of result.textStream) {
        if (chunk) {
          chunkCount++;
          totalChars += chunk.length;
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
          console.log(`[SecureClaw] 🔧 Tools used: ${toolCalls.map(tc => tc.tool).join(", ")}`);
          res.write(`data: ${JSON.stringify({ toolCalls, agent })}\n\n`);
        }
      } catch (toolErr: any) {
        console.error("[SecureClaw] ⚠️ Tool extraction error:", toolErr.message);
      }

      const duration = Date.now() - startTime;
      console.log(`[SecureClaw] ✅ Stream completed - Chunks: ${chunkCount}, Chars: ${totalChars}, Duration: ${duration}ms`);
      // Note: Token usage is logged by the agent layer (see agents.ts onFinish callback)
      
      // Check if response seems truncated (no proper ending)
      const lastChunkIndicator = chunkCount > 0 && totalChars > 1000;
      if (lastChunkIndicator) {
        console.log(`[SecureClaw] 💡 Response was substantial (${totalChars} chars). If truncated, user can ask to "continue".`);
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error: any) {
      const errMsg = error.message || "AI service error";
      const duration = Date.now() - startTime;
      console.error(`[SecureClaw] ❌ AI streaming error after ${duration}ms:`, errMsg);
      if (error.stack) console.error("[SecureClaw] Stack trace:", error.stack.split('\n').slice(0, 5).join('\n'));

      let userMessage = "Something went wrong with the AI service.";
      if (errMsg.includes("401") || errMsg.includes("Unauthorized") || errMsg.includes("API key")) {
        userMessage = "Invalid API key. Please check your XAI_API_KEY.";
        console.error("[SecureClaw] 🔑 Authentication error - check API key");
      } else if (errMsg.includes("429") || errMsg.includes("rate")) {
        userMessage = "Rate limit reached. Please wait a moment and try again.";
        console.error("[SecureClaw] 🚦 Rate limit exceeded");
      } else if (errMsg.includes("timeout") || errMsg.includes("ECONNREFUSED")) {
        userMessage = "AI service is temporarily unavailable. Try again shortly.";
        console.error("[SecureClaw] ⏱️ Connection timeout");
      } else if (errMsg.includes("content_filter") || errMsg.includes("safety")) {
        userMessage = "Content filter triggered. Try rephrasing your request with more technical detail.";
        console.error("[SecureClaw] 🛡️ Content safety filter triggered");
      } else if (errMsg.includes("model")) {
        userMessage = `Model error: ${errMsg}`;
        console.error("[SecureClaw] 🤖 Model error:", errMsg);
      } else {
        userMessage = errMsg;
        console.error("[SecureClaw] 💥 Unexpected error:", errMsg);
      }

      res.write(
        `data: ${JSON.stringify({ error: userMessage })}\n\n`
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
      const task = toggleProactiveTask(req.params.id as string, enabled);
      if (!task) return res.status(404).json({ error: "Task not found" });
      res.json({ task });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/agents/tasks/:id/run", async (req: Request, res: Response) => {
    try {
      const result = await executeTaskNow(req.params.id as string);
      if (!result) return res.status(404).json({ error: "Task not found" });
      res.json({ result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/agents/tasks/:id", async (req: Request, res: Response) => {
    try {
      const success = deleteProactiveTask(req.params.id as string);
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

  app.get("/api/health", async (_req: Request, res: Response) => {
    // Verify all systems are loaded
    const systems: Record<string, boolean> = {
      ai: !!process.env.XAI_API_KEY,
      agents: true,
      proactive: true,
      permissions: false,
      integrations: false,
      monitoring: false,
      helpWiki: false,
      browserSkills: false,
      credits: false,
    };
    
    // Try loading each system
    try { await import("../src/permissions"); systems.permissions = true; } catch (e) { console.error("Permissions load error:", e); }
    try { await import("../src/integrations"); systems.integrations = true; } catch (e) { console.error("Integrations load error:", e); }
    try { await import("../src/monitoring"); systems.monitoring = true; } catch (e) { console.error("Monitoring load error:", e); }
    try { await import("../src/help_wiki"); systems.helpWiki = true; } catch (e) { console.error("Help wiki load error:", e); }
    try { await import("../src/skills/browser_skill"); systems.browserSkills = true; } catch (e) { console.error("Browser skills load error:", e); }
    try { await import("../src/credits"); systems.credits = true; } catch (e) { console.error("Credits load error:", e); }
    
    res.json({
      status: "ok",
      service: "SecureClaw Gateway",
      systems,
      agents: {
        orchestrator: true,
        scheduler: true,
        research: true,
        device: true,
      },
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/config", (_req: Request, res: Response) => {
    res.json({
      name: "SecureClaw",
      version: "2.0.0",
      security: {
        dmPolicy: "pairing",
        sandboxMode: "all",
        biometricAuth: true,
        encryption: "AES-256-CBC + TLS1.3",
        auditLog: true,
      },
      ai: {
        provider: "xAI",
        model: "grok-4",
        available: !!process.env.XAI_API_KEY,
        autonomy: "AGI-tier",
        features: ["browser-automation", "app-integrations", "self-learning"],
      },
      agents: {
        orchestrator: { enabled: true, proactive: true, autonomy: "full" },
        scheduler: { enabled: true, proactive: true },
        research: { enabled: true, proactive: false },
        device: { enabled: true, proactive: false },
      },
      toolAllowlist: [
        "web_search", "browser_scrape", "link_app", "execute_app_task",
        "summarize", "schedule_task", "send_notification",
        "get_weather", "get_time", "read_rss", "calculate", "translate", "set_reminder", "generate_code",
      ],
      capabilities: {
        browserAutomation: true,
        appIntegrations: true,
        employeeTasks: true,
        statusMonitoring: true,
        helpWiki: true,
        credits: true,
      },
    });
  });

  // MULTI-PAGE DASHBOARD APIs

  // Status/Monitor page
  app.get("/api/dashboard/status", async (_req: Request, res: Response) => {
    try {
      const { runAllHealthChecks, getFormattedUptime } = await import("../src/monitoring");
      const status = await runAllHealthChecks();
      
      res.json({
        ...status,
        uptimeFormatted: getFormattedUptime(),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Permissions page
  app.get("/api/dashboard/permissions", async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || 'default_user';
      const { getAllPermissions } = await import("../src/permissions");
      
      const permissions = getAllPermissions(userId);
      
      res.json({ permissions, userId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // App Links page
  app.get("/api/dashboard/apps", async (_req: Request, res: Response) => {
    try {
      const { getSupportedApps } = await import("../src/integrations");
      
      const apps = getSupportedApps();
      
      res.json({ apps });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Help/Wiki page
  app.get("/api/dashboard/help", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string || '';
      const { searchWiki, getCategories, TUTORIALS, FAQS, COMMANDS } = await import("../src/help_wiki");
      
      if (query) {
        const results = await searchWiki(query);
        res.json(results);
      } else {
        res.json({
          categories: getCategories(),
          tutorials: TUTORIALS,
          faqs: FAQS,
          commands: COMMANDS,
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Credits page
  app.get("/api/dashboard/credits", async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || 'default_user';
      const { getCreditStatus } = await import("../src/credits");
      
      const status = getCreditStatus(userId);
      
      res.json({ credits: status });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // REAL OAUTH FLOWS

  // Start OAuth flow
  app.get("/api/oauth/start/:app", async (req: Request, res: Response) => {
    try {
      const app = req.params.app as 'instagram' | 'gmail' | 'twitter';
      const userId = (req.query.userId as string) || 'default_user';
      const redirectUri = (req.query.redirectUri as string) || `${req.protocol}://${req.get('host')}/api/oauth/callback`;
      
      const { startOAuthFlow } = await import("../src/integrations/oauth");
      
      const { authUrl, state } = startOAuthFlow(app, userId, redirectUri);
      
      res.json({
        authUrl,
        state,
        app,
        message: `OAuth flow started for ${app}. Redirect user to authUrl.`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PASSPORT OAUTH ROUTES

  // Instagram OAuth
  app.get("/api/oauth/instagram",
    passport.authenticate('instagram', {
      scope: ['user_profile', 'user_media', 'instagram_basic', 'instagram_content_publish'],
    })
  );

  app.get("/api/oauth/callback/instagram",
    passport.authenticate('instagram', { failureRedirect: '/oauth-error' }),
    async (req: Request, res: Response) => {
      try {
        const user = req.user as any;
        const userId = (req.query.userId as string) || 'default_user';
        
        // Store token with encryption
        await grantPermission(
          userId,
          'instagram',
          {
            accessToken: user.accessToken,
            refreshToken: user.refreshToken,
            expiresAt: Date.now() + 3600000, // 1 hour
            profile: user.profile,
          },
          ['user_profile', 'user_media', 'instagram_content_publish'],
          { email: user.profile?.email, linkedAt: Date.now() }
        );
        
        console.log(`[Passport OAuth] ✅ Instagram linked for ${userId}`);
        
        res.send(`
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Instagram Connected</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; text-align: center; padding: 60px 20px; background: linear-gradient(135deg, #0D1117 0%, #161B22 100%); color: #fff; margin: 0;">
              <div style="max-width: 400px; margin: 0 auto; background: rgba(255,255,255,0.05); border-radius: 20px; padding: 40px; backdrop-filter: blur(10px); border: 1px solid rgba(0,217,166,0.2);">
                <div style="font-size: 64px; margin-bottom: 20px;">✅</div>
                <h1 style="color: #00D9A6; margin: 0 0 10px 0; font-size: 28px;">Instagram Connected!</h1>
                <p style="color: rgba(255,255,255,0.7); margin: 0 0 30px 0; font-size: 16px;">All set, Scot! I can now post and manage your Instagram 🎉</p>
                <p style="color: rgba(255,255,255,0.5); font-size: 14px;">Close this window and return to SecureClaw</p>
              </div>
              <script>
                // Auto-close after 3 seconds
                setTimeout(() => {
                  window.close();
                  // If can't close (not opened by script), redirect
                  setTimeout(() => {
                    window.location.href = '/';
                  }, 1000);
                }, 3000);
              </script>
            </body>
          </html>
        `);
      } catch (error: any) {
        console.error(`[Passport OAuth] ❌ Instagram callback error:`, error.message);
        res.status(500).send(`Error: ${error.message}`);
      }
    }
  );

  // Gmail OAuth
  app.get("/api/oauth/google",
    passport.authenticate('google', {
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'email',
        'profile',
      ],
      accessType: 'offline',
      prompt: 'consent',
    })
  );

  app.get("/api/oauth/callback/google",
    passport.authenticate('google', { failureRedirect: '/oauth-error' }),
    async (req: Request, res: Response) => {
      try {
        const user = req.user as any;
        const userId = (req.query.userId as string) || 'default_user';
        
        await grantPermission(
          userId,
          'gmail',
          {
            accessToken: user.accessToken,
            refreshToken: user.refreshToken,
            expiresAt: Date.now() + 3600000,
            profile: user.profile,
            email: user.email,
          },
          ['gmail.readonly', 'gmail.send', 'gmail.modify'],
          { email: user.email, linkedAt: Date.now() }
        );
        
        console.log(`[Passport OAuth] ✅ Gmail linked for ${userId}`);
        
        res.send(`
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Gmail Connected</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; text-align: center; padding: 60px 20px; background: linear-gradient(135deg, #0D1117 0%, #161B22 100%); color: #fff; margin: 0;">
              <div style="max-width: 400px; margin: 0 auto; background: rgba(255,255,255,0.05); border-radius: 20px; padding: 40px; backdrop-filter: blur(10px); border: 1px solid rgba(0,217,166,0.2);">
                <div style="font-size: 64px; margin-bottom: 20px;">✅</div>
                <h1 style="color: #00D9A6; margin: 0 0 10px 0; font-size: 28px;">Gmail Connected!</h1>
                <p style="color: rgba(255,255,255,0.7); margin: 0 0 30px 0; font-size: 16px;">Perfect! I can now scan and send emails for you, Scot! 📧</p>
                <p style="color: rgba(255,255,255,0.5); font-size: 14px;">Close this window and return to SecureClaw</p>
              </div>
              <script>
                setTimeout(() => {
                  window.close();
                  setTimeout(() => window.location.href = '/', 1000);
                }, 3000);
              </script>
            </body>
          </html>
        `);
      } catch (error: any) {
        console.error(`[Passport OAuth] ❌ Gmail callback error:`, error.message);
        res.status(500).send(`Error: ${error.message}`);
      }
    }
  );

  // Twitter OAuth
  app.get("/api/oauth/twitter",
    passport.authenticate('twitter', {
      scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    })
  );

  app.get("/api/oauth/callback/twitter",
    passport.authenticate('twitter', { failureRedirect: '/oauth-error' }),
    async (req: Request, res: Response) => {
      try {
        const user = req.user as any;
        const userId = (req.query.userId as string) || 'default_user';
        
        await grantPermission(
          userId,
          'twitter',
          {
            accessToken: user.accessToken,
            refreshToken: user.refreshToken,
            expiresAt: Date.now() + 7200000, // 2 hours
            profile: user.profile,
          },
          ['tweet.read', 'tweet.write', 'users.read'],
          { linkedAt: Date.now() }
        );
        
        console.log(`[Passport OAuth] ✅ Twitter linked for ${userId}`);
        
        res.send(`
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Twitter Connected</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; text-align: center; padding: 60px 20px; background: linear-gradient(135deg, #0D1117 0%, #161B22 100%); color: #fff; margin: 0;">
              <div style="max-width: 400px; margin: 0 auto; background: rgba(255,255,255,0.05); border-radius: 20px; padding: 40px; backdrop-filter: blur(10px); border: 1px solid rgba(0,217,166,0.2);">
                <div style="font-size: 64px; margin-bottom: 20px;">✅</div>
                <h1 style="color: #00D9A6; margin: 0 0 10px 0; font-size: 28px;">Twitter Connected!</h1>
                <p style="color: rgba(255,255,255,0.7); margin: 0 0 30px 0; font-size: 16px;">Awesome! I can now tweet and manage your timeline, Scot! 🐦</p>
                <p style="color: rgba(255,255,255,0.5); font-size: 14px;">Close this window and return to SecureClaw</p>
              </div>
              <script>
                setTimeout(() => {
                  window.close();
                  setTimeout(() => window.location.href = '/', 1000);
                }, 3000);
              </script>
            </body>
          </html>
        `);
      } catch (error: any) {
        console.error(`[Passport OAuth] ❌ Twitter callback error:`, error.message);
        res.status(500).send(`Error: ${error.message}`);
      }
    }
  );

  // OAuth error page
  app.get("/oauth-error", (req: Request, res: Response) => {
    res.send(`
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>OAuth Error</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; text-align: center; padding: 60px 20px; background: linear-gradient(135deg, #0D1117 0%, #161B22 100%); color: #fff; margin: 0;">
          <div style="max-width: 400px; margin: 0 auto; background: rgba(255,255,255,0.05); border-radius: 20px; padding: 40px; backdrop-filter: blur(10px); border: 1px solid rgba(239,68,68,0.3);">
            <div style="font-size: 64px; margin-bottom: 20px;">❌</div>
            <h1 style="color: #EF4444; margin: 0 0 10px 0; font-size: 28px;">OAuth Failed</h1>
            <p style="color: rgba(255,255,255,0.7); margin: 0 0 30px 0; font-size: 16px;">Something went wrong. Try again!</p>
            <button onclick="window.close()" style="background: #00D9A6; color: #0D1117; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">Close</button>
          </div>
        </body>
      </html>
    `);
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
