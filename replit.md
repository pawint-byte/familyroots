# FamilyRoots - Family Tree Management Application

## Overview

FamilyRoots is a full-stack web application designed for creating, managing, and visualizing interactive family trees. It empowers users to build comprehensive family histories with detailed member profiles, define intricate relationships, and explore their ancestry through dynamic timelines. The platform emphasizes user collaboration, robust privacy controls, and secure user authentication, aiming to be a leading tool for genealogical research and connection.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend is built with React 18 and TypeScript, using Wouter for routing, TanStack React Query for server state, and React Context for UI state. Styling is managed with Tailwind CSS, supporting light/dark modes through CSS custom properties. shadcn/ui components, based on Radix UI primitives, provide a consistent design system, with Vite as the build tool. The design aesthetic is inspired by Ancestry.com's genealogy UX and Linear's modern approach, using Inter and Merriweather fonts.

### Backend
The backend utilizes Node.js with Express.js and TypeScript, employing ES modules. It provides RESTful API endpoints and integrates Replit Auth for authentication via OpenID Connect with Passport.js. Sessions are managed using PostgreSQL.

### Data Storage
PostgreSQL serves as the primary database, with Drizzle ORM and drizzle-zod for schema validation. Key tables include `family_trees`, `family_members`, `relationships`, `tree_collaborators`, `tree_invitations`, `name_history`, `tree_connections`, `family_events`, `sessions`, and `users`.

### Core Features

- **Authentication**: Replit Auth with OpenID Connect for secure login, sessions stored in PostgreSQL.
- **Collaboration System**: Users can share family trees with defined roles (Viewer, Editor, Co-owner) via invitation links with optional expiration and usage limits. Tree connections allow linking co-owned trees.
- **Profile Claiming**: Family members can claim their own profiles within trees they don't own. Once approved by the tree owner, claimed users can edit their personal details (name, photo, bio, dates) directly without needing tree-level edit permissions. Tree owners see pending claims on their dashboard and can approve or deny requests.
- **Life Events Recording**: Record significant life events for family members including births, deaths, marriages, divorces, graduations, achievements, and milestones. Events support dates, descriptions, locations, and media attachments (photos/videos). Opt-in email notifications notify tree collaborators when events are recorded based on their notification preferences.
- **Custodianship System**: Direct relatives (parent, child, spouse, sibling) can request custodianship of deceased family members' profiles. Requests have a 30-day approval window with email reminders at days 7, 14, 21, and 28. If no action is taken, requests are auto-approved. Custodians have limited edit permissions (name, death date, notes, photo) to maintain the member's memorial profile.
- **Privacy Visibility Controls**: Three-tier privacy system controlling how much information is visible to non-immediate family members:
  - Full Access: All details visible (dates, locations, photos, notes, life events)
  - Extended Family View: Name, relationship, birth year, and photo only
  - Limited: Name and relationship only
  - Immediate family (parents, children, spouse, siblings) always has full access
  - Tree owners set the default visibility tier; per-member overrides can be set
- **Special Connections System**: Enables adding non-blood relationships between family members including:
  - Godparents/godchildren, boyfriends/girlfriends, fiances, best friends, family friends
  - Mentors/mentees, guardians/wards, and custom "other" connections
  - Cross-tree connection requests with approval workflow
  - Network discovery to see connections of connections with limited privacy info
- **Location Sharing**: Optional location fields (city, region, country) on member profiles:
  - Opt-in visibility toggle to share location with connections
  - Network page with location-based search for finding family when traveling
  - Limited info display for privacy (last name initial only for non-connections)
