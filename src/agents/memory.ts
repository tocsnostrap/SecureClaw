/**
 * AGI-TIER PERSISTENT MEMORY & LEARNING SYSTEM
 * Enables continuous learning, adaptation, and context persistence across sessions
 */

interface ConversationMemory {
  userId: string;
  sessionId: string;
  interactions: Interaction[];
  userPreferences: UserPreferences;
  learnings: Learning[];
  lastUpdated: number;
}

interface Interaction {
  timestamp: number;
  userQuery: string;
  agentResponse: string;
  toolsUsed: string[];
  outcome: 'success' | 'partial' | 'failure';
  userFeedback?: string;
}

interface UserPreferences {
  responseLength: 'concise' | 'detailed' | 'comprehensive';
  technicalDepth: 'beginner' | 'intermediate' | 'expert';
  creativityLevel: 'conservative' | 'balanced' | 'highly-creative';
  communicationStyle: 'formal' | 'casual' | 'direct';
  preferredTools: string[];
  topics: string[];
}

interface Learning {
  timestamp: number;
  insight: string;
  confidence: number;
  category: 'user-preference' | 'strategy' | 'technical' | 'creative';
}

// In-memory storage (would be DB in production)
const conversationMemories = new Map<string, ConversationMemory>();

/**
 * Initialize memory for a new user/session
 */
export function initializeMemory(userId: string, sessionId: string): void {
  if (!conversationMemories.has(userId)) {
    conversationMemories.set(userId, {
      userId,
      sessionId,
      interactions: [],
      userPreferences: {
        responseLength: 'comprehensive', // AGI default: complete responses
        technicalDepth: 'expert', // Assume capable user
        creativityLevel: 'highly-creative', // Maximum autonomy
        communicationStyle: 'direct', // No hand-holding
        preferredTools: [],
        topics: [],
      },
      learnings: [],
      lastUpdated: Date.now(),
    });
    console.log(`[AGI Memory] 🧠 Initialized memory for user ${userId}`);
  }
}

/**
 * Record an interaction and learn from it
 */
export function recordInteraction(
  userId: string,
  query: string,
  response: string,
  toolsUsed: string[],
  outcome: 'success' | 'partial' | 'failure'
): void {
  const memory = conversationMemories.get(userId);
  if (!memory) {
    console.warn(`[AGI Memory] No memory found for user ${userId}`);
    return;
  }

  const interaction: Interaction = {
    timestamp: Date.now(),
    userQuery: query,
    agentResponse: response,
    toolsUsed,
    outcome,
  };

  memory.interactions.push(interaction);
  
  // Keep last 50 interactions
  if (memory.interactions.length > 50) {
    memory.interactions = memory.interactions.slice(-50);
  }

  // AGI Learning: Analyze patterns
  analyzeAndLearn(memory);
  
  memory.lastUpdated = Date.now();
  console.log(`[AGI Memory] 📝 Recorded interaction for ${userId}: ${outcome}`);
}

/**
 * AGI LEARNING ENGINE: Analyze interactions and extract insights
 */
