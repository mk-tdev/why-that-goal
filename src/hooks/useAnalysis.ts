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
        }
      } catch {
        if (active) setState({ key, status: 'offline' });
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
    retry: () => setAttempt((n) => n + 1),
  };
}
