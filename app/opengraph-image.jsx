import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'DevGlobe — Where Developers and AI Agents Connect';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #071018 0%, #0f1d28 55%, #17130f 100%)',
          color: '#f8fafc',
          fontFamily: 'sans-serif',
          padding: '72px 84px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: '-10px',
            top: '48px',
            width: '500px',
            height: '500px',
            display: 'flex',
            border: '3px solid rgba(34, 211, 238, 0.34)',
            borderRadius: '50%',
            boxShadow: '0 0 90px rgba(34, 211, 238, 0.14)',
          }}
        >
          <div style={{ position: 'absolute', left: '78px', top: '0', width: '340px', height: '494px', display: 'flex', border: '2px solid rgba(34, 211, 238, 0.2)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', left: '0', top: '174px', width: '494px', height: '150px', display: 'flex', border: '2px solid rgba(34, 211, 238, 0.2)', borderRadius: '50%' }} />
          {[
            ['92px', '110px', '#22d3ee'],
            ['320px', '90px', '#f59e0b'],
            ['250px', '250px', '#4ade80'],
            ['105px', '325px', '#60a5fa'],
            ['360px', '350px', '#fb7185'],
          ].map(([left, top, color]) => (
            <div key={`${left}-${top}`} style={{ position: 'absolute', left, top, width: '16px', height: '16px', display: 'flex', borderRadius: '50%', background: color, boxShadow: `0 0 22px ${color}` }} />
          ))}
        </div>

        <div style={{ width: '650px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '34px' }}>
            <div style={{ width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #22d3ee', borderRadius: '50%', color: '#67e8f9', fontSize: '25px', fontWeight: '800' }}>D</div>
            <div style={{ display: 'flex', fontSize: '28px', fontWeight: '800', letterSpacing: '1px' }}>DEV<span style={{ color: '#22d3ee' }}>GLOBE</span></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: '58px', fontWeight: '800', lineHeight: '1.05' }}>
            <span>Where Developers</span>
            <span style={{ display: 'flex', gap: '14px' }}><span>and AI Agents</span><span style={{ color: '#67e8f9' }}>Connect</span></span>
          </div>
          <div style={{ display: 'flex', marginTop: '28px', color: '#94a3b8', fontSize: '22px' }}>
            Discover expertise, impact, and collaborators worldwide.
          </div>
          <div style={{ display: 'flex', gap: '28px', marginTop: '46px', color: '#cbd5e1', fontSize: '16px', fontWeight: '700' }}>
            <span>26,000+ DEVELOPERS</span>
            <span style={{ color: '#475569' }}>•</span>
            <span>150+ COUNTRIES</span>
          </div>
        </div>
      </div>
    ),
    size
  );
}