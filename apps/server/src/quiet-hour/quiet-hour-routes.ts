/**
 * "Giờ Tĩnh": GET /api/quiet-hour (public status) and POST /api/quiet-hour/beats (signed in, a small batch of strokes;
 * counted only while the half hour is on, up to the per-person cap). Answers `QuietHourStatus` either way.
 */
import { parseQuietHourBeatsInput, vietnamDay } from '@chuanho/contract';
import express, { type Router } from 'express';
import { signedInUserId } from '../auth/require-user';
import { HttpError } from '../http-error';
import type { RouteDeps } from '../route-module';
import { signedInLimit } from '../session-rate-limit';
import { beatsAcceptedNow, quietHourStatus } from './quiet-hour-rules';
import { addQuietHourStrokes, readQuietHourTotal } from './quiet-hour-store';

export function quietHourRoutes(deps: RouteDeps): Router {
  const { config, db, now } = deps;
  const router = express.Router();
  const guard = signedInLimit(deps, 5 * 60 * 1000, config.beatsLimitPer5Min);

  router.get('/api/quiet-hour', async (_req, res) => {
    const at = now().getTime();
    res.set('Cache-Control', 'no-store').json(quietHourStatus(at, await readQuietHourTotal(db, vietnamDay(at))));
  });

  router.post('/api/quiet-hour/beats', ...guard, express.json({ limit: '1kb' }), async (req, res) => {
    const input = parseQuietHourBeatsInput(req.body);
    if (!input) throw new HttpError(400, 'invalid-body');
    const at = now().getTime();
    if (!beatsAcceptedNow(input, at)) throw new HttpError(409, 'quiet-hour-closed');
    const total = await addQuietHourStrokes(db, signedInUserId(res), input.day, input.count);
    res.set('Cache-Control', 'no-store').json(quietHourStatus(at, total));
  });

  return router;
}
