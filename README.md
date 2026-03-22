# WhatsApp AI SaaS Backend

Production-oriented, multi-tenant backend: **Node.js**, **TypeScript**, **Baileys**, **MongoDB**, **Google Gemini**, **JWT** auth, **Pino** logging. AI replies use an **in-process** queue (`p-queue`); **no Redis** required.

> **Security:** Never commit real credentials. If a database password was shared in chat or tickets, rotate it in MongoDB Atlas and update your local `.env` only.

## Prerequisites

- Node.js 20+
- MongoDB Atlas (or self-hosted) — URI in `MONGO_URI`

## Setup

1. Copy `.env.example` to `.env` and fill values (see below).
2. `npm install`
3. `npm run build`
4. `npm start` — HTTP API; AI work runs in the same Node process.

### Swagger UI (try endpoints in the browser)

With the server running, open **[http://localhost:3000/api/docs](http://localhost:3000/api/docs)**.

1. Call **POST /api/auth/register** or **login** and copy `data.token`.
2. Click **Authorize**, paste the token (Swagger adds the `Bearer` prefix).
3. Use **Try it out** on any protected route.

Raw OpenAPI JSON: `GET /api/openapi.json`

### Test all endpoints (smoke test)

With the server running on port 3000:

```bash
npm run test:api
```

This registers a throwaway user (or set `SKIP_REGISTER=1` with `TEST_EMAIL` / `TEST_PASSWORD`), calls every route in order, prints ✓/✗ per step, and exits with code 1 if something fails. Override base URL with `API_BASE_URL=http://localhost:3000`.

### Environment variables

| Variable                  | Description                                                         |
| ------------------------- | ------------------------------------------------------------------- |
| `MONGO_URI`               | MongoDB connection string                                           |
| `PORT`                    | HTTP port (default 3000)                                            |
| `JWT_SECRET`              | Min 16 characters                                                   |
| `ENCRYPTION_KEY`          | 64 hex chars (32 bytes) for AES-256-GCM storage of user Gemini keys |
| `AI_REPLY_MAX_PER_MINUTE` | Per-session AI reply cap                                            |
| `AI_MEMORY_MAX_MESSAGES`  | Max messages kept per conversation for Gemini context               |

## Architecture

- **Modules:** `auth`, `users`, `sessions`, `contacts`, `messages` (memory), `ai-agents`
- **Patterns:** repositories, services, constructor injection via `createContainer()` in `src/container.ts`
- **WhatsApp:** Baileys sockets in-memory per process; **auth state persisted in MongoDB** (not filesystem)
- **Queues:** In-process — `AiReplyQueueService` (`p-queue`, concurrency 6). HTTP handlers stay non-blocking.

## API (overview)

Base URL: `http://localhost:3000`

Auth header for protected routes: `Authorization: Bearer <jwt>`

### Auth

| Method | Path                 | Body                      | Description               |
| ------ | -------------------- | ------------------------- | ------------------------- |
| POST   | `/api/auth/register` | `{ "email", "password" }` | Register                  |
| POST   | `/api/auth/login`    | `{ "email", "password" }` | Login → `{ token, user }` |

### Sessions (WhatsApp)

| Method | Path                            | Description                                              |
| ------ | ------------------------------- | -------------------------------------------------------- |
| POST   | `/api/sessions`                 | Create session (`{ "label"? }`) → `sessionId` (UUID)     |
| GET    | `/api/sessions`                 | List sessions                                            |
| GET    | `/api/sessions/:publicId`       | Session detail                                           |
| POST   | `/api/sessions/:publicId/start` | Start Baileys (QR in server logs)                        |
| POST   | `/api/sessions/:publicId/stop`  | Stop socket                                              |
| POST   | `/api/sessions/:publicId/send`  | Send text `{ "to", "text" }` (session must be connected) |
| DELETE | `/api/sessions/:publicId`       | Logout, wipe WA auth in MongoDB, delete related data     |

### Contacts

| Method | Path                                            | Description                                         |
| ------ | ----------------------------------------------- | --------------------------------------------------- |
| POST   | `/api/contacts/:sessionId/sync`                 | Upsert snapshot from Baileys contact events into DB |
| GET    | `/api/contacts/:sessionId?search=&limit=&page=` | Paginated list                                      |
| DELETE | `/api/contacts/:contactId`                      | Delete (`contactId` = Mongo `_id`, 24 hex)          |

`sessionId` here is the **session UUID** (`sessionId` from session create).

### AI agents (Gemini) — one agent per session

| Method | Path                               | Notes                                                          |
| ------ | ---------------------------------- | -------------------------------------------------------------- |
| GET    | `/api/ai-agents`                   | List all agents for the user (with `sessionPublicId`)          |
| GET    | `/api/sessions/:publicId/ai-agent` | Get config (`hasGeminiKey`, no raw key)                        |
| PUT    | `/api/sessions/:publicId/ai-agent` | Create or full update; `geminiApiKey` required on first create |
| PATCH  | `/api/sessions/:publicId/ai-agent` | Partial update (e.g. `enabled`, tone, rotate key)              |
| DELETE | `/api/sessions/:publicId/ai-agent` | Remove agent from session (unassign)                           |

Agent fields include **business name**, **business description**, **language preference**, **tone of voice**, optional **display name** and **extra instructions**, **model name**, and **encrypted Gemini API key**. Incoming private text messages enqueue an AI reply when the agent is **enabled** and the session is connected.

### Professional Features (Ultra-Professional Mode)

Each agent includes advanced configuration options for professional, engaging, and efficient conversations:

- **Professional Mode:** Ultra-formal responses, quality mode, custom disclaimers
- **Typing Indicators:** Simulate human-like typing delays (100-3000ms)
- **Emoji Reactions:** Auto-react to messages with contextual emojis
- **Response Variants:** Control response length, suggestions, and emoji inclusion
- **Memory Retention:** Choose memory duration (5min, 10min, or always) for efficient chat

See [PROFESSIONAL_FEATURES.md](./PROFESSIONAL_FEATURES.md) for complete documentation and configuration examples.

**Quick Example:**

```bash
# Enable professional mode with typing indicators
PATCH /api/sessions/{sessionId}/ai-agent
{
  "professionalMode": { "enabled": true, "formalityLevel": "ultra-formal", "qualityMode": true },
  "typingIndicator": { "enabled": true, "typingDurationMs": 1200 },
  "memoryRetention": "10min"
}
```

## Error format

```json
{
  "success": false,
  "error": {
    "code": "SESSION_OFFLINE",
    "message": "WhatsApp session is not connected"
  }
}
```

## Sample flow

1. Register / login → JWT
2. `POST /api/sessions` → `sessionId`
3. `POST /api/sessions/:id/start` → scan QR (terminal logs)
4. Wait for contact sync; `POST /api/contacts/:sessionId/sync`
5. `PUT /api/sessions/:sessionId/ai-agent` with Gemini key and business profile (key encrypted at rest)
6. `POST /api/sessions/:sessionId/send` to message a number, or rely on inbound AI auto-reply

## Postman

Import `postman/WhatsApp-AI-SaaS.postman_collection.json` and set collection variables `baseUrl` and `token`.

## Compliance

Automated messaging may violate **WhatsApp Terms of Service** and local law. Use only with explicit recipient consent and appropriate safeguards.
