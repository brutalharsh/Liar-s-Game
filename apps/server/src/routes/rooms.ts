/**
 * /api/rooms — public room browser (STR/07 §0 "Game/store" REST).
 *
 * Reads the public_rooms mirror the RoomManager upserts on every room
 * change; its TTL index (600s) prunes rooms whose server died. Public
 * route — no auth, and only browser fields ever leave: no members, no
 * codes beyond the room code itself, no hidden state (STR/08 §1).
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { jsonError } from '../lib/api.js';
import { PublicRoom } from '../models/public-room.js';

const ListQuery = z.strictObject({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
});

export function createRoomsRouter(): Router {
  const router = Router();

  router.get('/rooms', async (req: Request, res: Response): Promise<void> => {
    const query = ListQuery.safeParse(req.query);
    if (!query.success) {
      jsonError(res, 400, 'VALIDATION');
      return;
    }
    const { page, perPage } = query.data;
    const filter = { visibility: 'public' };
    const [docs, total] = await Promise.all([
      PublicRoom.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .lean()
        .exec(),
      PublicRoom.countDocuments(filter).exec(),
    ]);
    const rooms = docs.map((doc) => ({
      roomCode: String(doc._id),
      name: doc.name,
      hostNickname: doc.hostNickname,
      theme: doc.theme,
      capacity: doc.capacity,
      seatsTaken: doc.seatsTaken,
      updatedAt: doc.updatedAt,
    }));
    res.json({ rooms, page, perPage, total });
  });

  return router;
}
