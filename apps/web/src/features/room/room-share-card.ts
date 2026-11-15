/**
 * The 9:16 card a room gets when its incense burns out, drawn with the shared card steps (share/draw-share-card.ts):
 * the yard behind, the app's name and "cleansed together" on top, the room's name and theme, then how many people
 * and sticks. Only those: never a wish, never a member's name.
 */
import {
  CARD_WIDTH,
  type ShareCardContent,
  cardFontSample,
  createCardCanvas,
  drawCardBackdrop,
  drawCardHeader,
  drawCardStats,
  loadFonts,
  loadImage,
} from '../../share/draw-share-card';

export interface RoomCardContent extends ShareCardContent {
  readonly roomName: string;
  readonly themeLabel: string;
}

const FONT_FAMILY = '"Be Vietnam Pro", system-ui, sans-serif';
const NAME_MAX_WIDTH = CARD_WIDTH - 160;

const token = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** The largest weight-800 size (from `start` down) at which `text` fits the card's width. */
function fittedFont(ctx: CanvasRenderingContext2D, text: string, start: number): string {
  for (let size = start; size > 40; size -= 6) {
    ctx.font = `800 ${size}px ${FONT_FAMILY}`;
    if (ctx.measureText(text).width <= NAME_MAX_WIDTH) return ctx.font;
  }
  return `800 40px ${FONT_FAMILY}`;
}

export async function drawRoomShareCard(content: RoomCardContent): Promise<HTMLCanvasElement> {
  const sample = `${cardFontSample(content)} ${content.roomName} ${content.themeLabel}`;
  const [background] = await Promise.all([loadImage('/art/bg-courtyard.webp'), loadFonts(sample)]);
  const { canvas, ctx } = createCardCanvas();
  drawCardBackdrop(ctx, background);
  drawCardHeader(ctx, content);

  ctx.textAlign = 'center';
  ctx.fillStyle = token('--c-text');
  ctx.font = fittedFont(ctx, content.roomName, 96);
  ctx.fillText(content.roomName, CARD_WIDTH / 2, 760);
  ctx.fillStyle = token('--c-primary');
  ctx.font = `600 52px ${FONT_FAMILY}`;
  ctx.fillText(content.themeLabel, CARD_WIDTH / 2, 850);

  ctx.shadowBlur = 0;
  drawCardStats(ctx, content);
  return canvas;
}
