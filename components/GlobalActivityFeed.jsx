'use client';

import Link from 'next/link';
import { useGlobalActivityFeed } from './useGlobalActivityFeed.js';

function relativeTime(timestamp) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function GlobalActivityFeed({ active }) {
  const {
    activities,
    loading,
    loadingMore,
    error,
    newActivityIds,
    nextCursor,
    lastUpdated,
    loadMore,
    refresh,
  } = useGlobalActivityFeed(active);

  return (
    <div className="global-activity">
      <div className="global-activity__status">
        <span className="global-activity__live" aria-live="polite">
          {newActivityIds.size > 0 ? `${newActivityIds.size} new` : 'Live'}
        </span>
        <span>Best-effort GitHub events</span>
      </div>

      {loading && <p className="global-activity__message">Loading activities...</p>}
      {!loading && error && (
        <div className="global-activity__message">
          <span>{error}</span>
          <button type="button" onClick={() => refresh(activities.length === 0)}>Retry</button>
        </div>
      )}
      {!loading && !error && activities.length === 0 && (
        <p className="global-activity__message">No indexed developer activity has been collected in the last 24 hours.</p>
      )}

      <ol className="global-activity__list">
        {activities.map(activity => (
          <li className={newActivityIds.has(activity.id) ? 'global-activity__item global-activity__item--new' : 'global-activity__item'} key={activity.id}>
            <Link className="global-activity__developer" href={`/developer/${encodeURIComponent(activity.login)}`}>
              <img src={activity.avatarUrl || `https://github.com/${encodeURIComponent(activity.login)}.png?size=64`} alt="" loading="lazy" />
              <span>@{activity.login}</span>
            </Link>
            <a className="global-activity__event" href={activity.url} target="_blank" rel="noopener noreferrer">
              {activity.description}
            </a>
            <time dateTime={activity.createdAt} title={new Date(activity.createdAt).toLocaleString()}>
              {relativeTime(activity.createdAt)}
            </time>
          </li>
        ))}
      </ol>

      {nextCursor && (
        <button className="global-activity__more" type="button" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading...' : 'Load earlier activity'}
        </button>
      )}
      {lastUpdated && (
        <time className="global-activity__updated" dateTime={lastUpdated.toISOString()}>
          Checked {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </time>
      )}
    </div>
  );
}