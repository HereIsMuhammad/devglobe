const DEFAULT_SITE_URL = 'https://devglobe.dev';

export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
}

export function getSiteHostname() {
  return new URL(getSiteUrl()).hostname;
}