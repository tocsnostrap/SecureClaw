/**
 * AUTH MIDDLEWARE - API Key & Session Authentication
 * 
 * Protects all /api/* routes. Supports:
 * 1. API key via X-API-Key header or ?apiKey query param
 * 2. Session-based auth (for browser/dashboard)
 * 
 * For Replit deployment, set SECURECLAW_API_KEY in Secrets.
 * If not set, auth is disabled (development mode).
 */

import type { Request, Response, NextFunction } from "express";

// Public routes that don't require auth
const PUBLIC_ROUTES = new Set([
  "/api/health",
  "/api/config",
  "/api/oauth/instagram",
  "/api/oauth/google",
  "/api/oauth/twitter",
  "/api/oauth/callback/instagram",
  "/api/oauth/callback/google",
  "/api/oauth/callback/twitter",
  "/oauth-error",
]);

function isPublicRoute(path: string): boolean {
  // Exact match
  if (PUBLIC_ROUTES.has(path)) return true;
  // OAuth start routes
  if (path.startsWith("/api/oauth/start/")) return true;
  return false;
}

export function apiAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.SECURECLAW_API_KEY;

  // Development mode: no API key configured, allow all
  if (!apiKey) {
    if (!process.env._AUTH_WARNING_SHOWN) {
      console.warn("[Auth] ⚠️  No SECURECLAW_API_KEY set - API is UNPROTECTED. Set it in Replit Secrets for production.");
      process.env._AUTH_WARNING_SHOWN = "1";
    }
    return next();
  }

  // Public routes bypass auth
  if (isPublicRoute(req.path)) {
    return next();
  }

  // Non-API routes bypass auth
  if (!req.path.startsWith("/api")) {
    return next();
  }

  // Check API key from header or query
  const providedKey =
    req.header("X-API-Key") ||
    req.header("Authorization")?.replace("Bearer ", "") ||
    (req.query.apiKey as string);

  if (providedKey === apiKey) {
    return next();
  }

  // Check session auth (from passport/OAuth login)
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  res.status(401).json({
    error: "Unauthorized",
    message: "Provide a valid API key via X-API-Key header or Authorization: Bearer <key>",
  });
}

/**
 * Validate required environment variables at startup
 */
export function validateSecrets(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (!process.env.SECURECLAW_API_KEY) {
    warnings.push("SECURECLAW_API_KEY not set - API routes are unprotected");
  }

  if (!process.env.XAI_API_KEY) {
    warnings.push("XAI_API_KEY not set - AI features will not work");
  }

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret === "secureclaw_session_secret_change_in_production") {
    warnings.push("SESSION_SECRET not set or using default - set a strong random value in Replit Secrets");
  }

  const permKey = process.env.PERMISSIONS_KEY;
  if (!permKey || permKey === "secureclaw_default_key_change_me_32chars") {
    warnings.push("PERMISSIONS_KEY not set or using default - set a 32-char key in Replit Secrets");
  }

  if (warnings.length > 0) {
    console.warn("\n[Security] ⚠️  Configuration warnings:");
    warnings.forEach((w) => console.warn(`  - ${w}`));
    console.warn("");
  }

  return { valid: true, warnings };
}
