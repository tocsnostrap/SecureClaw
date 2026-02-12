/**
 * CREDITS SYSTEM - In-App API Usage Management
 * 
 * Simple credits system for controlling API spend
 * Users get credits, each API call costs credits
 */

interface UserCredits {
  userId: string;
  balance: number;
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  usedThisMonth: number;
  resetDate: number;
}

const creditsStore = new Map<string, UserCredits>();

const PLAN_LIMITS: Record<string, { monthly: number; costPerCall: number }> = {
  free: { monthly: 100, costPerCall: 1 },
  basic: { monthly: 1000, costPerCall: 1 },
  pro: { monthly: 10000, costPerCall: 0.5 },
  enterprise: { monthly: 100000, costPerCall: 0.25 },
};

/**
 * Initialize user credits
 */
export function initializeCredits(userId: string, plan: 'free' | 'basic' | 'pro' | 'enterprise' = 'free'): UserCredits {
  const now = Date.now();
  const resetDate = new Date(now);
  resetDate.setMonth(resetDate.getMonth() + 1);
  
  const credits: UserCredits = {
    userId,
    balance: PLAN_LIMITS[plan].monthly,
    plan,
    usedThisMonth: 0,
    resetDate: resetDate.getTime(),
  };
  
  creditsStore.set(userId, credits);
  console.log(`[Credits] 💳 Initialized ${plan} plan for ${userId}: ${credits.balance} credits`);
  
  return credits;
}

/**
 * Check if user has enough credits
 */
export function hasCredits(userId: string, amount: number = 1): boolean {
  let userCredits = creditsStore.get(userId);
  
  if (!userCredits) {
    userCredits = initializeCredits(userId);
  }
  
  // Check if needs reset
  if (Date.now() > userCredits.resetDate) {
    resetMonthlyCredits(userId);
    userCredits = creditsStore.get(userId)!;
  }
  
  return userCredits.balance >= amount;
}

/**
 * Deduct credits for API call
 */
export function deductCredits(userId: string, operation: string): { success: boolean; remaining: number; message?: string } {
  let userCredits = creditsStore.get(userId);
  
  if (!userCredits) {
    userCredits = initializeCredits(userId);
  }
  
  const cost = PLAN_LIMITS[userCredits.plan].costPerCall;
  
  if (userCredits.balance < cost) {
    return {
      success: false,
      remaining: userCredits.balance,
      message: `Insufficient credits. Need ${cost}, have ${userCredits.balance}. Upgrade plan?`,
    };
  }
  
  userCredits.balance -= cost;
  userCredits.usedThisMonth += cost;
  
  console.log(`[Credits] 💰 Deducted ${cost} credits for ${operation}. Remaining: ${userCredits.balance}`);
  
  return {
    success: true,
    remaining: userCredits.balance,
  };
}

/**
 * Reset monthly credits
 */
function resetMonthlyCredits(userId: string): void {
  const userCredits = creditsStore.get(userId);
  if (!userCredits) return;
  
  userCredits.balance = PLAN_LIMITS[userCredits.plan].monthly;
  userCredits.usedThisMonth = 0;
  
  const resetDate = new Date();
  resetDate.setMonth(resetDate.getMonth() + 1);
  userCredits.resetDate = resetDate.getTime();
  
  console.log(`[Credits] 🔄 Monthly reset for ${userId}: ${userCredits.balance} credits`);
}

/**
 * Get user credit status
 */
export function getCreditStatus(userId: string): UserCredits | null {
  let userCredits = creditsStore.get(userId);
  
  if (!userCredits) {
    userCredits = initializeCredits(userId);
  }
  
  return userCredits;
}

/**
 * Upgrade user plan (simulate purchase)
 */
export function upgradePlan(userId: string, newPlan: 'free' | 'basic' | 'pro' | 'enterprise'): { success: boolean; message: string } {
  let userCredits = creditsStore.get(userId);
  
  if (!userCredits) {
    userCredits = initializeCredits(userId, newPlan);
    return {
      success: true,
      message: `Upgraded to ${newPlan} plan! You now have ${userCredits.balance} credits.`,
    };
  }
  
  const oldPlan = userCredits.plan;
  userCredits.plan = newPlan;
  userCredits.balance = PLAN_LIMITS[newPlan].monthly;
  
  console.log(`[Credits] ⬆️  Upgraded ${userId} from ${oldPlan} to ${newPlan}`);
  
  return {
    success: true,
    message: `Upgraded from ${oldPlan} to ${newPlan}! You now have ${userCredits.balance} credits/month.`,
  };
}

export default {
  initializeCredits,
  hasCredits,
  deductCredits,
  getCreditStatus,
  upgradePlan,
};
