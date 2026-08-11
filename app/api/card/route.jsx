import { ImageResponse } from '@vercel/og';
import { unstable_cache } from 'next/cache';
import { promises as fs } from 'fs';
import path from 'path';
import { classifyAgent, getPowerTier } from '../../../lib/agent-class.js';
import { scoreAll } from '../../../lib/scoring.js';
import { getSiteHostname } from '../../../lib/site.js';
import { addDeveloperRanks } from '../../../lib/ranking.js';
import { getCosmosContainer } from '../../../lib/cosmos.js';

export const runtime = 'nodejs';

async function loadRankedDevelopers() {
  const cosmosContainer = getCosmosContainer();
  if (cosmosContainer) {
    try {
      const { resources } = await cosmosContainer.items.query({
        query: `SELECT c.id, c.login, c.name, c.avatarUrl, c.location, c.followers, c.totalStars, c.totalForks, c.totalWatchers, c.totalCommits, c.topLanguage, c.soReputation, c.soAnswers, c.soAcceptRate, c.soBadges, c.claimed
          FROM c
          WHERE NOT IS_DEFINED(c.nomination) OR c.nomination.status = 'approved'`,
      }).fetchAll();
      if (resources.length > 0) return addDeveloperRanks(scoreAll(resources));
    } catch (err) {
      console.error('Card: Cosmos error', err.message);
    }
  }

  const filePath = path.join(process.cwd(), 'data', 'developers-sample.json');
  const raw = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(raw);
  return addDeveloperRanks(scoreAll(data));
}

const getRankedDevelopers = unstable_cache(
  loadRankedDevelopers,
  ['card-ranked-developers-v1'],
  { revalidate: 3600, tags: ['developers'] }
);

async function getDeveloper(login) {
  const developers = await getRankedDevelopers();
  return developers.find(d => d.login.toLowerCase() === login.toLowerCase()) || null;
}

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

