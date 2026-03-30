import type { Subscription, Category } from './types';
import { normalizeToMonthly } from './utils';
import { EXCHANGE_RATES_USD_BASE } from './constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecommendationVerdict = 'keep' | 'cancel' | 'review';

export interface SubscriptionRecommendation {
  verdict: RecommendationVerdict;
  rationale: string;
  factors: RecommendationFactor[];
}

export interface RecommendationFactor {
  label: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
}

// ─── Scoring weights ──────────────────────────────────────────────────────────

/** Days since lastUsed that starts to count against the subscription */
const STALE_THRESHOLD_DAYS = 30;
/** Days since lastUsed that is considered very stale */
const VERY_STALE_THRESHOLD_DAYS = 90;

/** Monthly cost thresholds in USD for scoring */
const COST_LOW_USD = 5;
const COST_HIGH_USD = 20;

/**
 * Categories that tend to be used passively (background value even without
 * active daily use — e.g. cloud backup, security tools).
 */
const PASSIVE_CATEGORIES: Category[] = ['cloud', 'saas'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(isoDate: string): number {
  const diff = Date.now() - new Date(isoDate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/** Convert subscription cost to USD monthly equivalent for comparison */
function toMonthlyUSD(sub: Subscription): number {
  const monthly = normalizeToMonthly(sub.cost, sub.billingCycle);
  const rate = EXCHANGE_RATES_USD_BASE[sub.currency] ?? 1;
  return monthly / rate; // convert to USD
}

// ─── Recommendation Engine ────────────────────────────────────────────────────

/**
 * Generates a client-side keep/cancel recommendation for a subscription.
 * Analyzes cost, lastUsed, category, and billing cycle.
 * No external API calls are made — all logic runs locally.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4
 */
export function getRecommendation(sub: Subscription): SubscriptionRecommendation {
  const factors: RecommendationFactor[] = [];
  let score = 0; // positive = keep, negative = cancel

  // ── Factor 1: Cost ──────────────────────────────────────────────────────────
  const monthlyUSD = toMonthlyUSD(sub);

  if (sub.billingCycle === 'lifetime') {
    factors.push({
      label: 'One-time payment',
      description: 'This is a lifetime purchase — no recurring cost.',
      impact: 'positive',
    });
    score += 3;
  } else if (monthlyUSD <= COST_LOW_USD) {
    factors.push({
      label: 'Low cost',
      description: `At ~$${monthlyUSD.toFixed(2)}/mo, this is an affordable subscription.`,
      impact: 'positive',
    });
    score += 1;
  } else if (monthlyUSD >= COST_HIGH_USD) {
    factors.push({
      label: 'High cost',
      description: `At ~$${monthlyUSD.toFixed(2)}/mo, this is a significant expense.`,
      impact: 'negative',
    });
    score -= 1;
  } else {
    factors.push({
      label: 'Moderate cost',
      description: `At ~$${monthlyUSD.toFixed(2)}/mo, this is a mid-range subscription.`,
      impact: 'neutral',
    });
  }

  // ── Factor 2: Last used ─────────────────────────────────────────────────────
  if (sub.lastUsed) {
    const days = daysSince(sub.lastUsed);
    const isPassive = PASSIVE_CATEGORIES.includes(sub.category);

    if (days <= STALE_THRESHOLD_DAYS) {
      factors.push({
        label: 'Recently used',
        description: `Last used ${days} day${days === 1 ? '' : 's'} ago — actively in use.`,
        impact: 'positive',
      });
      score += 2;
    } else if (days <= VERY_STALE_THRESHOLD_DAYS) {
      if (isPassive) {
        factors.push({
          label: 'Passive service',
          description: `Not opened recently, but ${sub.category} services often run in the background.`,
          impact: 'neutral',
        });
      } else {
        factors.push({
          label: 'Infrequent use',
          description: `Last used ${days} days ago — consider whether you still need this.`,
          impact: 'negative',
        });
        score -= 1;
      }
    } else {
      factors.push({
        label: 'Not used recently',
        description: `Last used ${days} days ago — this subscription may no longer be needed.`,
        impact: 'negative',
      });
      score -= 2;
    }
  } else {
    factors.push({
      label: 'Usage unknown',
      description: 'No usage data recorded. Consider tracking when you last used this service.',
      impact: 'neutral',
    });
  }

  // ── Factor 3: Billing cycle ─────────────────────────────────────────────────
  if (sub.billingCycle === 'yearly') {
    factors.push({
      label: 'Annual billing',
      description: 'Billed yearly — typically offers savings vs monthly, but harder to cancel mid-cycle.',
      impact: 'neutral',
    });
  } else if (sub.billingCycle === 'monthly') {
    factors.push({
      label: 'Monthly billing',
      description: 'Billed monthly — easy to cancel anytime without losing prepaid value.',
      impact: 'neutral',
    });
  } else if (sub.billingCycle === 'weekly') {
    factors.push({
      label: 'Weekly billing',
      description: 'Billed weekly — costs add up quickly. Verify this is worth the frequency.',
      impact: 'negative',
    });
    score -= 1;
  }

  // ── Factor 4: Category ──────────────────────────────────────────────────────
  if (sub.category === 'ai') {
    factors.push({
      label: 'AI tool',
      description: 'AI tools evolve rapidly — check if free alternatives now cover your needs.',
      impact: 'neutral',
    });
  } else if (sub.category === 'fitness') {
    factors.push({
      label: 'Fitness subscription',
      description: 'Fitness subscriptions are most valuable when used consistently.',
      impact: 'neutral',
    });
  }

  // ── Verdict ─────────────────────────────────────────────────────────────────
  let verdict: RecommendationVerdict;
  let rationale: string;

  if (score >= 2) {
    verdict = 'keep';
    rationale = buildRationale('keep', sub, factors, monthlyUSD);
  } else if (score <= -2) {
    verdict = 'cancel';
    rationale = buildRationale('cancel', sub, factors, monthlyUSD);
  } else {
    verdict = 'review';
    rationale = buildRationale('review', sub, factors, monthlyUSD);
  }

  return { verdict, rationale, factors };
}

function buildRationale(
  verdict: RecommendationVerdict,
  sub: Subscription,
  factors: RecommendationFactor[],
  monthlyUSD: number,
): string {
  const name = sub.customName ?? sub.service;
  const negatives = factors.filter((f) => f.impact === 'negative');
  const positives = factors.filter((f) => f.impact === 'positive');

  if (verdict === 'keep') {
    const reasons = positives.map((f) => f.description).join(' ');
    return `${name} looks worth keeping. ${reasons}`.trim();
  }

  if (verdict === 'cancel') {
    const reasons = negatives.map((f) => f.description).join(' ');
    const annualCost = (monthlyUSD * 12).toFixed(2);
    return `Consider cancelling ${name}. ${reasons} Cancelling could save you ~$${annualCost}/year.`.trim();
  }

  // review
  const proCount = positives.length;
  const conCount = negatives.length;
  return `${name} is worth a closer look. It has ${proCount} positive signal${proCount !== 1 ? 's' : ''} and ${conCount} concern${conCount !== 1 ? 's' : ''}. Review your usage before the next renewal.`;
}
