'use client';

import { useEffect, useRef, useState } from 'react';

export function useActivityFeed(logins, { limit, intervalMs = 30000 } = {}) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newActivityIds, setNewActivityIds] = useState(new Set());
  const [lastUpdated, setLastUpdated] = useState(null);
  const knownIdsRef = useRef(null);

  useEffect(() => {
    if (!logins) return;
    let cancelled = false;
    let inFlight = false;
    let highlightTimer;
    const query = new URLSearchParams({ logins });
    if (limit) query.set('limit', String(limit));

    async function refresh() {
      if (inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        const response = await fetch(`/api/activities?${query}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Activity request failed');
        const data = await response.json();
        if (cancelled) return;

        const nextIds = new Set(data.map(activity => activity.id));
        if (knownIdsRef.current) {
          const arrivedIds = new Set(data
            .filter(activity => !knownIdsRef.current.has(activity.id))
            .map(activity => activity.id));
          if (arrivedIds.size > 0) {
            setNewActivityIds(arrivedIds);
            clearTimeout(highlightTimer);
            highlightTimer = setTimeout(() => setNewActivityIds(new Set()), 10000);
          }
        }
        knownIdsRef.current = nextIds;
        setActivities(data);
        setLastUpdated(new Date());
      } catch {
        if (!cancelled && knownIdsRef.current === null) setActivities([]);
      } finally {
        if (!cancelled) setLoading(false);
        inFlight = false;
      }
    }

    knownIdsRef.current = null;
    setNewActivityIds(new Set());
    setLoading(true);
    refresh();
    const interval = setInterval(refresh, intervalMs);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(highlightTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs, limit, logins]);

  return { activities, loading, newActivityIds, lastUpdated };
}