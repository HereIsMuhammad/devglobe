export default function manifest() {
  return {
    name: 'DevGlobe — Developer Discovery Platform',
    short_name: 'DevGlobe',
    description: 'Discover and compare open-source developers by expertise, location, language, rankings, and contributions.',
    start_url: '/',
    display: 'standalone',
    background_color: '#080b10',
    theme_color: '#080b10',
    categories: ['developer tools', 'social', 'productivity'],
    icons: [
      {
        src: '/devglobe.png',
        sizes: 'any',
        type: 'image/png',
      },
    ],
  };
}