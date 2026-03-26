# tools-backend

Express.js backend that acts as an integration layer for AI-powered debt collection, insurance lead management, and electronic signature workflows. It orchestrates multiple external APIs, SOAP services, AWS S3, email delivery, and three separate Supabase databases.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Getting Started](#getting-started)
4. [Environment Variables](#environment-variables)
5. [Architecture Overview](#architecture-overview)
6. [Routes Reference](#routes-reference)
7. [Services — Deep Dive](#services--deep-dive)
8. [Controllers](#controllers)
9. [Middleware](#middleware)
10. [Databases](#databases)
11. [External Integrations](#external-integrations)
12. [Key Workflows](#key-workflows)
13. [Testing](#testing)
14. [Security Notes](#security-notes)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ES modules — `"type": "module"`) |
| Framework | Express.js v5 |
| Databases | Supabase (3 separate instances) |
| HTTP Client | Axios |
| SOAP Client | strong-soap |
| Storage | AWS S3 SDK v3 |
| Email | Nodemailer + SendGrid SMTP |
| Security | Helmet, HMAC-SHA256 signature verification |
| Testing | Jest with `--experimental-vm-modules` |

---

## Project Structure

```
src/
├── index.js                  # Entry point — starts HTTP server
├── app.js                    # Express app setup (middleware, routing)
├── config/
│   ├── env.js                # All environment variables with defaults
│   └── clients.js            # Singleton instances: Supabase, S3, Nodemailer
├── routes/
│   └── api.js                # All routes under /api/v1
├── controllers/
│   ├── toolsController.js    # Colectora debts, call processing, insurance/bienestar
│   ├── flamingoController.js # Flamingo debt queries, tracking, payment agreements
│   └── andesController.js    # Andes SCD electronic signature operations
├── services/
│   ├── authService.js        # JWT management for Colectora API
│   ├── debtService.js        # Colectora debt query orchestration
│   ├── adminfoService.js     # Adminfo API: debts, tracking, agreements
│   ├── flamingoService.js    # Flamingo API: same operations as Adminfo
│   ├── andesService.js       # SOAP client for Andes SCD
│   ├── insuranceService.js   # Vida Deudor & Bienestar Plus registration + emails
│   ├── reportingService.js   # S3 upload + supervisor email for processed calls
│   ├── callLogsService.js    # ElevenLabs webhook -> Supabase (Coltefinanciera)
│   ├── elevenLabsService.js  # ElevenLabs REST API client
│   └── userService.js        # User lookup from Supabase (Colectora)
└── middlewares/
    └── auth.js               # HMAC webhook verification, route protection
tests/
├── api.test.js               # Integration tests for main routes
└── callLogs.test.js          # Unit tests for callLogsService
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Development with hot-reload
npm run dev

# Production
npm start

# Run all tests
npm test

# Run a single test file
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/callLogs.test.js
```

The server starts on port `3002` by default. Health check: `GET /health`.

---

## Environment Variables

All variables are centralized in `src/config/env.js`. Create a `.env` file at the project root.

### Server

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3002` | HTTP server port |
| `API_KEY` | — | Bearer token for `protectRoute` middleware (not enforced yet) |

### Colectora API

| Variable | Description |
|---|---|
| `COLTEFINANCIERA_USER` | Username for Colectora JWT auth |
| `COLTEFINANCIERA_PASS` | Password for Colectora JWT auth |

### Supabase — Three Separate Instances

| Variable | Instance | Purpose |
|---|---|---|
| `SUPABASE_URL` / `SUPABASE_KEY` | Colectora | `users_2026` user lookups |
| `SUPABASE_URL_VIDADEUDOR` / `SUPABASE_KEY_VIDADEUDOR` | Vida Deudor | Insurance/Bienestar leads |
| `SUPABASE_URL_COLTEFINANCIERA_RECORDATORIOS` / `SUPABASE_KEY_COLTEFINANCIERA_RECORDATORIOS` | Coltefinanciera Recordatorios | ElevenLabs call logs |

### Adminfo API

| Variable | Default | Description |
|---|---|---|
| `ADMINFO_URL` | `https://api.adminfo.net` | Base URL for Adminfo |
| `ADMINFO_USER` | `api_coltefinanciera_pdn` | Adminfo username |
| `ADMINFO_PASS` | — | Adminfo password |

### Flamingo API

| Variable | Default | Description |
|---|---|---|
| `FLAMINGO_USER` | `flamingo_pdn` | Flamingo username |
| `FLAMINGO_PASS` | — | Flamingo password |

> Flamingo uses the same `ADMINFO_URL` base endpoint as Adminfo, with different credentials.

### Andes SCD (SOAP)

| Variable | Description |
|---|---|
| `ANDES_WSDL_TEST` | WSDL URL for Andes SCD test environment |
| `ANDES_USER` | SOAP WS-Security username |
| `ANDES_PASSWORD` | SOAP WS-Security password (plain text) |
| `ANDES_PASSWORD_SHA1` | SHA1 hash of password (for WS-Security PasswordDigest) |

### ElevenLabs

| Variable | Description |
|---|---|
| `ELEVENLABS_API_KEY` | API key for ElevenLabs REST calls |
| `ELEVENLABS_WEBHOOK_SECRET` | HMAC secret for Colectora webhook verification |
| `ELEVENLABS_WEBHOOK_SECRET_COLTEFINANCIERA_RECORDATORIOS` | HMAC secret for Coltefinanciera webhook |
| `ELEVENLABS_AGENT_ID_COLECTORA` | Agent ID used by Colectora calls |
| `ELEVENLABS_AGENT_ID_VIDADEUDOR` | Agent ID used by Vida Deudor calls |

### Email (SendGrid via Nodemailer)

| Variable | Description |
|---|---|
| `EMAIL_HOST` | `smtp.sendgrid.net` |
| `EMAIL_PORT` | `587` |
| `SENDGRID_API_KEY_COLECTORA` | SendGrid API key for Colectora transporter |
| `SENDGRID_API_KEY_VIDADEUDOR` | SendGrid API key for Vida Deudor transporter |
| `EMAIL_FROM_COLECTORA` | From address for Colectora emails |
| `EMAIL_FROM_VIDADEUDOR` | From address for Vida Deudor emails |
| `SUPERVISOR_EMAIL_COLECTORA` | Recipient for call notification emails |
| `SUPERVISOR_EMAIL_VIDADEUDOR` | Recipient for insurance registration notifications |
| `SUPERVISOR_CC_VIDADEUDOR` | Comma-separated CC list for insurance notifications |

### AWS S3

| Variable | Default | Description |
|---|---|---|
| `AWS_ACCESS_KEY_ID_COLECTORA` | — | S3 access key |
| `AWS_SECRET_ACCESS_KEY_COLECTORA` | — | S3 secret key |
| `AWS_REGION_COLECTORA` | `us-east-1` | S3 region |
| `AWS_S3_BUCKET_COLECTORA` | `bucket-raw-latam` | S3 bucket name |

---

## Architecture Overview

```
Request
  └── Express app (helmet, cors, raw body preserved)
        └── /api/v1 router
              └── Middleware (protectRoute / verifyElevenLabsSignature)
                    └── Controller (parses + validates input)
                          └── Service(s) (business logic, external calls)
                                ├── External APIs (Colectora, Adminfo, Flamingo, ElevenLabs)
                                ├── SOAP (Andes SCD)
                                ├── Supabase (3 instances)
                                ├── AWS S3
                                └── SendGrid email
```

**Config layer** (`src/config/`): `env.js` exports all variables with defaults; `clients.js` creates and exports singleton instances imported directly by services — no re-initialization across requests.

**Token caching**: Both Colectora (JWT) and Adminfo/Flamingo (Bearer token) services cache their auth tokens in module-level variables and only refresh when expired.

---

## Routes Reference

All routes are mounted under `/api/v1`.

### Colectora Debt Queries

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/get-debts` | protectRoute | Query debts from Colectora API by document ID |

**Request body:**
```json
{ "documentId": "1234567890" }
```

**Response:**
```json
{
  "document_id": "1234567890",
  "name": "John Doe",
  "email": "john@example.com",
  "number_of_credits": 2,
  "debts_list": [
    {
      "debt_credit_number": "C001",
      "debt_origin": "Banco X",
      "debt_details": { "amount": 500000, "days_in_arrears": 90 }
    }
  ]
}
```

---

### ElevenLabs Call Processing

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/process-call` | verifyElevenLabsSignature | Receives ElevenLabs webhook, uploads call data to S3, sends supervisor email |

The middleware verifies the `elevenlabs-signature` header (`t=TIMESTAMP,v0=HASH`) before the controller runs. The controller handles two payload shapes:
- **ElevenLabs native format**: `{ data: { conversation_id, ... } }`
- **Legacy format**: flat fields directly on the body

**Response:**
```json
{
  "message": "Call processed successfully",
  "details": {
    "s3": { "success": true, "fileName": "ultim/llamada_John_1234.json", "location": "https://..." },
    "email": { "success": true }
  }
}
```

---

### Insurance & Bienestar Registration

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/insurance-interest` | protectRoute | Alias of `/insurance-registration` |
| `POST` | `/insurance-registration` | protectRoute | Register client for Vida Deudor insurance |
| `POST` | `/bienestar-interest` | protectRoute | Alias of `/bienestar-registration` |
| `POST` | `/bienestar-registration` | protectRoute | Register client for Bienestar Plus wellness plan |

**Request body (both products):**
```json
{
  "clientName": "John Doe",
  "clientPhone": "3001234567",
  "clientEmail": "john@example.com",
  "clientDocumentId": "1234567890",
  "transcript": "optional call transcript",
  "interestLevel": "alto"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Client registered successfully",
  "data": {
    "client": { "id": 1, "name": "John Doe" },
    "existed": false,
    "emailResults": { "supervisor": true, "client": true }
  }
}
```

---

### ElevenLabs Conversation Details

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/elevenlabs/conversation/:conversation_id` | protectRoute | Fetch full conversation object from ElevenLabs API |

Returns the raw ElevenLabs conversation object or `404` if not found.

---

### Adminfo API

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/adminfo/get-debts` | protectRoute | Query client debts from Adminfo |
| `POST` | `/adminfo/save-tracking` | protectRoute | Register a follow-up action in Adminfo |
| `POST` | `/adminfo/payment-agreement` | protectRoute | Create a payment agreement in Adminfo |

**`/adminfo/get-debts` request:**
```json
{ "identificacion": "1234567890", "tipoIdentificacion": "1" }
```

**`/adminfo/get-debts` response:**
```json
{
  "cliente": { "nombre": "John Doe" },
  "celular_registrado": "3001234567",
  "id_dato_contacto_obligatorio": "456",
  "numero_credito_obligatorio": "C001",
  "total_obligaciones": 3,
  "obligaciones_vencidas": 2,
  "detalle_obligaciones": [{ "idObligacion": "...", "saldo_vencido": 500000 }]
}
```

**`/adminfo/save-tracking` request:**
```json
{
  "identificacion": "1234567890",
  "grabador": "agent_user",
  "numCredito": "C001",
  "descripcion": "Client promised payment",
  "codigoGestion": "70084",
  "tipoIdentificacion": "1",
  "idDatoContacto": "456"
}
```

> If `codigoGestion` is missing or non-numeric it defaults to `70084` (Gestión efectiva).

**`/adminfo/payment-agreement` request:**
```json
{
  "tipoIdentificacion": "1",
  "identificacion": "1234567890",
  "idObligacion": "OBL001",
  "grabador": "agent_user",
  "fechaPago": "2026-04-01",
  "valorTotalPactado": 500000,
  "cuotas": 3,
  "codigoGestion": "70084",
  "acuerdo_pago": [
    { "fechaCuota": "2026-04-01", "valorCuota": 166667 }
  ]
}
```

---

### Flamingo API

Identical request/response shapes as Adminfo, with separate credentials and independent token cache.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/flamingo/get-debts` | protectRoute | Query client debts from Flamingo |
| `POST` | `/flamingo/save-tracking` | protectRoute | Register a follow-up in Flamingo |
| `POST` | `/flamingo/payment-agreement` | protectRoute | Create a payment agreement in Flamingo |

---

### Andes SCD Electronic Signatures

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/andes/test-connection` | protectRoute | Test SOAP connectivity to Andes SCD |
| `POST` | `/andes/solicitar-firma` | protectRoute | Send signer data — generates OTP sent to client |
| `POST` | `/andes/confirmar-firma-otp` | protectRoute | Submit document + OTP — returns signed PDF as base64 |
| `GET` | `/andes/testigo/:idSolicitud` | protectRoute | Download signature witness certificate as base64 |

**`/andes/solicitar-firma` request:**
```json
{
  "datosFirmante": {
    "idTipoDocumento": 1,
    "documento": "1234567890",
    "primerNombre": "John",
    "segundoNombre": "A",
    "primerApellido": "Doe",
    "segundoApellido": "B",
    "correo": "john@example.com",
    "celular": "3001234567"
  }
}
```

**`/andes/confirmar-firma-otp` request:**
```json
{
  "documentoBase64": "<base64-encoded PDF>",
  "codigoOTP": "123456",
  "datosFirmante": {
    "idTipoDocumento": 1,
    "documento": "1234567890",
    "codigoOTP": "123456",
    "adjunto": "<base64-encoded PDF>",
    "nombreAdjunto": "contrato.pdf",
    "firmaVisible": 1,
    "coordenadasFirma": "10,10,200,50",
    "pagina": 0,
    "observaciones": "Firma digital",
    "tipoFirmaVis": 1
  }
}
```

**Response (all Andes routes):**
```json
{ "success": true, "data": { "estado": 0, "mensaje": "..." } }
```

`estado: 0` means success. Any other value is treated as an error and returns `success: false`.

---

## Services — Deep Dive

### `authService.js` — Colectora JWT

Manages the JWT token for the Colectora API with in-memory caching to avoid unnecessary auth calls.

- **`getAuthToken()`**: Returns a valid token immediately if cached and not expired (checks `tokenExpirationTime`). Otherwise calls `getJWT()`.
- **`getJWT()`**: POSTs to `https://latamcolectoracartera.com/token_jwt/` with `{ USUARIO, PASSWORD }`. Stores the `access_token` and sets expiration from `expira` (Unix timestamp in seconds, converted to ms). Used only internally by `debtService.js`.

---

### `debtService.js` — Colectora Debt Orchestration

Combines data from the Colectora external API with the local Supabase user record.

- **`fetchDebts(documentId)`**:
  1. Gets a valid JWT via `authService.getAuthToken()`
  2. POSTs to `https://latamcolectoracartera.com/metodo_consulta/` with `{ DOCUMENTO: documentId, SERVICIO: 1 }`
  3. Looks up the user in Supabase (`users_2026`) via `userService.fetchUser()`
  4. Merges both: enriches the debt list with the user's `name` and `email` from the local DB
  5. Returns `{ document_id, name, email, number_of_credits, debts_list }`

If the Colectora API returns no data, a friendly message is returned instead of throwing an error.

---

### `adminfoService.js` — Adminfo API

Handles all communication with the Adminfo platform. Adminfo is the primary CRM/collection management system for the Coltefinanciera portfolio.

**Token management — `getAdminfoAuthToken()`:**
- Caches the Bearer token in module scope with a 55-minute TTL
- On expiry, calls `refreshAdminfoToken()` which POSTs to `{ADMINFO_URL}/auths/autenticacion` with `{ usuario, contrasena }`
- Handles multiple response shapes: `{ token }`, `{ access_token }`, `{ datos: { token } }` — defensive against API contract changes

**`consultaClientes(tipoIdentificacion, identificacion)`:**
- GETs `{ADMINFO_URL}/v2/deudores/titulares` with query params
- Returns the full raw Adminfo client record including `informacion_basica`, `datos_contacto`, and `obligaciones`
- The controller (`handleGetAdminfoDebts`) is responsible for parsing and normalizing this response before sending it to the caller

**`realizarSeguimiento(data)`:**
- POSTs to `{ADMINFO_URL}/v5/seguimientos`
- Applies field mapping before the request:
  - `numCredito` → `nrodoc`
  - `idDatoContacto` → `consrefer`
  - `tipoIdentificacion` → Adminfo's internal numeric code
- Defaults: `codigoCausal: ''`, `idCampana: ''`

**`crearCompromisoPago(data)`:**
- POSTs to `{ADMINFO_URL}/v6/acuerdos/acuerdoPago`
- Sends the full `acuerdo_pago` array (one entry per installment)
- Uses the same cached token and field mapping as tracking

---

### `flamingoService.js` — Flamingo API

Structurally identical to `adminfoService.js` but uses different credentials (`FLAMINGO_USER` / `FLAMINGO_PASS`). Flamingo manages a separate debt portfolio.

Despite separate credentials, it hits the **same base URL** (`ADMINFO_URL`) as Adminfo. The token is cached independently — Flamingo's token is never shared with Adminfo's cache.

- **`getFlamingoAuthToken()`**: Same 55-minute TTL cache, module-scope variable separate from Adminfo's
- **`consultaClientesFlamingo()`**: Same endpoint as Adminfo, different Bearer token in headers
- **`realizarSeguimientoFlamingo()`**: Same field mapping as Adminfo (`numCredito` → `nrodoc`, etc.)
- **`crearCompromisoPagoFlamingo()`**: Adds extra default fields not present in Adminfo: `codAbogado: ''`, `canalGestion: ''`

---

### `andesService.js` — SOAP Electronic Signatures

Wraps a SOAP client (`strong-soap`) with WS-Security to communicate with Andes SCD, a Colombian digital signature platform. This is the most complex service in the project.

**Singleton pattern**: The SOAP client is initialized once on the first call and cached. All subsequent calls reuse the same instance.

**`initClient()`:**
- Creates a SOAP client from the WSDL URL (`ANDES_WSDL_TEST`)
- Attaches `WSSecurity` with `PasswordText` mode, which injects WS-Security headers into every SOAP envelope
- Options: `hasTimeStamp: false`, `hasTokenCreated: false`, `hasNonce: false`
- Logs the raw SOAP XML request (with the password field masked) for debugging

**`verificarEstadoServicio()`:**
- Calls SOAP method `Login` with `{ LoginRequest: { identificador: ANDES_USER } }`
- Returns `{ estado, mensaje }`
- Used as a health/connectivity check for the Andes integration

**`solicitarCertificado(datosFirmante)`:**
- Calls SOAP method `SolicitudCertificado`
- This triggers Andes SCD to send an OTP to the signer via email and/or SMS
- Required input fields: `documento`, `primerNombre`, `primerApellido`, `correo`, `celular`
- Optional: `idTipoDocumento` (defaults to `1`), `segundoNombre`, `segundoApellido`, `notificacion`
- Returns `{ estado, mensaje }` — `estado: 0` means OTP was sent successfully

**`firmarDocumento(documentoBase64, datosFirmante)`:**
- Calls SOAP method `FirmaDocumento`
- Takes the PDF as base64 (`adjunto`) and the OTP entered by the signer (`codigoOTP`)
- Key parameters:
  - `firmaVisible`: `1` or `2` (signature display mode)
  - `coordenadasFirma`: pixel coordinates for the visible signature box
  - `pagina`: page to place the signature on (`0` = last page)
  - `tipoFirmaVis`: visual signature type
- Returns `{ estado, mensaje (signed PDF as base64), id (idSolicitudFirma) }`
- `idSolicitudFirma` is the ID needed to later download the witness certificate

**`descargarCertificado(idSolicitud)`:**
- Calls SOAP method `DescargarCertificado`
- Downloads the signature witness certificate for a completed signing request
- Returns `{ estado, mensaje (witness document as base64) }`

---

### `insuranceService.js` — Vida Deudor & Bienestar Plus

Handles lead registration and automated email workflows for two insurance/wellness products. Both products follow the same pattern: save to Supabase, send supervisor notification, send client welcome email.

**Vida Deudor (debtor life insurance):**

- **`saveInterestedClient(clientData)`**: Idempotent save — checks if `document_id` already exists in `interesados_vida_deudor`. Returns `{ existed: true }` if found; otherwise inserts `{ name, phone_number, email, document_id, date }`.
- **`processClientRegistration(clientData)`**: Main orchestrator — calls `saveInterestedClient()` then `sendActivationEmails()`. Returns combined result with `{ client, existed, emailResults }`.
- **`sendActivationEmails(data)`**: Sends two emails concurrently via the `transporterVidaDeudor` (SendGrid):
  - **Supervisor email** (HTML): To `SUPERVISOR_EMAIL_VIDADEUDOR`, CC `SUPERVISOR_CC_VIDADEUDOR` (comma-separated) + `andres.c@ultimmarketing.com`. Contains the client's full name, phone, email, and document ID.
  - **Client welcome email** (HTML): Sent to the client's email. Contains product benefits: teleconsulta (2/year), telepsicología (2/year), telenutrición (unlimited), pharmacy discounts, and the service phone number `(601) 4320020`.

**Bienestar Plus (wellness plan):**

- **`saveInterestedClientBienestar()`**: Same logic as Vida Deudor but writes to the `interesados_bienestar_plus` table
- **`processClientRegistrationBienestar()`**: Same orchestration flow
- **`sendActivationEmailsBienestar()`**: Same email structure, Bienestar Plus-specific content in the body

Both products share the same `transporterVidaDeudor` Nodemailer instance and the same from-address (`EMAIL_FROM_VIDADEUDOR`).

---

### `reportingService.js` — Call Reporting for Colectora

Processes a completed AI voice call: archives the transcript to S3 and notifies the supervisor by email. Called after every successful ElevenLabs webhook event on the Colectora tenant.

- **`uploadCallDataToS3(callData)`**:
  - Builds a JSON object: `{ name, document_id, pagaduria, duration, number, transcription }`
  - Uploads to S3 bucket `bucket-raw-latam` with key `ultim/llamada_{name}_{timestamp}.json`
  - `ContentType`: `application/json`
  - Returns `{ success, fileName, location }` where `location` is the public HTTPS S3 URL

- **`sendSuccessfulCallNotification(callData, s3Result)`**:
  - Sends an HTML email to `SUPERVISOR_EMAIL_COLECTORA` using `transporterColectora` (separate SendGrid key)
  - Subject: `Llamada Exitosa - {name}`
  - Body includes: client info, call duration, full transcript, S3 upload status and link

- **`processCallLog(callData)`**: Calls both functions sequentially. Returns `{ s3: result, email: result }`.

---

### `callLogsService.js` — ElevenLabs Webhook to Coltefinanciera DB

Processes ElevenLabs webhook payloads for the Coltefinanciera Recordatorios tenant and stores them in a dedicated Supabase instance. This service is resilient to ElevenLabs API contract changes — it checks multiple field paths to extract the same logical value.

- **`extractCallLogData(payload)`**: Normalizes the raw ElevenLabs payload into a flat record. Handles multiple payload structures (ElevenLabs has changed its webhook format over time):
  - `call_successful`: checked in `analysis.call_successful`, `evaluation_criteria_results.call_successful`, `analysis.success`
  - `evaluation_rationale`: checked in `analysis.rationale`, `evaluation_rationale`, `explanation`, `reason`
  - `call_name`: from `dynamic_variables.call_name`
  - `full_analysis_data`: the entire payload is stored as JSON for full auditability

- **`insertCallLog(callLogData)`**: Idempotent insert — checks if `conversation_id` already exists before inserting. Returns `{ existed: true }` for duplicates, preventing double-counting of retried webhooks.

- **`processElevenLabsWebhook(payload)`**: Entry point for the webhook handler. Validates that `conversation_id` and `agent_id` are present, then calls `extractCallLogData()` and `insertCallLog()`.

- **`getCallLogs(filters, limit)`**: Internal query helper with optional filters (`agent_id`, `call_successful`, `call_status`, `call_name`). Orders by `created_at DESC`. Not currently exposed via a route — available for future use.

---

### `elevenLabsService.js` — ElevenLabs REST API

Thin client for the ElevenLabs Conversational AI REST API.

- **`getConversationDetails(conversationId)`**: GETs `https://api.elevenlabs.io/v1/convai/conversations/{conversationId}` with the `xi-api-key` header. Returns the full conversation object. Throws a descriptive 404 error if the conversation does not exist, or a 500 on other failures with the ElevenLabs error message forwarded.

---

### `userService.js` — Supabase User Lookup

Minimal service for local user data.

- **`fetchUser(documentId)`**: Queries the `users_2026` table in the Colectora Supabase instance. Returns the user row (`{ document_id, name, email }`) or `null` if not found. Used only by `debtService.js` to enrich debt responses.

---

## Controllers

Controllers validate input, call one or more services, and format HTTP responses. They contain no business logic.

### `toolsController.js`

| Handler | Required fields | Calls |
|---|---|---|
| `handleGetDebts` | `documentId` | `debtService.fetchDebts()` |
| `handleProcessCall` | Signature verified by middleware | `reportingService.processCallLog()` |
| `handleInsuranceRegistration` | `clientName`, `clientPhone`, `clientEmail`, `clientDocumentId` | `insuranceService.processClientRegistration()` |
| `handleInsuranceInterest` | Same | Alias — calls same function |
| `handleBienestarRegistration` | Same | `insuranceService.processClientRegistrationBienestar()` |
| `handleBienestarInterest` | Same | Alias — calls same function |
| `handleGetConversationDetails` | `conversation_id` (route param) | `elevenLabsService.getConversationDetails()` |
| `handleGetAdminfoDebts` | `identificacion` | `adminfoService.consultaClientes()` |
| `handleAdminfoTracking` | `identificacion`, `grabador`, `numCredito` | `adminfoService.realizarSeguimiento()` |
| `handleAdminfoPaymentAgreement` | `acuerdo_pago` (non-empty array) | `adminfoService.crearCompromisoPago()` |

Defaults applied in `handleAdminfoTracking` before forwarding to service:
- `codigoGestion` → `70084` if missing or non-numeric
- `tipoIdentificacion` → `"1"` (Cedula de Ciudadania)
- `idDatoContacto` → `"0"`
- `canalActual` → `"TEL"`, `tipoContacto` → `"ENT"`

### `flamingoController.js`

Mirrors `toolsController.js` for the Flamingo tenant. Applies the same defaults for `codigoGestion` and `tipoIdentificacion`.

### `andesController.js`

Thin wrapper around `AndesService`. All handlers check `estado === 0` in the SOAP response and map to `{ success: true }` or `{ success: false, error }` accordingly.

---

## Middleware

### `src/middlewares/auth.js`

**`protectRoute`** — Currently a pass-through. The skeleton for API key validation exists but is not enforced. All routes using this middleware are effectively public until it is implemented.

**`verifyElevenLabsSignature`** — Applied to `POST /process-call` (Colectora tenant):
1. Parses the `elevenlabs-signature` header: `t=TIMESTAMP,v0=HASH`
2. Builds the signed string: `{timestamp}.{rawBody}`
3. Computes HMAC-SHA256 using `ELEVENLABS_WEBHOOK_SECRET`
4. Compares the result with the `v0` value — returns `401` on mismatch
5. Requires `req.rawBody` to be populated (set by body-parser's `verify` callback in `app.js`)

**`verifyElevenLabsSignatureColtefinanciera`** — Same logic as above but uses `ELEVENLABS_WEBHOOK_SECRET_COLTEFINANCIERA_RECORDATORIOS`. Enables dual-tenant webhook support on separate secrets.

---

## Databases

Three separate Supabase (PostgreSQL) instances, each with its own project URL and API key. All are accessed via `@supabase/supabase-js` singletons initialized in `src/config/clients.js`.

### 1. Colectora (`supabaseColectora`)

**Table: `users_2026`**
| Column | Type | Description |
|---|---|---|
| `document_id` | text (PK) | National ID number |
| `name` | text | Full name |
| `email` | text | Contact email |

Used only to enrich debt query responses with the client's name and email.

### 2. Vida Deudor (`supabaseVidaDeudor`)

**Table: `interesados_vida_deudor`**
| Column | Type | Description |
|---|---|---|
| `id` | int (PK) | Auto-increment |
| `name` | text | Client full name |
| `phone_number` | text | Contact phone |
| `email` | text | Contact email |
| `document_id` | text | National ID number |
| `date` | text | Registration date (YYYY-MM-DD) |

**Table: `interesados_bienestar_plus`** — Same schema, separate product.

### 3. Coltefinanciera Recordatorios (`supabaseColtefinancieraRecordatorios`)

**Table: `call_logs`**
| Column | Type | Description |
|---|---|---|
| `id` | int (PK) | Auto-increment |
| `conversation_id` | text (UNIQUE) | ElevenLabs conversation ID |
| `agent_id` | text | ElevenLabs agent that handled the call |
| `call_successful` | text | `'true'`, `'false'`, or `''` |
| `evaluation_rationale` | varchar(1000) | AI's explanation of the call outcome |
| `full_analysis_data` | jsonb | Complete ElevenLabs webhook payload |
| `call_status` | text | ElevenLabs call status |
| `call_name` | text | Client name from dynamic variables |
| `created_at` | timestamp | Row creation timestamp |

---

## External Integrations

| Integration | Auth Method | Endpoint | Purpose |
|---|---|---|---|
| Colectora API | JWT Bearer (cached per expiry) | `https://latamcolectoracartera.com/metodo_consulta/` | Debt queries |
| Colectora Auth | Username + Password | `/token_jwt/` | Obtain JWT |
| Adminfo API | Bearer token (55-min cache) | `{ADMINFO_URL}/v2`, `/v5`, `/v6` | Debts, tracking, agreements |
| Flamingo API | Bearer token (55-min cache, separate) | Same ADMINFO_URL | Alternative debt portfolio |
| ElevenLabs API | `xi-api-key` header | `https://api.elevenlabs.io/v1/convai/conversations/{id}` | Fetch conversation details |
| ElevenLabs Webhooks | HMAC-SHA256 | Inbound POST | Call lifecycle events |
| Andes SCD | SOAP WS-Security (PasswordText) | WSDL from `ANDES_WSDL_TEST` | Electronic signatures + OTP |
| AWS S3 | SDK v3 credentials | `bucket-raw-latam` | Call transcript storage |
| SendGrid | SMTP with API key | `smtp.sendgrid.net:587` | Email notifications (2 keys) |
| Supabase | API key (3 instances) | `*.supabase.co` | All persistent data |

---

## Key Workflows

### 1. Debt Query (Colectora)

```
POST /api/v1/get-debts { documentId }
  |
  +-- authService.getAuthToken()          <- cached JWT, refresh only on expiry
  +-- POST latamcolectoracartera.com/metodo_consulta/  <- actual debts
  +-- supabaseColectora: SELECT users_2026 WHERE document_id = ?
  +-- Merge & normalize
  --> Response: { document_id, name, email, number_of_credits, debts_list }
```

### 2. AI Call Processing (ElevenLabs -> Colectora)

```
POST /api/v1/process-call  (ElevenLabs webhook)
  |
  +-- verifyElevenLabsSignature middleware  <- HMAC-SHA256, 401 on fail
  +-- Parse payload (native EL format or legacy flat format)
  +-- reportingService.uploadCallDataToS3()
  |     -> ultim/llamada_{name}_{timestamp}.json in bucket-raw-latam
  +-- reportingService.sendSuccessfulCallNotification()
  |     -> HTML email to SUPERVISOR_EMAIL_COLECTORA
  --> Response: { message, details: { s3, email } }
```

### 3. Insurance / Bienestar Lead Registration

```
POST /api/v1/insurance-registration { clientName, clientPhone, clientEmail, clientDocumentId }
  |
  +-- insuranceService.saveInterestedClient()
  |     -> Check document_id in interesados_vida_deudor
  |     -> Insert if new, return existed: true if duplicate
  +-- insuranceService.sendActivationEmails()
  |     +-- Supervisor email (HTML) -> SUPERVISOR_EMAIL_VIDADEUDOR + CC list
  |     +-- Client welcome email (HTML) -> clientEmail
  --> Response: { success, data: { client, existed, emailResults } }
```

### 4. Adminfo Debt Query and Follow-Up

```
POST /api/v1/adminfo/get-debts { identificacion }
  |
  +-- adminfoService.getAdminfoAuthToken()  <- 55-min cached token
  +-- GET ADMINFO_URL/v2/deudores/titulares
  +-- Controller normalizes response
  --> Response: { cliente, celular_registrado, obligaciones_vencidas, detalle_obligaciones }

POST /api/v1/adminfo/save-tracking { identificacion, grabador, numCredito, ... }
  |
  +-- Apply defaults (codigoGestion, tipoIdentificacion, etc.)
  +-- adminfoService.getAdminfoAuthToken()
  +-- POST ADMINFO_URL/v5/seguimientos
  --> Response: { message, result }
```

### 5. Electronic Signature (Andes SCD)

```
POST /api/v1/andes/solicitar-firma { datosFirmante }
  |
  +-- AndesService.initClient()  <- SOAP client cached singleton
  +-- SOAP: SolicitudCertificado(datosFirmante)
  |     -> Andes SCD sends OTP to client via email/SMS
  --> Response: { success: true, data: { estado: 0, mensaje } }

POST /api/v1/andes/confirmar-firma-otp { documentoBase64, datosFirmante, codigoOTP }
  |
  +-- AndesService.firmarDocumento(documentoBase64, firmaDatos)
  |     -> SOAP: FirmaDocumento with OTP + base64 PDF
  |     -> Returns signed PDF as base64 + idSolicitudFirma
  --> Response: { success: true, data: { estado: 0, mensaje (signed PDF), id } }

GET /api/v1/andes/testigo/:idSolicitud
  |
  +-- AndesService.descargarCertificado(idSolicitud)
  |     -> SOAP: DescargarCertificado
  --> Response: { success: true, testigoBase64 }
```

---

## Testing

Jest is configured for ES module support via `--experimental-vm-modules`.

```bash
# Run all tests
npm test

# Single file
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/callLogs.test.js
```

**`tests/api.test.js`** — Integration-style tests for the main routes:
- Uses `unstable_mockModule` to mock Axios, `userService`, `authService`, and the Supabase clients
- Covers: `GET /health`, `POST /api/v1/get-debts`, `POST /api/v1/process-call`, `POST /api/v1/insurance-interest`

**`tests/callLogs.test.js`** — Unit tests for `callLogsService.js`:
- Mocks `supabaseColtefinancieraRecordatorios`
- Covers: successful webhook processing, missing `conversation_id`, missing `agent_id`, duplicate `conversation_id` (idempotency check), correct data extraction from multiple ElevenLabs payload structures

Ad-hoc integration scripts exist at the project root (`test_*.js`, `testAdminfoDebts.js`) for manual API testing during development. These are not part of the automated test suite.

---

## Security Notes

- **Webhook signature verification** is the main security boundary. Applied via `verifyElevenLabsSignature` middleware using HMAC-SHA256. Returns `401` on any mismatch.
- **`protectRoute` is not enforced** — all routes using it are currently public. Implement the API key check in `src/middlewares/auth.js` to enforce it.
- **Raw body preservation**: `req.rawBody` is populated on every request via body-parser's `verify` callback in `app.js`. Required for HMAC signature verification to work.
- **Token caching**: JWT and Bearer tokens live in module-level variables (in-memory). A server restart clears all caches and triggers a fresh auth on the next request.
- **SOAP credentials**: The Andes WS-Security password is masked before printing request XML to console logs.
- **Secrets**: All credentials live in `.env` (gitignored). Never commit this file.
- **CORS**: Enabled for all origins. Restrict with a whitelist in production if this API is not purely internal.
- **Helmet**: Applied globally for standard HTTP security headers.
