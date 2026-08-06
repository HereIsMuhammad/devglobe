export default function manifest() {
  return {
    name: 'DevGlobe — Where Developers and AI Agents Connect',
    short_name: 'DevGlobe',
    description: 'Discover developer identities, expertise, rankings, and connections worldwide.',
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