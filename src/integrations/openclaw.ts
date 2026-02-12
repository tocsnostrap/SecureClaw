/**
 * OpenClaw (Moltbot) Integration Module
 * 
 * This module provides access to OpenClaw skills and capabilities
 * integrated into SecureClaw.
 * 
 * Repository: https://github.com/openclaw/openclaw
 * Version: 2026.2.10
 * License: MIT
 */

import path from 'path';
import fs from 'fs';

export interface OpenClawSkill {
  name: string;
  path: string;
  description?: string;
  available: boolean;
}

/**
 * Get list of available OpenClaw skills
 */
export function getAvailableSkills(): OpenClawSkill[] {
  const skillsPath = path.join(process.cwd(), 'openclaw-integration', 'skills');
  
  try {
    if (!fs.existsSync(skillsPath)) {
      console.warn('[OpenClaw] Skills directory not found:', skillsPath);
      return [];
    }

    const skillDirs = fs.readdirSync(skillsPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => ({
        name: dirent.name,
        path: path.join(skillsPath, dirent.name),
        available: true,
      }));

    return skillDirs;
  } catch (error) {
    console.error('[OpenClaw] Error reading skills:', error);
    return [];
  }
}

/**
 * Get OpenClaw metadata
 */
export function getOpenClawInfo() {
  return {
    name: 'OpenClaw',
    formerNames: ['Moltbot', 'Clawdbot'],
    version: '2026.2.10',
    repository: 'https://github.com/openclaw/openclaw',
    documentation: 'https://docs.openclaw.ai',
    license: 'MIT',
    description: 'Personal AI assistant platform with multi-channel support',
    integrationDate: '2026-02-12',
    features: [
      'Multi-channel messaging (WhatsApp, Telegram, Slack, Discord, etc.)',
      '50+ extensible skills',
      'Voice wake word detection',
      'Live Canvas rendering',
      'Multi-agent routing',
      'Cron job scheduling',
      'Session management',
    ],
  };
}

/**
 * Check if OpenClaw integration is available
 */
export function isOpenClawAvailable(): boolean {
  const skillsPath = path.join(process.cwd(), 'openclaw-integration', 'skills');
  return fs.existsSync(skillsPath);
}

/**
 * Get skill path by name
 */
export function getSkillPath(skillName: string): string | null {
  const skillPath = path.join(process.cwd(), 'openclaw-integration', 'skills', skillName);
  return fs.existsSync(skillPath) ? skillPath : null;
}

/**
 * List popular OpenClaw skills
 */
export function getPopularSkills(): string[] {
  return [
    'github',
    'slack',
    'discord',
    'weather',
    'summarize',
    'coding-agent',
    'canvas',
    'voice-call',
    'browser',
    'session-logs',
  ];
}

/**
 * Export OpenClaw metadata for UI display
 */
export const OPENCLAW_METADATA = {
  logo: '🦞',
  tagline: 'EXFOLIATE! EXFOLIATE!',
  colors: {
    primary: '#FF6B6B',
    secondary: '#4ECDC4',
  },
};

// Log integration status on import
if (isOpenClawAvailable()) {
  const skills = getAvailableSkills();
  console.log(`[OpenClaw] ✅ Integration available with ${skills.length} skills`);
} else {
  console.log('[OpenClaw] ⚠️  Integration not found. Run setup to initialize.');
}
