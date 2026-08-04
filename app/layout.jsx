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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
