import { GET as renderCard } from '../../../card/route.jsx';

export const runtime = 'nodejs';

export async function GET(request, { params }) {
  const { version, login: rawLogin } = await params;
  const login = rawLogin.replace(/\.png$/i, '');
  console.info('social-preview-image', {
    version,
    login,
    userAgent: request.headers.get('user-agent') || 'unknown',
  });
  const cardUrl = new URL(request.url);
  cardUrl.pathname = '/api/card';
  cardUrl.search = '';
  cardUrl.searchParams.set('login', login);

  return renderCard(new Request(cardUrl, { headers: request.headers }));
}