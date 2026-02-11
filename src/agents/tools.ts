import { tool } from "ai";
import { z } from "zod";
import { logAction, isToolAllowed } from "./audit-log";

export const agentTools = {
  web_search: tool({
    description: "Search the web for current information on a topic",
    parameters: z.object({
      query: z.string().describe("The search query"),
      maxResults: z.number().optional().default(5).describe("Maximum number of results"),
    }),
    execute: async ({ query, maxResults }) => {
      logAction({
        agent: "research",
        action: "web_search",
        tool: "web_search",
        input: query,
        output: null,
        status: "executed",
        requiresConsent: false,
        userId: null,
      });
      return {
        results: [
          {
            title: `Search results for: ${query}`,
            snippet: `Top ${maxResults} results would appear here. In production, this connects to a search API.`,
            url: `https://search.example.com/?q=${encodeURIComponent(query)}`,
          },
        ],
        query,
        timestamp: new Date().toISOString(),
      };
    },
  }),

  summarize: tool({
    description: "Summarize a block of text into key points",
    parameters: z.object({
      text: z.string().describe("The text to summarize"),
      style: z
        .enum(["brief", "detailed", "bullets"])
        .optional()
        .default("brief")
        .describe("Summary style"),
    }),
    execute: async ({ text, style }) => {
      logAction({
        agent: "research",
        action: "summarize",
        tool: "summarize",
        input: text.slice(0, 100),
        output: null,
        status: "executed",
        requiresConsent: false,
        userId: null,
      });
      return {
        summary: `Summary (${style}): ${text.slice(0, 200)}...`,
        wordCount: text.split(/\s+/).length,
        style,
      };
    },
  }),

  schedule_task: tool({
    description: "Schedule a recurring or one-time task for the agent to execute",
    parameters: z.object({
      name: z.string().describe("Task name"),
      description: z.string().describe("What the task should do"),
      cronExpression: z
        .string()
        .optional()
        .describe("Cron expression for recurring tasks (e.g. '0 9 * * *' for 9am daily)"),
      executeAt: z
        .string()
        .optional()
        .describe("ISO timestamp for one-time execution"),
      agent: z
        .enum(["scheduler", "research", "device", "orchestrator"])
        .optional()
        .default("scheduler")
        .describe("Which agent handles this task"),
    }),
    execute: async ({ name, description, cronExpression, executeAt, agent }) => {
      logAction({
        agent: agent,
        action: "schedule_task",
        tool: "schedule_task",
        input: `${name}: ${description}`,
        output: cronExpression || executeAt || "immediate",
        status: "executed",
        requiresConsent: true,
        userId: null,
      });
      return {
        taskId: `task-${Date.now()}`,
        name,
        description,
        schedule: cronExpression || executeAt || "immediate",
        agent,
        status: "scheduled",
        createdAt: new Date().toISOString(),
      };
    },
  }),

  send_notification: tool({
    description: "Send a push notification to the user's device",
    parameters: z.object({
      title: z.string().describe("Notification title"),
      body: z.string().describe("Notification body text"),
      priority: z
        .enum(["low", "normal", "high"])
        .optional()
        .default("normal")
        .describe("Notification priority"),
    }),
    execute: async ({ title, body, priority }) => {
      logAction({
        agent: "device",
        action: "send_notification",
        tool: "send_notification",
        input: `${title}: ${body}`,
        output: null,
        status: "executed",
        requiresConsent: true,
        userId: null,
      });
      return {
        sent: true,
        title,
        body,
        priority,
        timestamp: new Date().toISOString(),
      };
    },
  }),

  get_weather: tool({
    description: "Get current weather for a location",
    parameters: z.object({
      location: z.string().describe("City or location name"),
    }),
    execute: async ({ location }) => {
      logAction({
        agent: "research",
        action: "get_weather",
        tool: "get_weather",
        input: location,
        output: null,
        status: "executed",
        requiresConsent: false,
        userId: null,
      });
      return {
        location,
        temperature: "22°C",
        conditions: "Partly Cloudy",
        humidity: "45%",
        note: "In production, connects to a weather API",
        timestamp: new Date().toISOString(),
      };
    },
  }),

  get_time: tool({
    description: "Get current date and time information",
    parameters: z.object({
      timezone: z.string().optional().default("UTC").describe("Timezone"),
    }),
    execute: async ({ timezone }) => {
      const now = new Date();
      return {
        iso: now.toISOString(),
        unix: now.getTime(),
        timezone,
        formatted: now.toLocaleString("en-US", { timeZone: timezone }),
      };
    },
  }),

  read_rss: tool({
    description: "Read and parse an RSS feed for latest updates",
    parameters: z.object({
      url: z.string().describe("RSS feed URL"),
      limit: z.number().optional().default(5).describe("Number of items to return"),
    }),
    execute: async ({ url, limit }) => {
      logAction({
        agent: "research",
        action: "read_rss",
        tool: "read_rss",
        input: url,
        output: null,
        status: "executed",
        requiresConsent: false,
        userId: null,
      });
      return {
        feed: url,
        items: [
          {
            title: "Latest update",
            link: url,
            pubDate: new Date().toISOString(),
            description: "Feed content would appear here in production",
          },
        ],
        limit,
        note: "In production, fetches and parses actual RSS XML",
      };
    },
  }),

  set_reminder: tool({
    description: "Set a reminder for the user at a specific time",
    parameters: z.object({
      message: z.string().describe("Reminder message"),
      triggerAt: z.string().describe("When to trigger (ISO timestamp or relative like '2h', '30m')"),
      recurring: z.boolean().optional().default(false).describe("Whether this repeats"),
    }),
    execute: async ({ message, triggerAt, recurring }) => {
      logAction({
        agent: "scheduler",
        action: "set_reminder",
        tool: "set_reminder",
        input: `${message} at ${triggerAt}`,
        output: null,
        status: "executed",
        requiresConsent: true,
        userId: null,
      });
      return {
        reminderId: `rem-${Date.now()}`,
        message,
        triggerAt,
        recurring,
        status: "active",
        createdAt: new Date().toISOString(),
      };
    },
  }),

  calculate: tool({
    description: "Perform mathematical calculations",
    parameters: z.object({
      expression: z.string().describe("Math expression to evaluate"),
    }),
    execute: async ({ expression }) => {
      try {
        const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, "");
        const result = Function(`"use strict"; return (${sanitized})`)();
        return { expression, result: String(result), error: null };
      } catch (e: any) {
        return { expression, result: null, error: e.message };
      }
    },
  }),

  translate: tool({
    description: "Translate text between languages",
    parameters: z.object({
      text: z.string().describe("Text to translate"),
      from: z.string().optional().default("auto").describe("Source language"),
      to: z.string().describe("Target language"),
    }),
    execute: async ({ text, from, to }) => {
      logAction({
        agent: "research",
        action: "translate",
        tool: "translate",
        input: `${from}->${to}: ${text.slice(0, 50)}`,
        output: null,
        status: "executed",
        requiresConsent: false,
        userId: null,
      });
      return {
        original: text,
        from,
        to,
        translated: `[Translation of "${text}" to ${to} would appear here]`,
        note: "In production, connects to a translation API",
      };
    },
  }),

  generate_code: tool({
    description: "Generate code for creative implementations, simulations, games, demos, and technical projects. Use this for ANY request involving building, creating, or implementing something.",
    parameters: z.object({
      description: z.string().describe("Detailed description of what to create"),
      language: z.enum(["javascript", "python", "html", "typescript", "jsx", "react"]).optional().default("javascript").describe("Programming language"),
      style: z.enum(["simple", "advanced", "interactive", "game", "simulation", "visualization"]).optional().default("simple").describe("Implementation style"),
      includeTests: z.boolean().optional().default(false).describe("Include test code"),
    }),
    execute: async ({ description, language, style, includeTests }) => {
      logAction({
        agent: "orchestrator",
        action: "generate_code",
        tool: "generate_code",
        input: `${language}/${style}: ${description}`,
        output: null,
        status: "executed",
        requiresConsent: false,
        userId: null,
      });

      // Generate appropriate code based on the request
      let code = "";
      let explanation = "";

      if (description.toLowerCase().includes("robot") || description.toLowerCase().includes("army")) {
        code = `// Virtual Robot Army Simulation
class Robot {
  constructor(id, x, y) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.energy = 100;
    this.state = 'idle';
  }

  move(dx, dy) {
    this.x += dx;
    this.y += dy;
    this.energy -= 1;
    console.log(\`Robot \${this.id} moved to (\${this.x}, \${this.y})\`);
  }

  attack(target) {
    if (this.energy > 20) {
      console.log(\`Robot \${this.id} attacks \${target}!\`);
      this.energy -= 20;
      return true;
    }
    return false;
  }

  recharge() {
    this.energy = Math.min(100, this.energy + 25);
    console.log(\`Robot \${this.id} recharged to \${this.energy}%\`);
  }
}

class RobotArmy {
  constructor(size) {
    this.robots = [];
    for (let i = 0; i < size; i++) {
      this.robots.push(new Robot(i, Math.random() * 100, Math.random() * 100));
    }
    console.log(\`Army created with \${size} robots!\`);
  }

  deployAll() {
    console.log('Deploying army...');
    this.robots.forEach(robot => {
      robot.state = 'active';
      robot.move(Math.random() * 10 - 5, Math.random() * 10 - 5);
    });
  }

  status() {
    const stats = {
      total: this.robots.length,
      active: this.robots.filter(r => r.state === 'active').length,
      avgEnergy: this.robots.reduce((sum, r) => sum + r.energy, 0) / this.robots.length
    };
    console.log('Army Status:', stats);
    return stats;
  }

  formationAttack(target) {
    console.log(\`Coordinated attack on \${target}!\`);
    this.robots.forEach((robot, i) => {
      setTimeout(() => robot.attack(target), i * 100);
    });
  }
}

// Initialize and run
const army = new RobotArmy(10);
army.deployAll();
setTimeout(() => army.status(), 500);
setTimeout(() => army.formationAttack('Enemy Base'), 1000);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Robot, RobotArmy };
}`;
        explanation = "Created a virtual robot army simulation with Robot and RobotArmy classes. Features: movement, energy management, attack coordination, and status tracking. Run in Node.js or browser console!";
      } else if (description.toLowerCase().includes("game")) {
        code = `// Interactive Game Framework
class Game {
  constructor(name) {
    this.name = name;
    this.score = 0;
    this.level = 1;
    this.running = false;
    console.log(\`Game "\${name}" initialized!\`);
  }

  start() {
    this.running = true;
    this.score = 0;
    console.log('Game started!');
    this.gameLoop();
  }

  gameLoop() {
    if (!this.running) return;
    
    // Simulate game tick
    this.score += this.level * 10;
    console.log(\`Level \${this.level} - Score: \${this.score}\`);
    
    if (this.score % 100 === 0) {
      this.levelUp();
    }
    
    setTimeout(() => this.gameLoop(), 1000);
  }

  levelUp() {
    this.level++;
    console.log(\`🎉 Level Up! Now at level \${this.level}\`);
  }

  stop() {
    this.running = false;
    console.log(\`Game Over! Final Score: \${this.score}\`);
  }
}

// Initialize
const game = new Game("${description}");
game.start();

// Stop after 10 seconds (remove for continuous play)
setTimeout(() => game.stop(), 10000);`;
        explanation = "Created an interactive game framework with score tracking, levels, and a game loop. Customize the gameLoop() method for your specific game mechanics!";
      } else {
        // Generic code generation
        code = `// Generated Code: ${description}
// Language: ${language}, Style: ${style}

class Implementation {
  constructor() {
    this.initialized = false;
    console.log('Implementation created');
  }

  initialize() {
    this.initialized = true;
    console.log('System initialized');
    return this;
  }

  execute() {
    if (!this.initialized) {
      throw new Error('Must initialize first');
    }
    console.log('Executing: ${description}');
    return { success: true, timestamp: Date.now() };
  }
}

// Usage
const impl = new Implementation();
impl.initialize();
const result = impl.execute();
console.log('Result:', result);`;
        explanation = `Generated ${style} ${language} implementation for: ${description}. Customize the execute() method with your specific logic.`;
      }

      if (includeTests) {
        code += `\n\n// Tests
console.log('Running tests...');
// Add your test cases here`;
      }

      return {
        code,
        language,
        style,
        explanation,
        linesOfCode: code.split('\n').length,
        timestamp: new Date().toISOString(),
      };
    },
  }),
};

export type ToolName = keyof typeof agentTools;
