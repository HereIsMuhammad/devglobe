import { ImageResponse } from '@vercel/og';
import { promises as fs } from 'fs';
import path from 'path';
import { classifyAgent, getPowerTier } from '../../../lib/agent-class.js';
import { scoreAll } from '../../../lib/scoring.js';
import { getSiteHostname } from '../../../lib/site.js';
import { addDeveloperRanks } from '../../../lib/ranking.js';
import { getCosmosContainer } from '../../../lib/cosmos.js';
import { getPublicAiToolNames } from '../../../lib/ai-profile.js';

export const runtime = 'nodejs';

async function getDeveloper(login) {
  const cosmosContainer = getCosmosContainer();
  if (cosmosContainer) {
    try {
      const { resources } = await cosmosContainer.items.query({
        query: `SELECT TOP 1 c.id, c.login, c.name, c.avatarUrl, c.location, c.followers, c.totalStars, c.totalForks, c.totalWatchers, c.totalCommits, c.topLanguage, c.soReputation, c.soAnswers, c.soAcceptRate, c.soBadges, c.publicRepos, c.claimed, c.score, c.globalRank, c.globalTotal, c.country, c.countryRank, c.countryTotal, c.city, c.cityRank, c.cityTotal, c.aiProfile
          FROM c
          WHERE (c.login = @login OR c.id = @login)
            AND (NOT IS_DEFINED(c.nomination) OR c.nomination.status = 'approved')`,
        parameters: [{ name: '@login', value: login }],
      }).fetchAll();
      if (resources[0]) return resources[0];
    } catch (err) {
      console.error('Card: Cosmos error', err.message);
    }
  }

  const filePath = path.join(process.cwd(), 'data', 'developers-sample.json');
  const raw = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(raw);
  const developers = addDeveloperRanks(scoreAll(data));
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
    const response = await fetch(avatarUrl, {
      signal: AbortSignal.timeout(3000),
      next: { revalidate: 86400 },
    });
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/png';
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

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

  const score = Number.isFinite(dev.score) ? dev.score : 0;
  const agent = classifyAgent({ ...dev, score });
  const power = getPowerTier(score);
  const avatarDataUrl = await loadAvatarDataUrl(dev.avatarUrl);
  const avatarInitial = (dev.name || dev.login).trim().charAt(0).toUpperCase();
  const agentMark = agent.name
    .replace(/^The\s+/, '')
    .split(/\s+/)
    .map(word => word.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const hasGlobalRank = Boolean(dev.globalRank && dev.globalTotal);
  const hasCityRank = Boolean(dev.cityRank && dev.city);
  const rankCardWidth = hasCityRank ? '166' : dev.countryRank ? '255' : '522';
  const rankValueFontSize = hasCityRank ? '29' : '34';
  const rankTotalFontSize = hasCityRank ? '12' : '14';
  const aiToolNames = getPublicAiToolNames(dev.aiProfile);

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

        {/* Glow effect behind hero */}
        <div
          style={{
            position: 'absolute',
            top: '92',
            left: '50',
            width: '330',
            height: '390',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${agent.color}33 0%, transparent 70%)`,
            display: 'flex',
          }}
        />

        {/* Left side — Contribution hero */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '400',
            padding: '72px 34px 48px',
          }}
        >
          {/* Hero bust with the GitHub portrait as its head */}
          <div
            style={{
              width: '268',
              height: '300',
              position: 'relative',
              alignItems: 'center',
              flexDirection: 'column',
              display: 'flex',
            }}
          >
            <div style={{ position: 'absolute', top: '108', left: '7', width: '254', height: '182', display: 'flex', background: `linear-gradient(145deg, ${agent.color}66, #090d14 72%)`, borderRadius: '126px 126px 22px 22px', border: `2px solid ${agent.color}88` }} />
            <div style={{ position: 'absolute', top: '126', left: '68', width: '132', height: '166', display: 'flex', background: `linear-gradient(180deg, ${agent.color}, #111827 78%)`, borderRadius: '48px 48px 18px 18px', border: `2px solid ${agent.color}` }} />
            <div style={{ position: 'absolute', top: '164', left: '101', width: '66', height: '66', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080b10', border: `3px solid ${agent.color}`, transform: 'rotate(45deg)', boxShadow: `0 0 24px ${agent.color}99` }}>
              <div
                style={{
                  display: 'flex',
                  transform: 'rotate(-45deg)',
                  color: '#f8fafc',
                  fontSize: '21',
                  fontWeight: '900',
                }}
              >
                {agentMark}
              </div>
            </div>
            <div style={{ position: 'absolute', top: '4', width: '142', height: '142', display: 'flex', borderRadius: '50%', border: `5px solid ${agent.color}`, overflow: 'hidden', background: '#111827', boxShadow: `0 0 38px ${agent.color}66` }}>
              {avatarDataUrl ? (
                <img src={avatarDataUrl} width="142" height="142" style={{ borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '142', height: '142', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: `${agent.color}22`, color: agent.color, fontSize: '58', fontWeight: '800' }}>
                  {avatarInitial}
                </div>
              )}
            </div>
            <div style={{ position: 'absolute', top: '132', width: '116', height: '18', display: 'flex', background: agent.color, borderRadius: '2px 2px 12px 12px', boxShadow: `0 5px 16px ${agent.color}66` }} />
          </div>

          {/* Name */}
          <div
            style={{
              color: '#e2e8f0',
              fontSize: '25',
              fontWeight: '700',
              marginTop: '4',
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
              fontSize: '16',
              display: 'flex',
              marginTop: '3',
            }}
          >
            @{dev.login}
          </div>

          {/* Location */}
          {dev.location && (
            <div
              style={{
                color: '#94a3b8',
                fontSize: '12',
                display: 'flex',
                marginTop: '6',
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
          {hasGlobalRank && <div style={{ display: 'flex', gap: '12', marginBottom: '22' }}>
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
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '4', width: '100%' }}>
                <span style={{ color: '#67e8f9', fontSize: rankValueFontSize, fontWeight: '800', lineHeight: '1' }}>#{formatNum(dev.globalRank)}</span>
                <span style={{ color: '#64748b', fontSize: rankTotalFontSize, whiteSpace: 'nowrap' }}>of {formatNum(dev.globalTotal)}</span>
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
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '4', width: '100%' }}>
                  <span style={{ color: '#fdba74', fontSize: rankValueFontSize, fontWeight: '800', lineHeight: '1' }}>#{formatNum(dev.countryRank)}</span>
                  <span style={{ color: '#64748b', fontSize: rankTotalFontSize, whiteSpace: 'nowrap' }}>of {formatNum(dev.countryTotal)}</span>
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
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '4', width: '100%' }}>
                  <span style={{ color: '#c4b5fd', fontSize: rankValueFontSize, fontWeight: '800', lineHeight: '1' }}>#{formatNum(dev.cityRank)}</span>
                  <span style={{ color: '#64748b', fontSize: rankTotalFontSize, whiteSpace: 'nowrap' }}>of {formatNum(dev.cityTotal)}</span>
                </div>
                <div style={{ display: 'flex', color: '#ddd6fe', fontSize: '11', fontWeight: '700', letterSpacing: '1.2' }}>IN {dev.city.toUpperCase()}</div>
              </div>
            )}
          </div>}

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
                {score}
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

          {aiToolNames.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10',
                marginTop: '14',
                color: '#94a3b8',
                fontSize: '12',
                lineHeight: '1.4',
              }}
            >
              <div style={{ display: 'flex', flexShrink: '0', color: '#67e8f9', fontSize: '10', fontWeight: '800', letterSpacing: '1.4' }}>
                AI TOOLKIT
              </div>
              <div style={{ display: 'flex', flex: '1' }}>
                {aiToolNames.join('  ·  ')}
              </div>
            </div>
          )}

          {/* Language badge */}
          {dev.topLanguage && (
            <div
              style={{
                display: 'flex',
                marginTop: aiToolNames.length > 0 ? '10' : '20',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '18' }}>
            <div style={{ color: '#22d3ee', fontSize: '13', fontWeight: '700', display: 'flex' }}>
              #buildinpublic
            </div>
            <div style={{ color: '#475569', fontSize: '13', display: 'flex' }}>
              {getSiteHostname()}
            </div>
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
