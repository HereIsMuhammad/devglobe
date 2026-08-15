import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function GET() {
  const skill = await fs.readFile(
    path.join(process.cwd(), '.agents', 'skills', 'devglobe', 'SKILL.md'),
    'utf8',
  );
  return new Response(skill, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}