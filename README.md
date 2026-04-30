# Salam Hack Backend

A streamlined Express.js backend using PostgreSQL and Prisma for a fintech AI assistant. This project has been cleaned up to focus on core financial tracking and AI-powered insights.

## Active Features

### Core Financial Tracking
- **User Profile**: Get user financial overview with income, expenses, savings rate, and goals
- **Dashboard**: Personalized home dashboard with balance, recent transactions, and smart analysis
- **Transaction Management**:
  - Manual transaction addition
  - AI-powered transaction parsing from text
  - Transaction categories and listings
  - Savings analysis over time

### AI Tools (Internal)
- **User Profile Summary**: Financial behavior analysis for AI context
- **Conversation Management**: Summary and turn tracking for chat history
- **Date Utilities**: Current date endpoint for AI operations
- **Reply Generation**: AI-powered response generation with conversation context

### User Management
- **Profile Access**: Get and update user profile information

## Architecture

The codebase follows clean architecture principles:
- **Controllers**: Handle HTTP requests and responses
- **Services**: Contain business logic
- **Repositories**: Manage database operations
- **Middleware**: Handle common concerns (validation, error handling, async operations)

## API Endpoints

### Public Endpoints
- `GET /api/home?userId=<uuid>` - Dashboard data
- `POST /api/transactions/add-manual` - Add manual transaction (body requires `userId`, `title`, `amount`, `type`, `categoryId`). 
  - **Response**: Returns the transaction `data` and a root-level `assistantMessage` object.
- `POST /api/transactions/parse-ai` - Parse transaction from text (body requires `userId` and `message` or `text`)
- `GET /api/transactions/categories` - Get available categories
- `GET /api/transactions/all?userId=<uuid>` - List transactions with filtering
- `GET /api/financial/savings-analysis?userId=<uuid>` - Savings rate analysis
- `POST /api/chat/send` - Generate AI response with conversation context.
  - **Response**: Returns a root-level `assistantMessage` object.

### User Endpoints
- `GET /internal/v1/users/me` - Get user profile
- `PATCH /internal/v1/users/me` - Update user profile

### AI Tools (Internal Use)
- `GET /internal/ai-tools/user-profile/:user_id` - Financial profile for AI
- `GET /internal/ai-tools/conversation-summary/:conversation_id` - Chat summary
- `PATCH /internal/ai-tools/conversation-summary/:conversation_id` - Update summary
- `GET /internal/ai-tools/conversation-turns/:conversation_id` - Conversation turns
- `GET /internal/ai-tools/current-date` - Current date
- `POST /api/chat/send` - Generate AI response

## Technology Stack

- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL with Prisma ORM
- **AI**: External chatbot and parser services
- **Validation**: Zod schemas
- **Security**: Helmet, CORS (configured for development)

## Development Setup

1. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Start Dependencies**
   ```bash
   docker compose up -d
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Database Setup**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000` (or your configured PORT).

## Authentication

Currently disabled for easy testing. All endpoints are publicly accessible with user context provided via:
- `X-User-Id` header, or
- Default test user if no header provided

## Currency

The application defaults to **Egyptian Pound (EGP)** for the MVP. This can be configured via the `DEFAULT_CURRENCY` environment variable.

## Health Checks

- `GET /health` - Basic liveness check
- `GET /health/ready` - Deep readiness check with database and storage validation