async function loadAvatarDataUrl(avatarUrl) {
  if (!avatarUrl) return null;

  try {
    const response = await fetch(avatarUrl, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/png';
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

const getAvatarDataUrl = unstable_cache(
  loadAvatarDataUrl,
  ['card-avatar-v1'],
  { revalidate: 86400 }
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const login = searchParams.get('login');

  if (!login) {
    return new Response('Missing login parameter', { status: 400 });
  }

  const dev = await getDeveloper(login);
  if (!dev) {
    return new Response('Developer not found', { status: 404 });
  }

  const agent = classifyAgent(dev);
  const power = getPowerTier(dev.score || 0);
  const avatarDataUrl = await getAvatarDataUrl(dev.avatarUrl);
  const avatarInitial = (dev.name || dev.login).trim().charAt(0).toUpperCase();
  const agentMark = agent.name
    .replace(/^The\s+/, '')
    .split(/\s+/)
    .map(word => word.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const hasCityRank = Boolean(dev.cityRank && dev.city);
  const rankCardWidth = hasCityRank ? '166' : dev.countryRank ? '255' : '522';

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200',
          height: '630',
          display: 'flex',
          background: 'linear-gradient(135deg, #080b10 0%, #111820 52%, #15120f 100%)',
          fontFamily: 'Inter, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top identity bar */}
        <div
          style={{
            position: 'absolute',
            top: '28',
            left: '40',
            right: '40',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', color: '#f8fafc', fontSize: '18', fontWeight: '800', letterSpacing: '1' }}>
            DEV<span style={{ color: '#22d3ee' }}>GLOBE</span>
          </div>
          <div style={{ display: 'flex', color: '#64748b', fontSize: '12', letterSpacing: '2' }}>
            OPEN SOURCE IDENTITY · 2026
          </div>
        </div>

        {/* Grid pattern overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            opacity: 0.06,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Glow effect behind avatar */}
        <div
          style={{
            position: 'absolute',
            top: '120',
            left: '80',
            width: '300',
            height: '300',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${agent.color}33 0%, transparent 70%)`,
            display: 'flex',
          }}
        />

        {/* Left side — Avatar + Agent class */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '400',
            padding: '76px 40px 54px',
          }}
        >
          {/* Agent mark */}
          <div
            style={{
              width: '52',
              height: '52',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${agent.color}88`,
              borderRadius: '12',
              background: `${agent.color}18`,
              color: agent.color,
              fontSize: '20',
              fontWeight: '800',
              letterSpacing: '1',
              marginBottom: '12',
              display: 'flex',
            }}
          >
            {agentMark}
          </div>

          {/* Avatar with border */}
          <div
            style={{
              display: 'flex',
              width: '180',
              height: '180',
              borderRadius: '50%',
              border: `4px solid ${agent.color}`,
              overflow: 'hidden',
              boxShadow: `0 0 40px ${agent.color}44`,
            }}
          >
            {avatarDataUrl ? (
              <img
                src={avatarDataUrl}
                width="180"
                height="180"
                style={{ borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '180',
                  height: '180',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  background: `${agent.color}22`,
                  color: agent.color,
                  fontSize: '72',
                  fontWeight: '800',
                }}
              >
                {avatarInitial}
              </div>
            )}
          </div>

          {/* Name */}
          <div
            style={{
              color: '#e2e8f0',
              fontSize: '28',
              fontWeight: '700',
              marginTop: '16',
              display: 'flex',
              textAlign: 'center',
            }}
          >
            {dev.name || dev.login}
          </div>

          {/* Login */}
          <div
            style={{
              color: '#64748b',
              fontSize: '18',
              display: 'flex',
              marginTop: '4',
            }}
          >
            @{dev.login}
          </div>

          {/* Location */}
          {dev.location && (
            <div
              style={{
                color: '#94a3b8',
                fontSize: '14',
                display: 'flex',
                marginTop: '8',
              }}
            >
              LOCATION · {dev.location}
            </div>
          )}
        </div>

        {/* Right side — Stats + Agent info */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            flex: 1,
            padding: '74px 60px 54px 20px',
          }}
        >
          {/* Agent class header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12',
              marginBottom: '8',
            }}
          >
            <div
              style={{
                color: agent.color,
                fontSize: '14',
                fontWeight: '600',
                letterSpacing: '3',
                textTransform: 'uppercase',
                display: 'flex',
              }}
            >
              AGENT CLASS
            </div>
          </div>

          <div
            style={{
              color: '#e2e8f0',
              fontSize: '36',
              fontWeight: '700',
              display: 'flex',
              marginBottom: '4',
            }}
          >
            {agent.name}
          </div>

          <div
            style={{
              color: '#94a3b8',
              fontSize: '16',
              fontStyle: 'italic',
              display: 'flex',
              marginBottom: '24',
            }}
          >
            &ldquo;{agent.tagline}&rdquo;
          </div>

          {/* Global and local rank */}
          <div style={{ display: 'flex', gap: '12', marginBottom: '22' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                width: rankCardWidth,
                height: '82',
                padding: '12px 18px',
                background: 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(34,211,238,0.04))',
                border: '1px solid rgba(34,211,238,0.32)',
                borderRadius: '8',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '7' }}>
                <span style={{ color: '#67e8f9', fontSize: '34', fontWeight: '800' }}>#{formatNum(dev.globalRank)}</span>
                <span style={{ color: '#64748b', fontSize: '14' }}>of {formatNum(dev.globalTotal)}</span>
              </div>
              <div style={{ display: 'flex', color: '#a5f3fc', fontSize: '11', fontWeight: '700', letterSpacing: '1.6' }}>GLOBAL RANK</div>
            </div>
            {dev.countryRank && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  width: rankCardWidth,
                  height: '82',
                  padding: '12px 18px',
                  background: 'linear-gradient(135deg, rgba(251,146,60,0.15), rgba(251,146,60,0.04))',
                  border: '1px solid rgba(251,146,60,0.32)',
                  borderRadius: '8',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '7' }}>
                  <span style={{ color: '#fdba74', fontSize: '34', fontWeight: '800' }}>#{formatNum(dev.countryRank)}</span>
                  <span style={{ color: '#64748b', fontSize: '14' }}>of {formatNum(dev.countryTotal)}</span>
                </div>
                <div style={{ display: 'flex', color: '#fed7aa', fontSize: '11', fontWeight: '700', letterSpacing: '1.2' }}>IN {dev.country.toUpperCase()}</div>
              </div>
            )}
            {hasCityRank && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  width: rankCardWidth,
                  height: '82',
                  padding: '12px 18px',
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.04))',
                  border: '1px solid rgba(139,92,246,0.32)',
                  borderRadius: '8',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '7' }}>
                  <span style={{ color: '#c4b5fd', fontSize: '34', fontWeight: '800' }}>#{formatNum(dev.cityRank)}</span>
                  <span style={{ color: '#64748b', fontSize: '14' }}>of {formatNum(dev.cityTotal)}</span>
                </div>
                <div style={{ display: 'flex', color: '#ddd6fe', fontSize: '11', fontWeight: '700', letterSpacing: '1.2' }}>IN {dev.city.toUpperCase()}</div>
              </div>
            )}
          </div>

          {/* Score + Tier */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16',
              marginBottom: '20',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '6',
              }}
            >
              <div
                style={{
                  color: power.color,
                  fontSize: '48',
                  fontWeight: '800',
                  lineHeight: '1',
                  display: 'flex',
                }}
              >
                {dev.score}
              </div>
              <div
                style={{
                  color: '#64748b',
                  fontSize: '20',
                  display: 'flex',
                }}
              >
                /100
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '2',
              }}
            >
              <div
                style={{
                  background: `${power.color}22`,
                  border: `1px solid ${power.color}66`,
                  borderRadius: '6',
                  padding: '4px 12px',
                  color: power.color,
                  fontSize: '13',
                  fontWeight: '700',
                  letterSpacing: '2',
                  display: 'flex',
                }}
              >
                {power.tier}-TIER · {power.label}
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div
            style={{
              display: 'flex',
              gap: '10',
              flexWrap: 'wrap',
            }}
          >
            {[
              { label: 'STARS', value: formatNum(dev.totalStars || 0), color: '#f0c040' },
              { label: 'COMMITS', value: formatNum(dev.totalCommits || 0), color: '#8b5cf6' },
              { label: 'FOLLOWERS', value: formatNum(dev.followers || 0), color: '#3b82f6' },
              { label: 'SO REP', value: formatNum(dev.soReputation || 0), color: '#f48024' },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8',
                  padding: '10px 14px',
                  minWidth: '120',
                }}
              >
                <div
                  style={{
                    color: '#64748b',
                    fontSize: '11',
                    fontWeight: '600',
                    letterSpacing: '1.5',
                    display: 'flex',
                    marginBottom: '4',
                  }}
                >
                  {stat.label}
                </div>
                <div
                  style={{
                    color: stat.color,
                    fontSize: '21',
                    fontWeight: '700',
                    display: 'flex',
                  }}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Language badge */}
          {dev.topLanguage && (
            <div
              style={{
                display: 'flex',
                marginTop: '20',
                gap: '8',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '20',
                  padding: '6px 14px',
                  color: '#94a3b8',
                  fontSize: '13',
                  display: 'flex',
                }}
              >
                {dev.topLanguage}
              </div>
              {dev.claimed && (
                <div
                  style={{
                    background: 'rgba(46,164,79,0.15)',
                    border: '1px solid rgba(46,164,79,0.4)',
                    borderRadius: '20',
                    padding: '6px 14px',
                    color: '#2ea44f',
                    fontSize: '13',
                    fontWeight: '600',
                    display: 'flex',
                  }}
                >
                  VERIFIED
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom branding bar */}
        <div
          style={{
            position: 'absolute',
            bottom: '0',
            left: '0',
            right: '0',
            height: '48',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0px 40px',
            background: 'rgba(0,0,0,0.4)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div
            style={{
              color: '#64748b',
              fontSize: '14',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8',
            }}
          >
            DEVGLOBE / OPEN SOURCE IDENTITY
          </div>
          <div
            style={{
              color: '#475569',
              fontSize: '13',
              display: 'flex',
            }}
          >
            {getSiteHostname()}
          </div>
        </div>

        {/* Top-right corner accent */}
        <div
          style={{
            position: 'absolute',
            top: '-60',
            right: '-60',
            width: '200',
            height: '200',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${agent.color}15 0%, transparent 70%)`,
            display: 'flex',
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    }
  );
}
