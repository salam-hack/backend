# Salam Hack Backend

Express.js backend using PostgreSQL and Prisma for a fintech AI assistant.

## Features started

- JWT authentication with refresh tokens
- Users profile endpoint
- AI transaction parsing using OpenAI with local fallback
- Transactions CRUD foundation
- Chat conversations and messages
- Global and conversation memory
- MinIO presigned file upload/download URLs
- Clean architecture: Controller, Service, Repository

## Run locally

1. Copy `.env.example` to `.env`.
2. Start dependencies: `docker compose up -d`.
3. Install dependencies: `npm install`.
4. Generate Prisma client: `npm run prisma:generate`.
5. Run migrations: `npm run prisma:migrate`.
6. Start API: `npm run dev`.
