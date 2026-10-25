import { securedFetch } from '../core/session';
import { useEffect, useState } from 'react';
import type { FeedFrame } from '../../server/feed';
export function useLiveFeed(scenarioId: string, duration: number) {
  const [run, setRun] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<{
    status: 'idle' | 'connecting' | 'live' | 'complete' | 'error';
    time: number;
    ids: string[];
  }>({ status: 'idle', time: 0, ids: [] });
  useEffect(() => {
    if (!enabled) return;
    let active = true,
      lastTime = -1;
    const ids = new Set<string>();
    setState({ status: 'connecting', time: 0, ids: [] });
    const source = new EventSource(`/api/feed?scenarioId=${encodeURIComponent(scenarioId)}`);
    let watchdog = setTimeout(fail, 6000);
    function fail() {
      clearTimeout(watchdog);
      source.close();
      if (active) setState((s) => ({ ...s, status: 'error' }));
    }
    source.onmessage = (message) => {
      try {
        const frame: FeedFrame = JSON.parse(message.data);
        if (
          frame.scenarioId !== scenarioId ||
          !Number.isFinite(frame.time) ||
          frame.time < lastTime ||
          frame.time > duration ||
          !Array.isArray(frame.events) ||
          typeof frame.complete !== 'boolean' ||
          (frame.complete && frame.time !== duration) ||
          frame.events.some(
            (e) =>
              typeof e.id !== 'string' ||
              !Number.isInteger(e.version) ||
              !Number.isFinite(e.at) ||
              !Number.isFinite(e.receivedAt) ||
              e.at > frame.time ||
              e.receivedAt > frame.time,
          )
        )
          throw new Error('Invalid feed frame');
        lastTime = frame.time;
        frame.events.forEach((e) => ids.add(`${e.id}@${e.version}`));
        clearTimeout(watchdog);
        if (active)
          setState({
            status: frame.complete ? 'complete' : 'live',
            time: frame.time,
            ids: [...ids],
          });
        if (frame.complete) source.close();
        else watchdog = setTimeout(fail, 6000);
      } catch {
        fail();
      }
    };
    source.onerror = () => {
      fail();
      void securedFetch('/api/auth/me').catch(() => {});
    };
    return () => {
      active = false;
      clearTimeout(watchdog);
      source.close();
    };
  }, [enabled, run, scenarioId, duration]);
  return {
    ...state,
    enabled,
    start: () => {
      setState({ status: 'connecting', time: 0, ids: [] });
      setEnabled(true);
      setRun((n) => n + 1);
    },
    stop: () => {
      setEnabled(false);
      setState({ status: 'idle', time: 0, ids: [] });
    },
  };
}
