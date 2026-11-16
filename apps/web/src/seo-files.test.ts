// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * robots.txt and sitemap.xml sit in public/ so nginx serves them as files. Without them both addresses fell back to
 * the game page, and Google had no sitemap to read: the site was unknown to Search Console.
 */
const publicFile = (name: string): string => readFileSync(fileURLToPath(new URL(`../public/${name}`, import.meta.url)), 'utf8');
const ORIGIN = 'https://chuanho.hoandat.com';

describe('robots.txt and sitemap.xml', () => {
  it('lets crawlers in, keeps them out of the API and sign-in, and points at the sitemap', () => {
    const robots = publicFile('robots.txt');
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Disallow: /api/');
    expect(robots).toContain('Disallow: /auth/');
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });

  it('lists the one page of the game, at its canonical address', () => {
    const locs = [...publicFile('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    expect(locs).toEqual([`${ORIGIN}/`]);
  });
});
