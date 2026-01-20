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

### AI Chatbot
- Floating "Help" button on all pages that opens a chat interface
- Uses OpenAI GPT-4.1-mini via Replit AI Integrations (no API key required)
- Provides genealogy assistance, app guidance, and family history help
- Streaming responses via Server-Sent Events (SSE)
- Components: `client/src/components/chatbot.tsx`, `server/chatbot.ts`

### Internationalization (i18n)
- Built-in multi-language support for English, Spanish, French, and German
- Language context with React Context API and localStorage persistence
- Auto-detects browser language preference on first visit
- Language switcher component in navigation headers using text codes (EN, ES, FR, DE)
- Core files:
  - `client/src/lib/i18n.tsx`: Language context, translations, and helper hooks
  - `client/src/components/language-switcher.tsx`: Dropdown language selector component
- Translated pages: Landing page, Gifts page
- Access translations via `useLanguage()` hook: `const { t, language, setLanguage } = useLanguage();`

### HeyGen Video Generation
- Admin interface at `/admin/videos` for AI avatar video creation
- Integrates with HeyGen API for avatar/voice selection and video generation
- Videos stored in `generated_videos` table with status tracking (pending, processing, completed, failed)
- Public video page at `/video/:id` with rich social media meta tags
- Server-side rendering of Open Graph/Twitter meta tags for social media crawlers
- Bluesky integration for sharing videos with rich previews
- Environment secrets required: `HEYGEN_API_KEY`, `BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD`
- Core files:
  - `server/heygen.ts`: HeyGen API integration
  - `server/bluesky.ts`: Bluesky posting integration
  - `client/src/pages/admin-videos.tsx`: Admin video management page
  - `client/src/pages/video.tsx`: Public video playback page

### SEO Implementation
- Client-side SEO component updates meta tags, Open Graph, and Twitter cards
- Page-specific SEO for landing, dashboard, pricing, and tree view pages
- JSON-LD structured data for Organization schema
- Component: `client/src/components/seo.tsx`

### Photo Uploads
- Uses Replit Object Storage with presigned URL flow for secure uploads
- Two-step upload process: request presigned URL → upload directly to storage
- Photos stored privately and served via object storage URLs
- Hook: `client/src/hooks/use-upload.ts`
- Component: Photo upload UI integrated in `client/src/components/member-form.tsx`
- Routes: `server/replit_integrations/object_storage/routes.ts`

### Gifts & Products Page
- Curated collection of family tree related products (ornaments, wall art, memory books, jewelry)
- Links to external marketplaces (Etsy, Amazon)
- Accessible from landing page navigation
- Page: `client/src/pages/gifts.tsx`

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
- **AI**: @replit/ai (OpenAI integration via Replit AI Integrations)
- **Payments**: Stripe for subscription management

### Development Tools
- Vite dev server with HMR
- Replit-specific plugins for development (cartographer, dev-banner, error overlay)
- esbuild for production server bundling