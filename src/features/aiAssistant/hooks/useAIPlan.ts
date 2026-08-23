import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { type AIPlan, getPlan } from '@/lib/ai/plan';

export function useAIPlan(sessionId: string | null): AIPlan | null {
  const [plan, setPlan] = useState<AIPlan | null>(null);
  const latestUpdatedAtRef = useRef(0);

  useEffect(() => {
    if (!sessionId) {
      latestUpdatedAtRef.current = 0;
      setPlan(null);
      return;
    }

    let disposed = false;
    latestUpdatedAtRef.current = 0;
    const owner = { type: 'ai_session' as const, id: sessionId };
    const applyPlan = (nextPlan: AIPlan | null, updatedAt: number) => {
      if (updatedAt < latestUpdatedAtRef.current) return;
      latestUpdatedAtRef.current = updatedAt;
      setPlan(nextPlan);
    };
    const loadPlan = async () => {
      const nextPlan = await getPlan(owner);
      if (!disposed && (!nextPlan || isAIPlan(nextPlan))) {
        applyPlan(nextPlan || null, nextPlan?.updatedAt || 0);
      }
    };
    const handleMessage = (message: unknown) => {
      if (!isRecord(message) || message.type !== 'AI_PLAN_EVENT' || !isRecord(message.owner))
        return;
      if (message.owner.type !== owner.type || message.owner.id !== owner.id) return;
      const nextPlan = isAIPlan(message.plan) ? message.plan : null;
      const updatedAt =
        typeof message.updatedAt === 'number' ? message.updatedAt : nextPlan?.updatedAt || 0;
      applyPlan(nextPlan, updatedAt);
    };

    browser.runtime.onMessage.addListener(handleMessage);
    void loadPlan().catch(() => undefined);
    return () => {
      disposed = true;
      browser.runtime.onMessage.removeListener(handleMessage);
    };
  }, [sessionId]);

  return plan;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAIPlan(value: unknown): value is AIPlan {
  if (!isRecord(value) || typeof value.goal !== 'string' || typeof value.updatedAt !== 'number') {
    return false;
  }
  if (
    value.status !== 'active' &&
    value.status !== 'completed' &&
    value.status !== 'blocked' &&
    value.status !== 'cancelled'
  ) {
    return false;
  }
  return (
    Array.isArray(value.steps) &&
    value.steps.every(
      (step) =>
        isRecord(step) &&
        typeof step.id === 'string' &&
        typeof step.title === 'string' &&
        (step.status === 'pending' ||
          step.status === 'in_progress' ||
          step.status === 'completed' ||
          step.status === 'blocked')
    )
  );
}
