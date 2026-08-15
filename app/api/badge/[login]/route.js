import { BADGE_STATS, DEFAULT_BADGE_STAT, renderBadgeSvg, resolveBadgeStat } from '../../../../lib/badge.js';
import { getBadgeDeveloper } from '../../../../lib/badge-lookup.js';

export const runtime = 'nodejs';

const LOGIN_PATTERN = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;

function svgResponse(svg, { cache = true } = {}) {
  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      // Badges are meant to be embedded (README, personal sites) and read on
      // every page view, so cache briefly at the edge instead of per-request.
      'Cache-Control': cache
        ? 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
        : 'no-store',
    },
  });
}

export async function GET(request, { params }) {
  const { login: rawLogin } = await params;
  const login = rawLogin.replace(/\.svg$/i, '');

  if (!LOGIN_PATTERN.test(login)) {
    return svgResponse(renderBadgeSvg({ value: 'invalid login', unranked: true }), { cache: false });
  }

  const { searchParams } = new URL(request.url);
  const statParam = searchParams.get('stat') || DEFAULT_BADGE_STAT;
  if (!BADGE_STATS.includes(statParam)) {
    return svgResponse(renderBadgeSvg({ value: 'invalid stat', unranked: true }), { cache: false });
  }

  try {
    const developer = await getBadgeDeveloper(login);
    const { value, unranked } = resolveBadgeStat(developer, statParam);
    return svgResponse(renderBadgeSvg({ value, unranked }));
  } catch (error) {
    console.error('Badge render failed:', error.message);
    // Degrade to an "unranked" badge rather than a broken image in READMEs.
    return svgResponse(renderBadgeSvg({ value: 'unavailable', unranked: true }), { cache: false });
  }
}
