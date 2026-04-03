# vThink Timesheet Management — Full Stack

A production-ready timesheet management system built with the OMS Architecture Blueprint stack.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS v4 |
| **State Management** | Zustand (persisted auth) |
| **HTTP Client** | Axios with JWT interceptors |
| **Backend** | NestJS + TypeScript |
| **ORM** | Prisma (type-safe) |
| **Database** | PostgreSQL |
| **Auth** | Passport.js + JWT (24h) + RBAC Guards |
| **API Docs** | Swagger / OpenAPI (auto-generated) |
| **Validation** | class-validator + class-transformer |

## Project Structure

```
vthink-fullstack/
├── vthink-api/          # NestJS Backend
│   ├── prisma/
│   │   ├── schema.prisma    # Full DB schema with relations
│   │   └── seed.ts          # Demo data seeder
│   └── src/
│       ├── modules/
│       │   ├── auth/        # JWT + Passport auth
│       │   ├── projects/    # Project lookup (linkable from ERP)
│       │   ├── tasks/       # Task management
│       │   ├── assignments/ # Employee-task assignments
│       │   ├── timesheets/  # Timesheet CRUD + approval workflow
│       │   ├── users/       # Employee directory
│       │   └── dashboard/   # Stats aggregation
│       └── common/
│           ├── guards/      # JwtAuthGuard + RolesGuard
│           ├── filters/     # Global exception filter
│           └── decorators/  # @CurrentUser, @Roles
└── vthink-ui/           # React Frontend
    └── src/
        ├── services/api.ts  # Typed Axios API layer
        ├── store/authStore  # Zustand auth state
        └── app/components/  # All screens
```

## Database Schema

```
User ─────────────┐
  │               │
  ├── Task (created_by)
  ├── TaskAssignment (employee + assigned_by)
  └── Timesheet (employee + approved_by)
       └── TimesheetEntry ── Task ── Project
```

**Future integrations**: The `Project` table's `code` field (e.g. `GT01-PRJ-001`) and `User` table's `employeeId` field are designed to link with external ERP/HR systems. Add foreign-key references or API sync jobs to pull live data from those systems.

## Prerequisites

- **Node.js** 20+ LTS
- **PostgreSQL** 14+ running locally
- **npm** 9+

## Setup Instructions

### 1. Database Setup

```sql
-- In psql or pgAdmin:
CREATE DATABASE vthink_timesheet;
```

### 2. Backend (vthink-api)

```cmd
cd vthink-api

# Copy env and update DATABASE_URL
copy .env.example .env

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations (creates all tables)
npx prisma migrate dev --name init

# Seed demo data
npx prisma db seed

# Start backend
npm run start:dev
```

Backend runs on: **http://localhost:3000**
Swagger docs at: **http://localhost:3000/api/docs**

### 3. Frontend (vthink-ui)

```cmd
cd vthink-ui

# Install dependencies
npm install

# Start frontend
npm run dev
```

Frontend runs on: **http://localhost:5173**

## Environment Variables

### vthink-api/.env

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vthink_timesheet?schema=public"
JWT_SECRET="your-super-secret-key"
JWT_EXPIRES_IN="24h"
JWT_REFRESH_SECRET="your-refresh-secret-key"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=3000
CORS_ORIGINS="http://localhost:5173"
```

### vthink-ui/.env

```env
VITE_API_BASE_URL=http://localhost:3000
```

## Seeded Super Admin (after `npm run seed`)

| Name | Email | Password | Role |
|------|-------|----------|------|
| Super Admin | admin@vthink.co.in | `Admin@123` | Super Admin |

Other users are created from the app by the Super Admin.

## API Endpoints

```
POST   /api/v1/auth/login              Login
GET    /api/v1/auth/me                 Current user

GET    /api/v1/projects                All active projects
GET    /api/v1/users                   All employees

POST   /api/v1/tasks                   Create task
GET    /api/v1/tasks?projectId=...     List tasks

POST   /api/v1/assignments             Assign task to employee
GET    /api/v1/assignments             List assignments

POST   /api/v1/timesheets              Save timesheet (draft)
GET    /api/v1/timesheets              List timesheets
GET    /api/v1/timesheets/pending      Pending approvals
GET    /api/v1/timesheets/week?...     My week timesheet
PUT    /api/v1/timesheets/:id/submit   Submit for approval
PUT    /api/v1/timesheets/:id/approve  Approve
PUT    /api/v1/timesheets/:id/reject   Reject

GET    /api/v1/dashboard/stats         Dashboard stats
```

## Security

- JWT Bearer tokens (24h expiry)
- RBAC guards on every protected route
- Input validation via class-validator
- CORS restricted to configured origins
- Passwords hashed with bcrypt (12 rounds)

## Linking External Systems

To pull **project codes** from an external ERP:
1. Add an `externalId` column to the `projects` table
2. Create a sync service (BullMQ job) to fetch and upsert projects from ERP API
3. Frontend auto-picks up the projects via `GET /api/v1/projects`

Same pattern applies for **employee IDs** from HR systems.
