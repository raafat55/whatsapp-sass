import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { Express, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { logger } from '../common/logger.js';

function loadOpenApiSpec(): object | null {
  const path = join(process.cwd(), 'docs', 'openapi.json');
  if (!existsSync(path)) {
    logger.warn({ path }, 'OpenAPI spec not found; Swagger disabled');
    return null;
  }
  return JSON.parse(readFileSync(path, 'utf-8')) as object;
}

/** Relative URL Swagger UI fetches on each page load (always up to date; no stale embedded spec). */
const OPENAPI_RELATIVE_URL = '/api/openapi.json';

export function setupSwagger(app: Express): void {
  if (!loadOpenApiSpec()) return;

  app.get('/api/openapi.json', (_req: Request, res: Response) => {
    const spec = loadOpenApiSpec();
    if (!spec) {
      res.status(503).json({ success: false, error: { code: 'OPENAPI_MISSING', message: 'OpenAPI spec not found' } });
      return;
    }
    res.json(spec);
  });

  const options = {
    customSiteTitle: 'WhatsApp AI SaaS API',
    swaggerOptions: {
      url: OPENAPI_RELATIVE_URL,
      persistAuthorization: true,
      docExpansion: 'list' as const,
      filter: true,
      tryItOutEnabled: true,
      displayRequestDuration: true,
    },
  };

  app.use('/api/docs', ...swaggerUi.serve, swaggerUi.setup(undefined, options));
}
