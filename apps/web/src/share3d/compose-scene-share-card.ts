/**
 * The 3D game's share card: the picture taken from the scene (the character at the wooden fish in the diorama) with
 * the same title and stat panels as the 2D card, drawn by the shared steps in draw-share-card.ts (Be Vietnam Pro
 * loaded first, so every diacritic draws). Only positive stats; never any check-in content.
 */
import {
  type ShareCardContent,
  cardFontSample,
  createCardCanvas,
  drawCardBackdrop,
  drawCardHeader,
  drawCardStats,
  loadFonts,
  loadImage,
} from '../share/draw-share-card';

/** The stat panels start a little lower than on the 2D card, leaving the character's whole figure in view. */
const STATS_TOP = 1330;

export async function composeSceneShareCard(sceneShot: string, content: ShareCardContent): Promise<HTMLCanvasElement> {
  const [scene] = await Promise.all([loadImage(sceneShot), loadFonts(cardFontSample(content))]);
  const { canvas, ctx } = createCardCanvas();
  drawCardBackdrop(ctx, scene);
  drawCardHeader(ctx, content);
  ctx.shadowBlur = 0;
  drawCardStats(ctx, content, STATS_TOP);
  return canvas;
}
