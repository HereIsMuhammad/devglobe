import { ImageResponse } from '@vercel/og';
import { CosmosClient } from '@azure/cosmos';
import { promises as fs } from 'fs';
import path from 'path';
import { classifyAgent, getPowerTier } from '../../../lib/agent-class.js';
import { scoreAll } from '../../../lib/scoring.js';

export const runtime = 'nodejs';

const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT;
const COSMOS_KEY = process.env.COSMOS_KEY;
const DATABASE = process.env.COSMOS_DATABASE || 'devglobe';
const CONTAINER = process.env.COSMOS_CONTAINER || 'developers';

async function getDeveloper(login) {
  if (COSMOS_ENDPOINT && COSMOS_KEY) {
    try {
      const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
      const container = client.database(DATABASE).container(CONTAINER);
      const { resources } = await container.items.query({
        query: 'SELECT * FROM c WHERE c.login = @login',
        parameters: [{ name: '@login', value: login }],
      }).fetchAll();
      if (resources.length > 0) {
        const scored = scoreAll(resources);
        return scored[0];
      }
    } catch (err) {
      console.error('Card: Cosmos error', err.message);
    }
  }

  const filePath = path.join(process.cwd(), 'data', 'developers-sample.json');
  const raw = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(raw);
  const scored = scoreAll(data);
  return scored.find(d => d.login === login) || null;
}

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
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

  const agent = classifyAgent(dev);
  const power = getPowerTier(dev.score || 0);

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200',
          height: '630',
          display: 'flex',
          background: 'linear-gradient(135deg, #0a0e17 0%, #111827 40%, #0f172a 100%)',
          fontFamily: 'Inter, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
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
            padding: '40',
          }}
        >
          {/* Agent icon */}
          <div
            style={{
              fontSize: '48',
              marginBottom: '12',
              display: 'flex',
            }}
          >
            {agent.icon}
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
            <img
              src={dev.avatarUrl}
              width="180"
              height="180"
              style={{ borderRadius: '50%', objectFit: 'cover' }}
            />
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
              📍 {dev.location}
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
            padding: '40px 60px 40px 20px',
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

          {/* Score + Tier */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16',
              marginBottom: '28',
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
                  fontSize: '64',
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
              gap: '20',
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
                  borderRadius: '10',
                  padding: '12px 20px',
                  minWidth: '130',
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
                    fontSize: '24',
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
                  ✓ Verified
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
            🌐 DevGlobe
          </div>
          <div
            style={{
              color: '#475569',
              fontSize: '13',
              display: 'flex',
            }}
          >
            dev-globe-viz.vercel.app
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
    }
  );
}
