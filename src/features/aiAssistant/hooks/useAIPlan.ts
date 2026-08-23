import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { getPlan } from '@/lib/ai/plan';
import type { AIPlan } from '@/lib/ai/plan';

export function useAIPlan(sessionId: string | null): AIPlan | null {
  const databasePlan = useLiveQuery(
    () => (sessionId ? getPlan({ type: 'ai_session', id: sessionId }) : Promise.resolve(undefined)),
    [sessionId]
  );
  const latestUpdatedAtRef = useRef(0);
  const [eventPlan, setEventPlan] = useState<{ plan: AIPlan | null; updatedAt: number } | null>(
    null
  );

  useEffect(() => {
    latestUpdatedAtRef.current = databasePlan?.updatedAt || 0;
  }, [databasePlan]);

  useEffect(() => {
    latestUpdatedAtRef.current = 0;
    setEventPlan(null);

    const handlePlanEvent = (message: unknown) => {
      if (!isRecord(message) || message.type !== 'AI_PLAN_EVENT' || !isRecord(message.owner)) {
        return;
      }
      if (
        message.owner.type !== 'ai_session' ||
        message.owner.id !== sessionId ||
        typeof message.updatedAt !== 'number' ||
        message.updatedAt < latestUpdatedAtRef.current
      ) {
        return;
      }

      const plan = message.plan === null || isAIPlan(message.plan) ? message.plan : undefined;
      if (plan === undefined) return;
      latestUpdatedAtRef.current = message.updatedAt;
      setEventPlan({ plan, updatedAt: message.updatedAt });
    };

    browser.runtime.onMessage.addListener(handlePlanEvent);
    return () => browser.runtime.onMessage.removeListener(handlePlanEvent);
  }, [sessionId]);

  if (eventPlan && eventPlan.updatedAt >= (databasePlan?.updatedAt || 0)) {
    return eventPlan.plan;
  }
  return databasePlan ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAIPlan(value: unknown): value is AIPlan {
  if (!isRecord(value) || typeof value.goal !== 'string' || !Array.isArray(value.steps)) {
    return false;
  }
  return (
    (value.status === 'active' ||
      value.status === 'completed' ||
      value.status === 'blocked' ||
      value.status === 'cancelled') &&
    typeof value.updatedAt === 'number'
  );
}
