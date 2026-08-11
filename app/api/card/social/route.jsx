import { ImageResponse } from '@vercel/og';
import { promises as fs } from 'fs';
import path from 'path';
import { getCosmosContainer } from '../../../../lib/cosmos.js';

export const runtime = 'nodejs';

async function getDeveloper(login) {
  const cosmosContainer = getCosmosContainer();
  if (cosmosContainer) {
    try {
      const { resources } = await cosmosContainer.items.query({
        query: `SELECT TOP 1 c.login, c.name, c.location, c.followers, c.totalStars, c.totalCommits, c.topLanguage
          FROM c
          WHERE (c.login = @login OR c.id = @login)
            AND (NOT IS_DEFINED(c.nomination) OR c.nomination.status = 'approved')`,
        parameters: [{ name: '@login', value: login }],
      }).fetchAll();
      if (resources[0]) return resources[0];
    } catch (error) {
      console.error('Social card: Cosmos error', error.message);
    }
  }

  const filePath = path.join(process.cwd(), 'data', 'developers-sample.json');
  const developers = JSON.parse(await fs.readFile(filePath, 'utf-8'));
  return developers.find(developer =>
    developer.login?.toLowerCase() === login.toLowerCase() || developer.id === login
  ) || null;
}

function formatNumber(value) {
  const number = Number(value) || 0;
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;
  return String(number);
}

export async function GET(request) {
  const login = new URL(request.url).searchParams.get('login');
  if (!login) return new Response('Missing login parameter', { status: 400 });

  const developer = await getDeveloper(login);
  if (!developer) return new Response('Developer not found', { status: 404 });

  const name = developer.name || developer.login;
  const stats = [
    { label: 'GITHUB STARS', value: formatNumber(developer.totalStars) },
    { label: 'COMMITS', value: formatNumber(developer.totalCommits) },
    { label: 'FOLLOWERS', value: formatNumber(developer.followers) },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200',
          height: '630',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '58px 68px',
          background: '#0a0f18',
          color: '#f8fafc',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: '0', display: 'flex', border: '12px solid #111c2c' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '24', fontWeight: '800' }}>
            <div style={{ width: '14', height: '14', display: 'flex', borderRadius: '50%', background: '#22d3ee' }} />
            DEVGLOBE
          </div>
          <div style={{ display: 'flex', color: '#94a3b8', fontSize: '18' }}>OPEN SOURCE DEVELOPER</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '980px' }}>
          <div style={{ display: 'flex', color: '#22d3ee', fontSize: '24', fontWeight: '700', marginBottom: '10px' }}>
            @{developer.login}
          </div>
          <div style={{ display: 'flex', fontSize: '64', fontWeight: '800', lineHeight: '1.05' }}>{name}</div>
          <div style={{ display: 'flex', color: '#94a3b8', fontSize: '24', marginTop: '16px' }}>
            {[developer.topLanguage, developer.location].filter(Boolean).join(' / ') || 'Developer on DevGlobe'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '52px' }}>
            {stats.map(stat => (
              <div key={stat.label} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ display: 'flex', color: '#f8fafc', fontSize: '34', fontWeight: '800' }}>{stat.value}</div>
                <div style={{ display: 'flex', color: '#64748b', fontSize: '14', fontWeight: '700' }}>{stat.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', color: '#fbbf24', fontSize: '18', fontWeight: '700' }}>EXPLORE ON DEVGLOBE</div>
        </div>
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