# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (hot-reload)
npm run dev

# Production
npm start

# Tests
npm test

# Run a single test file
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/callLogs.test.js
```

## Architecture

Express.js backend (v5) using ES modules (`"type": "module"`). Entry point: `src/index.js` → `src/app.js` → `src/routes/api.js`. All routes are prefixed `/api/v1`.

**Request flow**: `routes/api.js` → middleware → `controllers/` → `services/`

### Controllers
- `toolsController.js` — Debt queries, ElevenLabs call processing, insurance/bienestar registration
- `flamingoController.js` — Flamingo debt queries and tracking
- `andesController.js` — Andes SCD SOAP-based electronic signature operations

### Services
- `debtService.js` — Orchestrates Colectora debt queries + Supabase user lookup
- `authService.js` — JWT token management for Colectora API (with expiration cache)
- `adminfoService.js` — Adminfo API: debts, tracking, payment agreements (token auth with cache)
- `flamingoService.js` — Flamingo API: same pattern as Adminfo
- `andesService.js` — SOAP client (strong-soap) with WS-Security for Andes SCD OTP/signing
- `insuranceService.js` — Vida Deudor insurance registration + email notifications
- `reportingService.js` — Call processing: S3 uploads, supervisor email notifications
- `callLogsService.js` — ElevenLabs webhook processing → Supabase (Coltefinanciera)
- `elevenLabsService.js` — ElevenLabs API client for conversation data
- `userService.js` — User lookups from Supabase

### Configuration
- `src/config/env.js` — All environment variables and defaults
- `src/config/clients.js` — Initialized singletons: 3 Supabase instances, AWS S3, 2 Nodemailer transporters

### Middleware (`src/middlewares/auth.js`)
- `protectRoute` — Placeholder (currently pass-through, API key validation not enforced)
- `verifyElevenLabsSignature` — HMAC-SHA256 verification of ElevenLabs webhook signatures (`elevenlabs-signature` header format: `t=TIMESTAMP,v0=HASH`)
- `verifyElevenLabsSignatureColtefinanciera` — Same but uses a separate secret (dual-tenant webhook support)

Raw body is preserved on all requests (custom `verify` in body-parser) for HMAC signature verification.

### Databases (Supabase / PostgreSQL)
Three separate Supabase instances accessed via `@supabase/supabase-js`:
1. **Colectora** — `users_2026`, debt tracking
2. **Vida Deudor** — `interesados_vida_deudor` (insurance leads)
3. **Coltefinanciera Recordatorios** — `call_logs` (ElevenLabs call data)

### External Integrations
| Integration | Auth | Purpose |
|---|---|---|
| Colectora API | JWT (cached) | Debt queries |
| Adminfo API | Token (cached) | Debts, tracking, payment agreements |
| Flamingo API | Token (cached) | Same as Adminfo |
| Andes SCD | SOAP + WS-Security | Electronic signatures / OTP |
| ElevenLabs | HMAC webhooks | AI voice call events |
| AWS S3 | SDK v3 | Document/transcript storage |
| SendGrid | SMTP via Nodemailer | Email notifications |

### Testing
Jest with `--experimental-vm-modules` (required for ES module support). Test files live in `tests/`. Ad-hoc integration scripts (`test_*.js`, `testAdminfoDebts.js`) exist at the root for manual testing.

## Miniverse

You are connected to a miniverse world at http://localhost:4321.

To check for messages from other agents, run:
  /loop 1m Check my miniverse inbox: curl -s 'http://localhost:4321/api/inbox?agent=claude'.
  If there are messages, read them and reply by running:
  curl -s -X POST http://localhost:4321/api/act \
    -H 'Content-Type: application/json' \
    -d '{"agent":"claude","action":{"type":"message","to":"<agent-id>","message":"<your reply>"}}'