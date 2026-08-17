import fs from 'node:fs/promises';
import path from 'node:path';

const outputDirectory = path.resolve('docs-site/.vitepress/dist');
const requiredFiles = [
  'index.html',
  '404.html',
  'sitemap.xml',
  'guide/overview.html',
  'agents/mcp.html',
  'agents/skills.html',
  'agents/readiness.html',
  'reference/api.html',
];

await Promise.all(requiredFiles.map(async relativePath => {
  await fs.access(path.join(outputDirectory, relativePath));
}));

const html = await fs.readFile(path.join(outputDirectory, 'index.html'), 'utf8');
if (!html.includes('/devglobe/assets/') || !html.includes('/devglobe/devglobe.png')) {
  throw new Error('Documentation output is not using the /devglobe/ GitHub Pages base path.');
}

const sitemap = await fs.readFile(path.join(outputDirectory, 'sitemap.xml'), 'utf8');
if (!sitemap.includes('https://sajeetharan.github.io/devglobe/')) {
  throw new Error('Documentation sitemap does not use the GitHub Pages canonical URL.');
}

console.log(`Verified ${requiredFiles.length} documentation outputs and GitHub Pages base paths.`);