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

#### Dashboard Data
- **Endpoint**: `POST /api/home`
- **Request Body**:
  ```json
  { "userId": "uuid" }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "user": { "name": "...", "balance": 0 },
      "recentTransactions": [...],
      "goals": [...]
    }
  }
  ```

#### Add Manual Transaction
- **Endpoint**: `POST /api/transactions/add-manual`
- **Request Body**:
  ```json
  {
    "userId": "uuid",
    "title": "Grocery Shopping",
    "amount": 450,
    "type": "expense",
    "categoryId": "EXP_FOOD",
    "date": "2026-05-01T00:00:00Z",
    "conversationId": "optional-uuid"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": { "id": "...", "amount": 450, ... },
    "assistantMessage": { "content": "..." }
  }
  ```

#### AI Transaction Parser
- **Endpoint**: `POST /api/transactions/parse-ai`
- **Request Body**:
  ```json
  {
    "userId": "uuid",
    "message": "I spent 50 EGP on coffee today"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": { "item": "coffee", "amount": 50, "category": "Food" }
  }
  ```

#### Get Categories
- **Endpoint**: `GET /api/transactions/categories`
- **Response**:
  ```json
  {
    "success": true,
    "data": [ { "id": "EXP_FOOD", "name": "Food", "icon": "🍔" }, ... ]
  }
  ```

#### List Transactions
- **Endpoint**: `GET /api/transactions/all?userId=<uuid>&limit=10`
- **Response**:
  ```json
  {
    "success": true,
    "data": [ { "id": "...", "title": "...", "amount": 100 }, ... ]
  }
  ```

#### Savings Analysis
- **Endpoint**: `GET /api/financial/savings-analysis?userId=<uuid>`
- **Response**:
  ```json
  {
    "success": true,
    "data": { "savingsRate": 0.25, "monthlyAverage": 5000 }
  }
  ```

#### Financial Insights (AI Alerts)
- **Endpoint**: `POST /api/insights`
- **Request Body**:
  ```json
  { "userId": "uuid" }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": [ { "type": "daily", "content": "..." }, ... ]
  }
  ```

---

### Financial Goals (CRUD)

All Goal endpoints use `POST` and expect the ID in the body.

#### List Goals
- **Endpoint**: `POST /api/goals/list`
- **Request Body**:
  ```json
  { "userId": "uuid" }
  ```
- **Response**:
  ```json
  { "success": true, "data": [ { "id": "...", "title": "Buy a car" }, ... ] }
  ```

#### Create Goal
- **Endpoint**: `POST /api/goals/create`
- **Request Body**:
  ```json
  {
    "userId": "uuid",
    "title": "New Car",
    "targetAmount": 200000,
    "currentAmount": 5000,
    "userExpectedDate": "2027-01-01T00:00:00Z"
  }
  ```
- **Response**:
  ```json
  { "success": true, "data": { "id": "...", "title": "New Car" } }
  ```

#### Goal Detail
- **Endpoint**: `POST /api/goals/detail`
- **Request Body**:
  ```json
  { "userId": "uuid", "id": "goal-uuid" }
  ```
- **Response**:
  ```json
  { "success": true, "data": { "id": "...", "title": "..." } }
  ```

#### Update Goal
- **Endpoint**: `POST /api/goals/update`
- **Request Body**:
  ```json
  {
    "userId": "uuid",
    "id": "goal-uuid",
    "currentAmount": 10000,
    "status": "active"
  }
  ```

#### Delete Goal
- **Endpoint**: `POST /api/goals/delete`
- **Request Body**:
  ```json
  { "userId": "uuid", "id": "goal-uuid" }
  ```

---

### AI Chat & Conversations

#### Send Chat Message
- **Endpoint**: `POST /api/chat/send`
- **Request Body**:
  ```json
  {
    "userId": "uuid",
    "conversationId": "uuid",
    "message": "How can I save more money?"
  }
  ```
- **Response**:
  ```json
  { "assistantMessage": { "content": "You can start by..." } }
  ```

#### Create New Conversation
- **Endpoint**: `POST /api/chat/new`
- **Request Body**:
  ```json
  { "userId": "uuid", "title": "Optional Title" }
  ```

#### List All Conversations
- **Endpoint**: `POST /api/chat/list`
- **Request Body**:
  ```json
  { "userId": "uuid" }
  ```
- **Description**: Returns all conversations. The `title` field automatically reflects the **first user message** sent in that conversation.

#### Get Conversation Turns
- **Endpoint**: `POST /api/chat/:conversationId/turns`
- **Request Body**:
  ```json
  { "userId": "uuid", "limit": 50 }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": [ { "user": "Hello", "assistant": "Hi there!" }, ... ]
  }
  ```

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
