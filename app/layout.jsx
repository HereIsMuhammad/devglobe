import { Analytics } from '@vercel/analytics/react';
import '../styles/main.css';

export const metadata = {
  title: 'DevGlobe — Visualizing the World\'s Top Open-Source Contributors',
  description: 'Interactive 3D globe visualization of top GitHub developers. 26,000+ developers ranked by stars, commits, repo reach & StackOverflow reputation.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/devglobe.png" type="image/png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <script
          // Runs before paint to avoid a flash of the wrong theme on load.
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var stored = localStorage.getItem('devglobe-theme');
                  var theme = stored === 'light' || stored === 'dark'
                    ? stored
                    : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
                  if (theme === 'light') {
                    document.documentElement.setAttribute('data-theme', 'light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}