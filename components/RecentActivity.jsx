'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { formatRelativeTime } from '../lib/format.js';
import { useActivityFeed } from './useActivityFeed.js';

export default function RecentActivity({ developers }) {
  const topDevelopers = useMemo(
    () => [...developers].sort((left, right) => right.score - left.score).slice(0, 5),
    [developers]
  );
  const logins = topDevelopers.map(developer => developer.login).join(',');
  const { activities, loading, newActivityIds, lastUpdated } = useActivityFeed(logins);
  const visibleActivities = useMemo(() => {
    const seenLogins = new Set();
    return activities.filter(activity => {
      if (seenLogins.has(activity.login)) return false;
      seenLogins.add(activity.login);
      return true;
    }).slice(0, topDevelopers.length);
  }, [activities, topDevelopers.length]);
  const visibleNewCount = visibleActivities.filter(activity => newActivityIds.has(activity.id)).length;

  const developerByLogin = new Map(topDevelopers.map(developer => [developer.login, developer]));

  return (
    <section className="recent-activity" aria-labelledby="recent-activity-title">
      <div className="recent-activity__header">
        <div>
          <span className="recent-activity__eyebrow">Top developers</span>
          <h2 id="recent-activity-title">Recent activity</h2>
        </div>
        <span className="recent-activity__live" role="status" aria-live="polite">
          {visibleNewCount > 0 ? `${visibleNewCount} new` : 'Live'}
        </span>
      </div>

      <div className="recent-activity__list">
        {loading && <p className="recent-activity__status">Loading public GitHub activity...</p>}
        {!loading && visibleActivities.length === 0 && (
          <p className="recent-activity__status">Recent public activity is unavailable.</p>
        )}
        {visibleActivities.map(activity => {
          const developer = developerByLogin.get(activity.login);
          return (
            <article className={`activity-row${newActivityIds.has(activity.id) ? ' activity-row--new' : ''}`} key={activity.id}>
              <Link className="activity-row__person" href={`/developer/${encodeURIComponent(activity.login)}`}>
                <img src={activity.avatarUrl || developer?.avatarUrl} alt="" />
                <span>{developer?.name || activity.login}</span>
              </Link>
              <a className="activity-row__event" href={activity.url} target="_blank" rel="noopener noreferrer">
                {activity.description}
              </a>
              <time dateTime={activity.createdAt}>{formatRelativeTime(activity.createdAt)}</time>
            </article>
          );
        })}
      </div>
      {lastUpdated && (
        <time className="recent-activity__updated" dateTime={lastUpdated.toISOString()}>
          Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </time>
      )}
    </section>
  );
}