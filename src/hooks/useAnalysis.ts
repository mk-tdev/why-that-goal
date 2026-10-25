import { ApiError } from '../core/session';
import { useEffect, useState } from 'react';
import type { AnalysisRequest, AnalysisResponse } from '../../server/contracts';
import { fetchAnalysis } from '../core/analysisClient';
export function useAnalysis(request: AnalysisRequest) {
  const key = JSON.stringify(request);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    status: 'loading' | 'ready' | 'offline';
    data?: AnalysisResponse;
    rateLimited?: boolean;
  }>({ key, status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let poll: ReturnType<typeof setTimeout> | undefined;
    setState({ key, status: 'loading' });
    const load = async () => {
      const timeout = setTimeout(() => controller.abort(), 6000);
      try {
        const data = await fetchAnalysis(JSON.parse(key), controller.signal);
        if (active) {
          setState({ key, status: 'ready', data });
          if (data.trace.pending) poll = setTimeout(load, 1500);
          else if (data.reason === 'capacity') poll = setTimeout(load, 60000);
        }
      } catch (error) {
        if (active) {
          const rateLimited = error instanceof ApiError && error.status === 429;
          setState((previous) => ({
            key,
            status: 'offline',
            rateLimited,
            data: previous.key === key ? previous.data : undefined,
          }));
          if (rateLimited) poll = setTimeout(load, error.retryAfter * 1000);
        }
      } finally {
        clearTimeout(timeout);
      }
    };
    void load();
    return () => {
      active = false;
      clearTimeout(poll);
      controller.abort();
    };
  }, [key, attempt]);
  return {
    ...(state.key === key ? state : { key, status: 'loading' as const }),
    rateLimited: state.key === key && state.rateLimited === true,
    retry: () => setAttempt((n) => n + 1),
  };
}
