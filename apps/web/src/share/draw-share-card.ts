/**
 * The 9:16 share card (1080×1920) for a Story: the temple yard, the mascot, and only positive achievements (best
 * combo, peaceful days, times held back when above zero). Never any check-in content. Colours are read from the
 * design tokens at draw time, and the Vietnamese font is loaded before drawing so diacritics render correctly.
 */

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;

export interface ShareCardContent {
  readonly appName: string;
  readonly host: string;
  readonly tagline: string;
  readonly stats: readonly { readonly label: string; readonly value: number }[];
}

const FONT_FAMILY = '"Be Vietnam Pro", system-ui, sans-serif';

/** A design token's value from the page (tokens.css), so the card follows the same palette. */
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Image ${src} failed to load`));
    image.src = src;
  });
}

/** Loads the weights the card uses, with Vietnamese sample text so the Vietnamese subset is fetched too. */
async function loadFonts(sample: string): Promise<void> {
  if (!('fonts' in document)) return;
  await Promise.all(['800 96px', '600 48px'].map((spec) => document.fonts.load(`${spec} ${FONT_FAMILY}`, sample)));
}

/** Draws `image` to cover the whole card, cropping the overflow, like CSS `background-size: cover`. */
function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement): void {
  const scale = Math.max(CARD_WIDTH / image.width, CARD_HEIGHT / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  ctx.drawImage(image, (CARD_WIDTH - w) / 2, (CARD_HEIGHT - h) / 2, w, h);
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export async function drawShareCard(content: ShareCardContent): Promise<HTMLCanvasElement> {
  const sample = [content.appName, content.tagline, ...content.stats.map((s) => s.label)].join(' ');
  const [background, mascot] = await Promise.all([loadImage('/art/bg-courtyard.webp'), loadImage('/art/sticker-mophat.webp'), loadFonts(sample)]);

  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');

  drawCover(ctx, background);
  // Darken the lower half so the text reads over any part of the picture.
  const shade = ctx.createLinearGradient(0, CARD_HEIGHT * 0.35, 0, CARD_HEIGHT);
  shade.addColorStop(0, token('--c-card-shade-top'));
  shade.addColorStop(1, token('--c-card-shade-bottom'));
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.textAlign = 'center';
  ctx.fillStyle = token('--c-text');
  ctx.shadowColor = token('--c-drop-shadow');
  ctx.shadowBlur = 24;
  ctx.font = `800 104px ${FONT_FAMILY}`;
  ctx.fillText(content.appName, CARD_WIDTH / 2, 230);
  ctx.font = `600 46px ${FONT_FAMILY}`;
  ctx.fillStyle = token('--c-primary');
  ctx.fillText(content.tagline, CARD_WIDTH / 2, 310);

  // The mascot as a sticker on a soft white disc.
  ctx.shadowBlur = 40;
  ctx.fillStyle = token('--c-sticker-backing');
  ctx.beginPath();
  ctx.arc(CARD_WIDTH / 2, 780, 330, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.drawImage(mascot, CARD_WIDTH / 2 - 300, 480, 600, 600);

  // One panel per achievement.
  const panelW = 860;
  const panelH = 190;
  content.stats.forEach((stat, index) => {
    const x = (CARD_WIDTH - panelW) / 2;
    const y = 1200 + index * (panelH + 36);
    ctx.fillStyle = token('--c-card-panel');
    roundedRect(ctx, x, y, panelW, panelH, 48);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = token('--c-text-muted');
    ctx.font = `600 46px ${FONT_FAMILY}`;
    ctx.fillText(stat.label, x + 56, y + panelH / 2 + 16);
    ctx.textAlign = 'right';
    ctx.fillStyle = token('--c-primary');
    ctx.font = `800 96px ${FONT_FAMILY}`;
    ctx.fillText(String(stat.value), x + panelW - 56, y + panelH / 2 + 34);
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = token('--c-text');
  ctx.font = `600 40px ${FONT_FAMILY}`;
  ctx.fillText(content.host, CARD_WIDTH / 2, CARD_HEIGHT - 110);
  return canvas;
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))), 'image/png');
  });
}

/** Saves `blob` as a download (the fallback when the browser cannot share files). */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
