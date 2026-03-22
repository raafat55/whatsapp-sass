import { Router } from 'express';
import { z } from 'zod';
import type { AppContainer } from '../../container.js';
import { sendOk, sendError } from '../../common/http.js';
import { asyncRoute } from '../async-route.js';
import { requireAuth, type AuthedRequest } from '../../middleware/auth.middleware.js';
import { Types } from 'mongoose';

const createSchema = z.object({ label: z.string().optional() });

const sendMessageSchema = z.object({
  to: z.string().min(5).max(64),
  text: z.string().min(1).max(4096),
});

const agentPutSchema = z.object({
  geminiApiKey: z.string().min(10).optional(),
  displayName: z.string().max(120).optional(),
  businessName: z.string().min(1).max(500),
  businessDescription: z.string().min(1).max(8000),
  languagePreference: z.string().min(2).max(32),
  toneOfVoice: z.string().min(2).max(80),
  extraInstructions: z.string().max(4000).optional(),
  modelName: z.string().min(3).max(80).optional(),
  enabled: z.boolean().optional(),
});

const agentPatchSchema = z
  .object({
    geminiApiKey: z.string().min(10).optional(),
    displayName: z.string().max(120).optional(),
    businessName: z.string().min(1).max(500).optional(),
    businessDescription: z.string().min(1).max(8000).optional(),
    languagePreference: z.string().min(2).max(32).optional(),
    toneOfVoice: z.string().min(2).max(80).optional(),
    extraInstructions: z.string().max(4000).optional(),
    modelName: z.string().min(3).max(80).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'At least one field is required' });

function mapSession(s: {
  publicId: string;
  status: string;
  phoneNumber?: string;
  label?: string;
  qrCode?: string;
  createdAt?: Date;
}) {
  return {
    sessionId: s.publicId,
    status: s.status,
    phoneNumber: s.phoneNumber,
    label: s.label,
    qrCode: s.qrCode,
    createdAt: s.createdAt,
  };
}

export function sessionsRouter(c: AppContainer): Router {
  const r = Router();
  r.use(requireAuth);

  r.post(
    '/',
    asyncRoute(async (req: AuthedRequest, res) => {
      try {
        const body = createSchema.parse(req.body);
        const s = await c.sessionsService.create(new Types.ObjectId(req.userId!), body.label);
        sendOk(res, mapSession(s), 201);
      } catch (e) {
        sendError(res, e);
      }
    })
  );

  r.get(
    '/',
    asyncRoute(async (req: AuthedRequest, res) => {
      try {
        const list = await c.sessionsService.list(new Types.ObjectId(req.userId!));
        sendOk(res, list.map(mapSession));
      } catch (e) {
        sendError(res, e);
      }
    })
  );

  r.get(
    '/:publicId/ai-agent',
    asyncRoute(async (req: AuthedRequest, res) => {
      try {
        const out = await c.aiAgentsService.getForSession(
          new Types.ObjectId(req.userId!),
          req.params.publicId
        );
        sendOk(res, out);
      } catch (e) {
        sendError(res, e);
      }
    })
  );

  r.put(
    '/:publicId/ai-agent',
    asyncRoute(async (req: AuthedRequest, res) => {
      try {
        const body = agentPutSchema.parse(req.body);
        const out = await c.aiAgentsService.upsertForSession(
          new Types.ObjectId(req.userId!),
          req.params.publicId,
          body
        );
        sendOk(res, out);
      } catch (e) {
        sendError(res, e);
      }
    })
  );

  r.patch(
    '/:publicId/ai-agent',
    asyncRoute(async (req: AuthedRequest, res) => {
      try {
        const body = agentPatchSchema.parse(req.body);
        const out = await c.aiAgentsService.patchForSession(
          new Types.ObjectId(req.userId!),
          req.params.publicId,
          body
        );
        sendOk(res, out);
      } catch (e) {
        sendError(res, e);
      }
    })
  );

  r.delete(
    '/:publicId/ai-agent',
    asyncRoute(async (req: AuthedRequest, res) => {
      try {
        await c.aiAgentsService.deleteForSession(
          new Types.ObjectId(req.userId!),
          req.params.publicId
        );
        sendOk(res, { ok: true });
      } catch (e) {
        sendError(res, e);
      }
    })
  );

  r.post(
    '/:publicId/send',
    asyncRoute(async (req: AuthedRequest, res) => {
      try {
        const body = sendMessageSchema.parse(req.body);
        await c.sessionsService.sendMessage(
          new Types.ObjectId(req.userId!),
          req.params.publicId,
          body.to,
          body.text
        );
        sendOk(res, { ok: true });
      } catch (e) {
        sendError(res, e);
      }
    })
  );

  r.get(
    '/:publicId',
    asyncRoute(async (req: AuthedRequest, res) => {
      try {
        const s = await c.sessionsService.get(new Types.ObjectId(req.userId!), req.params.publicId);
        sendOk(res, mapSession(s));
      } catch (e) {
        sendError(res, e);
      }
    })
  );

  r.post(
    '/:publicId/start',
    asyncRoute(async (req: AuthedRequest, res) => {
      try {
        const result = await c.sessionsService.start(new Types.ObjectId(req.userId!), req.params.publicId);
        const s = await c.sessionsService.get(new Types.ObjectId(req.userId!), req.params.publicId);
        sendOk(res, {
          session: mapSession(s),
          qrCode: result.qrCode,
        });
      } catch (e) {
        sendError(res, e);
      }
    })
  );

  r.post(
    '/:publicId/stop',
    asyncRoute(async (req: AuthedRequest, res) => {
      try {
        await c.sessionsService.stop(new Types.ObjectId(req.userId!), req.params.publicId);
        sendOk(res, { ok: true });
      } catch (e) {
        sendError(res, e);
      }
    })
  );

  r.delete(
    '/:publicId',
    asyncRoute(async (req: AuthedRequest, res) => {
      try {
        await c.sessionsService.delete(new Types.ObjectId(req.userId!), req.params.publicId);
        sendOk(res, { ok: true });
      } catch (e) {
        sendError(res, e);
      }
    })
  );

  return r;
}
