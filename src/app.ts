import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { IncomingMessage } from 'http';
import type { AppContainer } from './container.js';
import { logger } from './common/logger.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { setupSwagger } from './http/swagger-setup.js';
import { authRouter } from './http/routes/auth.routes.js';
import { sessionsRouter } from './http/routes/sessions.routes.js';
import { contactsRouter } from './http/routes/contacts.routes.js';
import { aiAgentsRouter } from './http/routes/ai-agents.routes.js';

const isProduction = process.env.NODE_ENV === 'production';

export function createApp(container: AppContainer): express.Application {
  const app = express();

  // Trust proxy headers (important for Render.com)
  app.set('trust proxy', 1);

  // Helmet security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  // CORS configuration - production safe
  const corsOptions = {
    origin: isProduction 
      ? process.env.CORS_ORIGIN?.split(',') || '*'  // Configure via env variable
      : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400, // 24 hours
  };
  
  app.use(cors(corsOptions));

  // Body parsing
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ limit: '2mb', extended: true }));

  // Request timeout (30 seconds)
  app.use((req, res, next) => {
    req.setTimeout(30000);
    res.setTimeout(30000);
    next();
  });

  // HTTP logging with Pino
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req: IncomingMessage) => {
          const u = req.url ?? '';
          return (
            u === '/health' ||
            u === '/' ||
            u.startsWith('/api/docs') ||
            u === '/api/openapi.json'
          );
        },
      },
    })
  );

  // Health check endpoint (used by Render.com)
  app.get('/health', (_req, res) =>
    res.json({ ok: true, timestamp: new Date().toISOString() })
  );

  // Root endpoint
  app.get('/', (_req, res) =>
    res.json({
      ok: true,
      name: 'whatsapp-ai-saas-backend',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      health: '/health',
      api: '/api',
      swagger: '/api/docs',
      openapi: '/api/openapi.json',
    })
  );

  // Swagger documentation
  setupSwagger(app);

  // API routes
  app.use('/api/auth', authRouter(container));
  app.use('/api/sessions', sessionsRouter(container));
  app.use('/api/contacts', contactsRouter(container));
  app.use('/api/ai-agents', aiAgentsRouter(container));

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
      },
    });
  });

  // Global error handler
  app.use(errorMiddleware);

  return app;
}

