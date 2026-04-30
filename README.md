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

- **Dashboard Data**
  - `POST /api/home`
  - **Body**:
    - `userId` (Required, UUID)

- **Add Manual Transaction**
  - `POST /api/transactions/add-manual`
  - **Body**:
    - `userId` (Required, UUID)
    - `title` (Required, String)
    - `amount` (Required, Number)
    - `type` (Required, "income" | "expense")
    - `categoryId` (Required, String, e.g., "EXP_FOOD")
    - `date` (Optional, ISO Date String)
    - `conversationId` (Optional, UUID) - If provided, returns an AI confirmation message.
  - **Response**: Returns transaction `data` and root-level `assistantMessage`.

- **AI Transaction Parser**
  - `POST /api/transactions/parse-ai`
  - **Body**:
    - `userId` (Required, UUID)
    - `message` or `text` (Required, String)

- **Get Categories**
  - `GET /api/transactions/categories`

- **List Transactions**
  - `GET /api/transactions/all`
  - **Query Params**:
    - `userId` (Required, UUID)
    - `limit` (Optional, Number)
    - `offset` (Optional, Number)
    - `type` (Optional, "income" | "expense")
    - `from`/`to` (Optional, ISO Date)

- **Savings Analysis**
  - `GET /api/financial/savings-analysis?userId=<uuid>`

- **Send Chat Message**
  - `POST /api/chat/send`
  - **Body**:
    - `userId` (Required, UUID)
    - `conversationId` (Required, UUID)
    - `message` (Required, String)
  - **Response**: Returns root-level `assistantMessage`.

- **Create New Conversation**
  - `POST /api/chat/new`
  - **Body**:
    - `userId` (Required, UUID)
    - `title` (Optional, String)

### User Endpoints

- **Get Profile**
  - `GET /internal/v1/users/me`

- **Update Profile**
  - `PATCH /internal/v1/users/me`
  - **Body**:
    - `name` (Optional)
    - `email` (Optional)
    - `locale` (Optional)
    - `timezone` (Optional)
    - `defaultCurrency` (Optional)

### AI Tools (Internal Use)

- `GET /internal/ai-tools/user-profile/:user_id`
- `GET /internal/ai-tools/conversation-summary/:conversation_id?userId=<uuid>`
- `PATCH /internal/ai-tools/conversation-summary/:conversation_id?userId=<uuid>`
  - **Body**: `summary` (Required)
- `GET /internal/ai-tools/conversation-turns/:conversation_id?userId=<uuid>`
- `GET /internal/ai-tools/current-date`

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
