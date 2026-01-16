# FamilyRoots - Family Tree Management Application

## Overview

FamilyRoots is a full-stack web application for creating and managing interactive family trees. Users can build visual family trees, add family members with detailed profiles, define relationships between members, and view family history through timeline visualizations. The application supports user authentication, tree collaboration, and privacy controls.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state, React Context for UI state (theme)
- **Styling**: Tailwind CSS with CSS custom properties for theming, supporting light/dark modes
- **Component Library**: shadcn/ui components built on Radix UI primitives
- **Build Tool**: Vite with React plugin

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints under `/api/*` prefix
- **Authentication**: Replit Auth integration using OpenID Connect with Passport.js
- **Session Management**: PostgreSQL-backed sessions using connect-pg-simple

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Key Tables**:
  - `family_trees`: Tree metadata with ownership and privacy settings
  - `family_members`: Individual profiles with birth/death dates, photos, notes
  - `relationships`: Parent/child/spouse/sibling connections between members
  - `tree_collaborators`: Shared access permissions
  - `family_events`: Timeline events associated with trees
  - `sessions`: Authentication session storage
  - `users`: User accounts from Replit Auth

### Authentication Flow
- Uses Replit's OpenID Connect provider for authentication
- Sessions stored in PostgreSQL with 7-day expiry
- Protected routes use `isAuthenticated` middleware
- User data synced to local database on login via upsert pattern

### Project Structure
```
├── client/src/          # React frontend
│   ├── components/      # UI components including shadcn/ui
│   ├── hooks/           # Custom React hooks (auth, toast, mobile)
│   ├── lib/             # Utilities (queryClient, theme, utils)
│   └── pages/           # Route components (landing, dashboard, tree-view)
├── server/              # Express backend
│   ├── replit_integrations/auth/  # Replit Auth implementation
│   ├── routes.ts        # API route definitions
│   └── storage.ts       # Database access layer
├── shared/              # Shared types and schemas
│   ├── schema.ts        # Drizzle table definitions
│   └── models/auth.ts   # Auth-specific models
└── migrations/          # Drizzle database migrations
```

### Design System
- Typography: Inter (sans-serif) with Merriweather (serif) for names/dates
- Color theming via CSS custom properties supporting light/dark modes
- Consistent spacing scale using Tailwind utilities
- Component patterns following Ancestry.com genealogy UX and Linear's modern aesthetic

## External Dependencies

### Database
- PostgreSQL via `DATABASE_URL` environment variable
- Drizzle Kit for schema migrations (`npm run db:push`)

### Authentication
- Replit OpenID Connect provider (`ISSUER_URL` defaults to `https://replit.com/oidc`)
- Requires `REPL_ID` and `SESSION_SECRET` environment variables

### Key NPM Packages
- **UI**: Radix UI primitives, Tailwind CSS, class-variance-authority
- **Forms**: react-hook-form with zod validation
- **Data**: @tanstack/react-query, drizzle-orm
- **Auth**: passport, openid-client, express-session, connect-pg-simple

### Development Tools
- Vite dev server with HMR
- Replit-specific plugins for development (cartographer, dev-banner, error overlay)
- esbuild for production server bundling