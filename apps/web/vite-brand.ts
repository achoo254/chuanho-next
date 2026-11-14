/*
 * Brand assets of the web app, derived from brand.config.json through @achoo254/brand:
 *
 * - index.html: %APP_NAME% filled in, plus description, theme colour, link-preview (og:) tags and the manifest;
 * - the SVG favicon (brand/app-icon.svg) and the web manifest at the site root, served in dev and emitted in builds.
 *
 * The raster icons, favicon.ico and the link-preview image come once the AI-drawn master icon exists.
 */
import { readFileSync } from 'node:fs';
import { type BrandConfigWith, type GenerateManifestsOptions, generateManifests, loadBrandConfig } from '@achoo254/brand/build';
import { primaryOrigin } from '@achoo254/brand/hosts';
import type { Plugin } from 'vite';

/** The repository root: brand.config.json and the icon paths inside it are relative to it. */
export const BRAND_ROOT = new URL('../../', import.meta.url);

const FAVICON_SVG = 'favicon.svg';
const MANIFEST_PATH = 'manifest.webmanifest';
const SVG_FAVICON_LINK = `<link rel="icon" type="image/svg+xml" href="/${FAVICON_SVG}" />`;
const BRAND_REQUIRE = ['colors.primary', 'colors.backgroundDark', 'webInstall'] as const;

export type ChuanhoBrand = BrandConfigWith<(typeof BRAND_REQUIRE)[number]>;

export function loadChuanhoBrand(): ChuanhoBrand {
  return loadBrandConfig(BRAND_ROOT, { require: BRAND_REQUIRE });
}

export const MANIFEST_OPTIONS: GenerateManifestsOptions = {
  web: {
    id: '/',
    lang: 'vi',
    dir: 'ltr',
    themeColor: 'background',
    categories: ['entertainment', 'lifestyle'],
    preferRelatedApplications: false,
    // Only the SVG icon exists until the raster icons are generated from the AI-drawn master; listing PNGs
    // here (as svgManifestIcons does) would point the manifest at files that 404.
    icons: [{ src: `/${FAVICON_SVG}`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  },
  capacitor: false,
};

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeHtml = (value: string): string => value.replace(/[&<>"]/g, (char) => HTML_ESCAPES[char] ?? char);

const CONTENT_TYPES: Record<string, string> = {
  [FAVICON_SVG]: 'image/svg+xml',
  [MANIFEST_PATH]: 'application/manifest+json',
};

/** URL path (no leading slash) → contents of everything served at the site root; read on use. */
export function brandFiles(brand: ChuanhoBrand): ReadonlyMap<string, () => Buffer | string> {
  const manifest = `${JSON.stringify(generateManifests(brand, MANIFEST_OPTIONS)['web.webmanifest.json'])}\n`;
  const icon = new URL(brand.icon, BRAND_ROOT);
  return new Map<string, () => Buffer | string>([
    [FAVICON_SVG, () => readFileSync(icon)],
    [MANIFEST_PATH, () => manifest],
  ]);
}

/** index.html with the brand name filled in and the brand head tags added. */
export function renderIndexHtml(html: string, brand: ChuanhoBrand): string {
  if (!html.includes(SVG_FAVICON_LINK)) throw new Error(`brand: index.html must contain ${SVG_FAVICON_LINK}`);
  const origin = primaryOrigin(brand);
  const description = escapeHtml(brand.description);
  const tags = [
    `<meta name="description" content="${description}" />`,
    `<meta name="theme-color" content="${escapeHtml(brand.colors.backgroundDark)}" />`,
    `<link rel="canonical" href="${origin}/" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(brand.appName)}" />`,
    `<meta property="og:title" content="${escapeHtml(brand.appName)}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${origin}/" />`,
    `<meta property="og:locale" content="vi_VN" />`,
    `<link rel="manifest" href="/${MANIFEST_PATH}" />`,
    `<meta name="apple-mobile-web-app-title" content="${escapeHtml(brand.shortName)}" />`,
  ];
  return html.replaceAll('%APP_NAME%', escapeHtml(brand.appName)).replace(SVG_FAVICON_LINK, [...tags, SVG_FAVICON_LINK].join('\n    '));
}

export function brandAssets(): Plugin {
  const brand = loadChuanhoBrand();
  const files = brandFiles(brand);
  return {
    name: 'chuanho-brand-assets',
    transformIndexHtml: { order: 'pre', handler: (html) => renderIndexHtml(html, brand) },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0]?.slice(1) ?? '';
        const read = files.get(path);
        if (read === undefined) {
          next();
          return;
        }
        try {
          res.setHeader('Content-Type', CONTENT_TYPES[path] ?? 'application/octet-stream');
          res.end(read());
        } catch (err) {
          next(err);
        }
      });
    },
    generateBundle() {
      for (const [fileName, read] of files) this.emitFile({ type: 'asset', fileName, source: read() });
    },
  };
}
