import { GET as renderCard } from '../../../card/route.jsx';

export const runtime = 'nodejs';

export async function GET(request, { params }) {
  const { login } = await params;
  const cardUrl = new URL(request.url);
  cardUrl.pathname = '/api/card';
  cardUrl.search = '';
  cardUrl.searchParams.set('login', login);

  return renderCard(new Request(cardUrl, { headers: request.headers }));
}