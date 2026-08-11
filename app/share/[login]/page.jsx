import Link from 'next/link';
import { getSiteUrl, SOCIAL_PREVIEW_VERSION } from '../../../lib/site.js';

export async function generateMetadata({ params }) {
  const { login } = await params;
  const siteUrl = getSiteUrl();
  const encodedLogin = encodeURIComponent(login);
  const title = `@${login}'s Developer Card | DevGlobe`;
  const description = `Explore @${login}'s open-source developer identity, global rank, and impact on DevGlobe.`;
  const pageUrl = `${siteUrl}/share/${encodedLogin}?v=${SOCIAL_PREVIEW_VERSION}`;
  const canonicalUrl = `${siteUrl}/share/${encodedLogin}`;
  const imageUrl = `${siteUrl}/api/card?login=${encodedLogin}&v=${SOCIAL_PREVIEW_VERSION}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: 'DevGlobe',
      type: 'profile',
      images: [{ url: imageUrl, width: 1200, height: 630, type: 'image/png', alt: `DevGlobe developer card for @${login}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ url: imageUrl, alt: `DevGlobe developer card for @${login}` }],
    },
  };
}

export default async function DeveloperSharePage({ params }) {
  const { login } = await params;
  const encodedLogin = encodeURIComponent(login);
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/share/${encodedLogin}`;
  const profileDescription = `Explore @${login}'s open-source developer identity, global rank, country rank, and public contribution impact on DevGlobe.`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': `${pageUrl}#profile`,
    url: pageUrl,
    name: `@${login}'s Developer Profile | DevGlobe`,
    description: profileDescription,
    isPartOf: { '@id': `${siteUrl}/#website` },
    mainEntity: {
      '@type': 'Person',
      identifier: login,
      name: `@${login}`,
      url: pageUrl,
      sameAs: [`https://github.com/${encodedLogin}`],
    },
  };

  return (
    <main className="share-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <div className="share-page__content">
        <div className="share-page__brand">
          <img src="/devglobe.png" alt="" />
          <span>DevGlobe</span>
        </div>
        <header className="share-page__intro">
          <h1>@{login}&apos;s developer profile</h1>
          <p>{profileDescription}</p>
        </header>
        <img
          className="share-page__card"
          src={`/api/card?login=${encodedLogin}&v=${SOCIAL_PREVIEW_VERSION}`}
          alt={`Developer card for @${login}`}
        />
        <div className="share-page__actions">
          <Link href={`/?dev=${encodedLogin}`}>Explore @{login} on DevGlobe</Link>
          <Link className="share-page__home" href="/">Open the globe</Link>
        </div>
      </div>
    </main>
  );
}