- **Deadman Switch (Account Heir)**: Allows users to designate an heir to inherit their family trees after a configurable period of inactivity, ensuring the preservation of genealogical data.
- **Smart Family Member Matching**: A privacy-focused, opt-in feature that enables cross-tree matching to discover shared family connections based on user-controlled data points. Matching uses a weighted scoring algorithm.
- **Dynamic Relationship Calculator**: Utilizes a BFS algorithm to determine the genealogical relationship between any two family members within a tree, providing accurate terminology (e.g., cousins "once removed").
- **Education & Career History**: Enables detailed tracking of education and employment records for each family member, displayed within their profiles.
- **AI Chatbot**: A floating chatbot powered by OpenAI GPT-4.1-mini (via Replit AI Integrations) offering genealogy assistance, app guidance, and family history help with streaming responses.
- **Internationalization (i18n)**: Supports English, Spanish, French, and German with browser language detection and a language switcher.
- **HeyGen Video Generation**: An admin interface for creating AI avatar videos via HeyGen API, with public playback pages and social media sharing integration (Bluesky, Open Graph/Twitter meta tags).
- **SEO**: Client-side SEO for meta tags, Open Graph, Twitter cards, and JSON-LD structured data.
- **FAQ Page**: A comprehensive, categorized FAQ with expandable sections.
- **Email Service**: Uses Resend for transactional emails (welcome, invites, notifications) with invitation status tracking for family members.
- **Photo Uploads**: Secure photo uploads leveraging Replit Object Storage with a presigned URL flow.
- **Gifts & Products Page**: Curated list of family tree-related products linking to external marketplaces.
- **Tree Export**: Users can export their family tree visualization as a high-resolution PNG image with theme-aware backgrounds (white for light mode, dark for dark mode) using html-to-image library.
- **Custom Merchandise (Print-on-Demand)**: Users can order custom products (mugs, t-shirts, posters, pillows, tote bags) with their family tree printed on them via Printful integration. Features include product catalog, variant selection (size/color), Stripe checkout for payment, and order tracking. Commission is added to orders for revenue.
- **QR Code Sharing**: A share page (/share) displays a scannable QR code linking to the app, with options to copy the URL, download the QR code as PNG, or use the native share dialog on mobile devices.
- **Tiered Subscription Discounts**: Subscription pricing with automatic discounts based on total family members across all trees:
  - 0-24 members: $9.99/month (base price)
  - 25-49 members: $7.49/month (25% off)
  - 50-74 members: $4.99/month (50% off)
  - 75-99 members: $2.50/month (75% off)
  - 100+ members: FREE subscription
  - For users at 100+ members, each additional 25 members requires a $2.99 one-time payment (milestone payment)
  - Dashboard shows progress bar toward next discount tier
  - Pricing page displays all tiers with current tier highlighted
- **FamilySearch Integration**: Historical records search via FamilySearch API integration:
  - OAuth flow for connecting FamilySearch accounts (requires FAMILYSEARCH_APP_KEY environment variable)
  - Search billions of historical records (birth, marriage, death, census, immigration, military)
  - Attach record sources to family members for documentation
  - Demo mode with mock data when API credentials not configured
  - Database tables: familySearchConnections (OAuth tokens), familySearchSources (attached records)
- **Comparison Page**: Feature comparison page (/comparison) showing FamilyRoots vs Ancestry with:
  - Categorized feature matrix (Core, Research, Collaboration, Privacy, Monetization, Community)
  - Visual checkmarks and crosses for feature availability
  - Unique FamilyRoots features highlighted
  - Linked from landing page for marketing

## External Dependencies

- **Database**: PostgreSQL
- **Authentication**: Replit OpenID Connect provider
- **AI**: OpenAI via Replit AI Integrations
- **Email**: Resend
- **Video Generation**: HeyGen API
- **Social Media**: Bluesky
- **Payments**: Stripe (for subscription management and merchandise checkout)
  - Uses `stripe-replit-sync` library for automated webhook management
  - Webhooks are auto-configured at `/api/stripe/webhook` - no manual Stripe Dashboard setup required
  - Stripe data syncs automatically to PostgreSQL database
  - Accepts both card and crypto payments (Bitcoin, Ethereum, stablecoins) - settles in USD
- **Print-on-Demand**: Printful API for merchandise fulfillment
- **Genealogy Research**: FamilySearch API for historical records (optional - requires registration at developers.familysearch.org)
- **NPM Packages**: Radix UI, Tailwind CSS, react-hook-form, zod, @tanstack/react-query, drizzle-orm, passport, openid-client, express-session, connect-pg-simple, html-to-image, react-leaflet.