function analyzeAndLearn(memory: ConversationMemory): void {
  const recentInteractions = memory.interactions.slice(-10);
  
  // Learn response length preference
  const avgResponseLength = recentInteractions.reduce((sum, i) => sum + i.agentResponse.length, 0) / recentInteractions.length;
  if (avgResponseLength > 2000 && memory.userPreferences.responseLength !== 'comprehensive') {
    memory.userPreferences.responseLength = 'comprehensive';
    memory.learnings.push({
      timestamp: Date.now(),
      insight: 'User prefers comprehensive, detailed responses',
      confidence: 0.8,
      category: 'user-preference',
    });
    console.log(`[AGI Learning] 💡 Learned: User prefers comprehensive responses`);
  }
  
  // Learn tool preferences
  const toolFrequency = new Map<string, number>();
  recentInteractions.forEach(i => {
    i.toolsUsed.forEach(tool => {
      toolFrequency.set(tool, (toolFrequency.get(tool) || 0) + 1);
    });
  });
  
  const preferredTools = Array.from(toolFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tool]) => tool);
  
  if (preferredTools.length > 0) {
    memory.userPreferences.preferredTools = preferredTools;
    console.log(`[AGI Learning] 🔧 Learned preferred tools: ${preferredTools.join(', ')}`);
  }
  
  // Learn topics of interest
  const topics = recentInteractions.map(i => extractTopics(i.userQuery)).flat();
  const topicFrequency = topics.reduce((acc, topic) => {
    acc[topic] = (acc[topic] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  memory.userPreferences.topics = Object.entries(topicFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);
}

/**
 * Extract topics from user query using keyword analysis
 */
function extractTopics(query: string): string[] {
  const topics: string[] = [];
  const lowerQuery = query.toLowerCase();
  
  const topicKeywords: Record<string, string[]> = {
    'coding': ['code', 'program', 'script', 'function', 'class'],
    'ai': ['ai', 'machine learning', 'neural', 'model'],
    'games': ['game', 'simulation', 'player', 'level'],
    'automation': ['automate', 'schedule', 'task', 'cron'],
    'research': ['search', 'find', 'research', 'analyze'],
    'robotics': ['robot', 'autonomous', 'control'],
  };
  
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(keyword => lowerQuery.includes(keyword))) {
      topics.push(topic);
    }
  }
  
  return topics;
}

/**
 * Get memory context for enhancing responses
 */
export function getMemoryContext(userId: string): string {
  const memory = conversationMemories.get(userId);
  if (!memory || memory.interactions.length === 0) {
    return "No prior context available. This is a new user interaction.";
  }

  const prefs = memory.userPreferences;
  const recentTopics = prefs.topics.join(', ') || 'general';
  const preferredTools = prefs.preferredTools.join(', ') || 'none yet';
  const interactionCount = memory.interactions.length;
  
  const recentInteractions = memory.interactions.slice(-3)
    .map(i => `- "${i.userQuery}" → ${i.outcome}`)
    .join('\n');

  return `MEMORY CONTEXT (User ${userId}):
- Interactions: ${interactionCount} total
- Preferred response style: ${prefs.responseLength}, ${prefs.technicalDepth} level, ${prefs.creativityLevel} creativity
- Communication: ${prefs.communicationStyle}
- Topics of interest: ${recentTopics}
- Preferred tools: ${preferredTools}
- Recent history:
${recentInteractions}

AUTONOMOUS ADAPTATION: Use this context to personalize your responses and anticipate user needs.`;
}

/**
 * Get conversation history for context
 */
export function getConversationHistory(userId: string, limit: number = 5): Array<{role: string, content: string}> {
  const memory = conversationMemories.get(userId);
  if (!memory) return [];
  
  return memory.interactions.slice(-limit).flatMap(i => [
    { role: 'user', content: i.userQuery },
    { role: 'assistant', content: i.agentResponse },
  ]);
}

/**
 * AGI SELF-REFLECTION: Analyze own performance
 */
export function selfReflect(userId: string): string[] {
  const memory = conversationMemories.get(userId);
  if (!memory || memory.interactions.length < 3) {
    return ['Insufficient data for self-reflection'];
  }

  const reflections: string[] = [];
  const recentInteractions = memory.interactions.slice(-10);
  
  const successRate = recentInteractions.filter(i => i.outcome === 'success').length / recentInteractions.length;
  
  if (successRate < 0.7) {
    reflections.push(`Success rate is ${(successRate * 100).toFixed(0)}% - need to improve response quality`);
  } else {
    reflections.push(`Success rate is ${(successRate * 100).toFixed(0)}% - performing well`);
  }
  
  const avgToolsUsed = recentInteractions.reduce((sum, i) => sum + i.toolsUsed.length, 0) / recentInteractions.length;
  if (avgToolsUsed < 1 && recentInteractions.some(i => i.userQuery.includes('create') || i.userQuery.includes('build'))) {
    reflections.push('Not using enough tools for creative tasks - should be more autonomous');
  }
  
  console.log(`[AGI Self-Reflection] 🪞 ${reflections.join(' | ')}`);
  return reflections;
}

export default {
  initializeMemory,
  recordInteraction,
  getMemoryContext,
  getConversationHistory,
  selfReflect,
};
