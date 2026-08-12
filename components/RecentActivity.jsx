'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatRelativeTime } from '../lib/format.js';
import { useActivityFeed } from './useActivityFeed.js';

export default function RecentActivity({ developers }) {
  const [minimized, setMinimized] = useState(false);
  const topDevelopers = useMemo(
    () => [...developers].sort((left, right) => right.score - left.score).slice(0, 5),
    [developers]
  );
  const logins = topDevelopers.map(developer => developer.login).join(',');
  const { activities, loading, newActivityIds, lastUpdated } = useActivityFeed(logins);
  const visibleActivities = useMemo(() => {
    const now = new Date();
    const seenLogins = new Set();
    return activities.filter(activity => {
      const createdAt = new Date(activity.createdAt);
      const isToday = createdAt.getFullYear() === now.getFullYear()
        && createdAt.getMonth() === now.getMonth()
        && createdAt.getDate() === now.getDate();
      if (!isToday) return false;
      if (seenLogins.has(activity.login)) return false;
      seenLogins.add(activity.login);
      return true;
    }).slice(0, topDevelopers.length);
  }, [activities, topDevelopers.length]);
  const visibleNewCount = visibleActivities.filter(activity => newActivityIds.has(activity.id)).length;

  const developerByLogin = new Map(topDevelopers.map(developer => [developer.login, developer]));

  return (
    <section className={`recent-activity${minimized ? ' recent-activity--minimized' : ''}`} aria-labelledby="recent-activity-title">
      <div className="recent-activity__header">
        <div>
          <span className="recent-activity__eyebrow">Top developers</span>
          <h2 id="recent-activity-title">Today&apos;s activity</h2>
        </div>
        <div className="recent-activity__actions">
          <span className="recent-activity__live" role="status" aria-live="polite">
            {visibleNewCount > 0 ? `${visibleNewCount} new` : 'Live'}
          </span>
          <button
            type="button"
            className="recent-activity__size-btn"
            aria-expanded={!minimized}
            aria-controls="recent-activity-content"
            aria-label={minimized ? 'Maximize recent activity' : 'Minimize recent activity'}
            title={minimized ? 'Maximize' : 'Minimize'}
            onClick={() => setMinimized(current => !current)}
          >
            <span aria-hidden="true">{minimized ? '□' : '−'}</span>
          </button>
        </div>
      </div>

      <div className="recent-activity__list" id="recent-activity-content">
        {loading && <p className="recent-activity__status">Loading public GitHub activity...</p>}
        {!loading && visibleActivities.length === 0 && (
          <p className="recent-activity__status">No public activity from top developers today.</p>
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