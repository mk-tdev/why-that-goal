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
    const timeout = setTimeout(() => controller.abort(), 6000);
    setState({ key, status: 'loading' });
    fetchAnalysis(JSON.parse(key), controller.signal)
      .then((data) => {
        if (active) setState({ key, status: 'ready', data });
      })
      .catch(() => {
        if (active) setState({ key, status: 'offline' });
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [key, attempt]);
  return {
    ...(state.key === key ? state : { key, status: 'loading' as const }),
    retry: () => setAttempt((n) => n + 1),
  };
}
