# Copilot Instructions for Kochi Metro Train Induction Planning System

This document provides essential guidelines for AI coding agents to effectively contribute to the Kochi Metro Train Induction Planning System.

## 1. Project Overview

The Kochi Metro Train Induction Planning System is a comprehensive application for managing train information and daily operational data. It is built with a modern web stack and integrates with Supabase for its backend.

**Key Features:**
- Train Information Management (ID, model, status)
- CSV Upload for bulk data entry
- Daily Operational Data management (fitness certificates, job cards, mileage, cleaning status)
- Admin Dashboard for comprehensive management
- Data Visualization with charts and reports

## 2. Architecture and Data Flow

The application follows a client-server architecture:
- **Frontend**: Built with React, TypeScript, Vite, shadcn-ui, and Tailwind CSS. Located in the `src/` directory.
- **Backend/Database**: Supabase, with migrations managed in `supabase/migrations/`.
- **Data Flow**:
    - User interactions on the frontend trigger API calls to Supabase.
    - Data is stored and retrieved from the Supabase PostgreSQL database.
    - CSV uploads are handled by the frontend and then processed for database insertion.

**Key Directories:**
- `src/pages/`: Contains the main application pages (e.g., `Admin.tsx`, `Dashboard.tsx`, `Upload.tsx`).
- `src/components/`: Reusable UI components, including `CSVUpload.tsx` and `TrainInfoForm.tsx`.
- `src/hooks/`: Custom React hooks for data fetching and state management (e.g., `useSupabaseData.ts`).
- `src/integrations/supabase/`: Supabase client configuration and related utilities.
- `supabase/migrations/`: Database schema migration files.

## 3. Development Workflow

### 3.1. Setup

1.  **Clone Repository**: `git clone <YOUR_GIT_URL>`
2.  **Install Dependencies**: `npm i`
3.  **Environment Variables**: Create a `.env` file with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4.  **Database Setup**: `npm run setup-db` (runs migrations from `supabase/migrations/`)
5.  **Start Development Server**: `npm run dev`

### 3.2. Code Conventions

-   **TypeScript**: Adhere to strict TypeScript typing.
-   **React Components**: Functional components with hooks.
-   **Styling**: Utilize Tailwind CSS for utility-first styling. `shadcn-ui` components are used for pre-built UI elements.
-   **Supabase Interactions**: Use the `src/integrations/supabase/` module for all Supabase client interactions. Custom hooks in `src/hooks/useSupabaseData.ts` should be used for data fetching and mutations where applicable.

### 3.3. Database Migrations

-   Database schema changes are managed through Supabase migrations.
-   New migrations should be created in `supabase/migrations/` with a timestamp prefix.
-   To apply migrations, run `npm run setup-db`.

## 4. Important Files and Patterns

-   `src/App.tsx`: Main application entry point and routing.
-   `src/main.tsx`: React root rendering.
-   `src/components/CSVUpload.tsx`: Handles CSV file uploads and parsing.
-   `src/components/TrainInfoForm.tsx`: Form for adding/editing train information.
-   `src/hooks/useSupabaseData.ts`: Example of a custom hook for interacting with Supabase.
-   `supabase/migrations/*.sql`: SQL migration files defining the database schema.

## 5. External Dependencies

-   **Supabase**: Backend-as-a-Service for database, authentication, and storage.
-   **Vite**: Frontend build tool.
-   **React**: JavaScript library for building user interfaces.
-   **Tailwind CSS**: Utility-first CSS framework.
-   **shadcn-ui**: Reusable components built with Tailwind CSS and Radix UI.

## 6. Testing

(No explicit testing framework or scripts were discovered in the initial analysis. If tests exist, please update this section.)

## 7. Troubleshooting

-   **"Table not found" errors**: Run `npm run setup-db` to apply database migrations.
-   **Environment variables**: Ensure `.env` file is correctly configured with Supabase credentials.
