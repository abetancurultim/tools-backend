# Tools Backend

A robust Node.js backend designed to handle automated reporting, debt querying, and insurance lead management. This project integrates with external services like ElevenLabs (via webhooks), AWS S3 for data storage, and SendGrid/Nodemailer for automated communications.

## 🚀 Key Features

- **Debt Querying**: Integrate with financial systems to retrieve debt information based on customer IDs.
- **Call Processing & Logging**: Automatically process call data from ElevenLabs, store transcripts/logs in AWS S3, and notify supervisors via email.
- **Insurance Lead Management**: Capture and manage high-interest leads for "Vida Deudor" insurance.
- **Automated Registration**: Complete client registration flow with automated activation emails for both customers and supervisors.

## 🛠 Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Cloud Storage**: AWS S3
- **Email Service**: Nodemailer / SendGrid
- **Testing**: Jest & Supertest

## 📁 Project Structure

```text
tools-backend/
├── src/
│   ├── config/          # Client initializations (Supabase, AWS, Mail)
│   ├── controllers/     # Request handling & input validation
│   ├── middlewares/      # Authentication & route protection
│   ├── routes/          # API endpoint definitions
│   ├── services/        # Business logic & external integrations
│   ├── app.js           # Express app configuration
│   └── index.js         # Server entry point
├── tests/               # API & unit tests
└── .env                 # Environment configuration (see below)
```

## ⚙️ Getting Started

### Prerequisites

- Node.js installed
- Supabase project credentials
- AWS IAM credentials (with S3 access)
- SendGrid API Key or SMTP credentials

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure your environment variables (see `.env.example` logic).

### Development

Run the server with hot-reload:
```bash
npm run dev
```

Run tests:
```bash
npm test
```

## 🔐 Environment Variables

The project requires several environment variables for different modules. Ensure your `.env` file includes:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL_COLECTORA` | Supabase URL for Colectora project |
| `SUPABASE_KEY_COLECTORA` | Supabase API Key for Colectora |
| `AWS_ACCESS_KEY_ID_COLECTORA` | AWS User access key |
| `AWS_SECRET_ACCESS_KEY_COLECTORA` | AWS User secret key |
| `AWS_S3_BUCKET_COLECTORA` | Target S3 bucket name |
| `SENDGRID_API_KEY_COLECTORA` | SendGrid API Key for mailing |
| `SUPERVISOR_EMAIL_VIDADEUDOR` | Email for insurance lead notifications |
| `API_AUTH_TOKEN` | Bearer token for API protection |

## 📡 API Reference

All routes are prefixed with `/api/v1` (based on common structure).

### 1. Get Debts
`POST /api/v1/get-debts`
- **Desc**: Retrieves current debts for a specific document ID.
- **Payload**: `{ "documentId": "123456" }`

### 2. Process Call Log
`POST /api/v1/process-call`
- **Desc**: Processes ElevenLabs call data, uploads to S3, and emails supervisor.
- **Payload**: Full ElevenLabs JSON object (requires `callSid`, `name`, `transcript`).

### 3. Insurance Interest
`POST /api/v1/insurance-interest`
- **Desc**: Notifies of a new hot lead interested in insurance.
- **Payload**: `{ "clientName": "...", "clientPhone": "...", "interestLevel": "alto" }`

### 4. Insurance Registration
`POST /api/v1/insurance-registration`
- **Desc**: Registers a new customer and sends activation/welcome emails.
- **Payload**: `{ "name": "...", "phone_number": "...", "email": "...", "document_id": "..." }`

