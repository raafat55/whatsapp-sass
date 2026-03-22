import { Router } from 'express';
import { z } from 'zod';
import type { AppContainer } from '../../container.js';
import { sendOk, sendError } from '../../common/http.js';
import { asyncRoute } from '../async-route.js';
import { requireAuth, type AuthedRequest } from '../../middleware/auth.middleware.js';
import { Types } from 'mongoose';
import { AppError } from '../../common/errors.js';

const listQuery = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
  page: z.coerce.number().min(1).default(1),
});

export function contactsRouter(c: AppContainer): Router {
  const r = Router();
  r.use(requireAuth);

  r.post(
    '/:sessionId/sync',
    asyncRoute(async (req: AuthedRequest, res) => {
      try {
        const out = await c.contactsService.syncForSession(
          new Types.ObjectId(req.userId!),
          req.params.sessionId
        );
        sendOk(res, out);
      } catch (e) {
        sendError(res, e);
      }
    })
  );

  r.get(
    '/:sessionId',
    asyncRoute(async (req: AuthedRequest, res) => {
      try {
        const q = listQuery.parse(req.query);
        const { items, total } = await c.contactsService.list(
          new Types.ObjectId(req.userId!),
          req.params.sessionId,
          q
        );
        sendOk(res, {
          items: items.map((x) => ({
            id: x._id.toString(),
            phoneNumber: x.phoneNumber,
            name: x.name,
            isBusiness: x.isBusiness,
            lastSeen: x.lastSeen,
            createdAt: x.createdAt,
          })),
          total,
          page: q.page,
          limit: q.limit,
        });
      } catch (e) {
        sendError(res, e);
      }
    })
  );

  r.delete(
    '/:contactId',
    asyncRoute(async (req: AuthedRequest, res) => {
      try {
        if (!/^[a-f0-9]{24}$/i.test(req.params.contactId)) {
          return sendError(res, new AppError('INVALID_ID', 'Invalid contact id', 400));
        }
        await c.contactsService.deleteContact(new Types.ObjectId(req.userId!), req.params.contactId);
        sendOk(res, { ok: true });
      } catch (e) {
        sendError(res, e);
      }
    })
  );

  return r;
}
