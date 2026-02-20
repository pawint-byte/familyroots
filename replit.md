# FamilyRoots - Family Tree Management Application

## Overview

FamilyRoots is a full-stack web application for creating, managing, and visualizing interactive trees for families and communities. While family trees remain the flagship, the platform now supports multiple tree types: church/faith groups, sports teams, fraternities/sororities, friend circles, professional networks, and custom groups. Each tree type has its own relationship types and terminology, with the user as the common anchor across all their trees. The platform emphasizes user collaboration, robust privacy controls, and secure authentication.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend uses React 18, TypeScript, Wouter for routing, TanStack React Query for server state, and React Context for UI state. Tailwind CSS manages styling with light/dark modes. shadcn/ui components, based on Radix UI, provide a consistent design, built with Vite. The design is inspired by Ancestry.com and Linear, using Inter and Merriweather fonts.

### Backend
The backend is built with Node.js, Express.js, and TypeScript (ES modules). It provides RESTful API endpoints and integrates Replit Auth for authentication via OpenID Connect with Passport.js. Sessions are managed using PostgreSQL.

### Data Storage
PostgreSQL is the primary database, utilizing Drizzle ORM and drizzle-zod for schema validation. Key tables store family trees, members, relationships, collaboration data, events, sessions, and user information.

### Core Features

- **Authentication**: Secure login via Replit Auth (OpenID Connect) with PostgreSQL session management.
- **Collaboration**: Users can share family trees with defined roles (Viewer, Editor, Co-owner) via invitation links and link co-owned trees.
- **Multi-Tree-Type Support**: Supports family, church, sports, fraternity/sorority, friends, professional, and custom tree types. Each type has its own relationship types and terminology. Configured via `shared/treeTypes.ts`. Schema uses `treeType`, `treeTypeLabel`, and `customRelationshipTypes` columns on `family_trees` table. The `relationships.relationship_type` column is `text` (not enum) to support dynamic types.
- **Visual Layout Per Tree Type**: Each tree type has a unique visual layout and styling. Family uses hierarchical tree layout (`family-tree-visualization.tsx`), while other types use `group-visualization.tsx` with: circle (friends/custom), radial starburst (church), grid formation (sports), arc chain (fraternity/sorority), and network graph (professional). Each type also has distinct accent colors, connection line styles (solid/dashed/dotted), and node shapes. Config stored in `shared/treeTypes.ts` under `visual` property.
- **Relationship Management**: Comprehensive control over family relationships, allowing manual additions and definitions.
- **Profile Claiming**: Family members can claim their profiles in trees they don't own, gaining limited editing rights upon owner approval.
- **Life Events Recording**: Track significant life events with dates, descriptions, locations, and media attachments, including email notifications for collaborators.
- **Custodianship System**: Direct relatives can request custodianship of deceased members' profiles, gaining limited edit permissions after an approval window.
- **Privacy Controls**: Three-tier visibility (Full Access, Extended Family View, Limited) with immediate family exceptions and per-member overrides.
- **Special Connections**: Add non-blood relationships (e.g., godparents, friends) and manage cross-tree connection requests.
- **Location Sharing**: Optional location fields with opt-in visibility and a network page for location-based discovery.
- **Deadman Switch**: Users can designate an heir to inherit their family trees after inactivity.
- **Smart Family Member Matching**: Opt-in, privacy-focused cross-tree matching for shared connections using a weighted scoring algorithm.
- **Cross-Tree Person Matching**: Automatic detection of the same person across multiple trees using external IDs and name/date similarity, with a pending review system.
- **Network Connection Discovery**: Automated expansion of extended family networks when trees connect, with dashboard approval.
- **Dynamic Relationship Calculator**: Uses a BFS algorithm to determine genealogical relationships between any two family members.
- **Education & Career History**: Detailed tracking of education and employment records.
- **AI Chatbot**: An OpenAI GPT-4.1-mini powered chatbot for genealogy assistance and app guidance.
- **Internationalization (i18n)**: Supports English, Spanish, French, and German with language detection and switching.
- **HeyGen Video Generation**: Admin interface for creating AI avatar videos with public playback and social sharing.
- **SEO**: Client-side SEO for meta tags, Open Graph, Twitter cards, and JSON-LD.
- **Email Service**: Uses Resend for transactional emails (invites, notifications).
- **Photo Uploads**: Secure photo uploads via Replit Object Storage with presigned URLs.
- **Tree Export**: Export family tree visualizations as high-resolution PNG images with theme-aware backgrounds.
- **Custom Merchandise**: Order custom products with family tree prints via Printful integration, with Stripe checkout. Features a "Popular Picks" quick-order section with Premium Fleece Blanket as flagship product, tree-type-aware previews on product mockups, and optional personal QR code embedding on products.
- **QR Code Sharing**: Share page with scannable QR code for app linking, download, and native sharing.
- **Personal Profile QR Codes**: Unique QR codes for users' public profiles to facilitate in-person connection requests with specified relationships.
- **Tiered Subscription Discounts**: Dynamic pricing based on total family members across all trees, including milestone payments for larger trees.
- **Selective Branch Import**: Control which members from connected trees count towards subscription tiers, with scope options and preview.
- **FamilySearch Integration**: OAuth-based integration for searching historical records, attaching sources, and importing family tree data. Features tree browser with selectable import for ancestors/descendants, duplicate detection, and sandbox mode for testing without production API key.
- **Comparison Page**: Marketing page comparing FamilyRoots features against Ancestry.
- **Progressive Web App (PWA)**: Full PWA support for mobile installation and offline caching.
- **Google Analytics**: Optional integration for user engagement tracking.
- **Reddit Pixel**: Conversion tracking for Reddit Ads campaigns (ID: a2_iepozq36wg7a). Tracks page visits and sign-up conversions.
- **Discord Integration**: Automated notifications for new signups, tree creation, and milestone achievements sent to Discord community channel.
- **Network Overview**: Visual hub showing all user's trees, expanded member grids, and cross-tree shared connections at /network-overview.
- **Life Event Broadcasting**: Cross-tree announcement system allowing users to broadcast life events from one tree to selected other trees, with email notifications to opted-in members.
- **Referral System**: User referral tracking with unique codes (format: FR{userId}{timestamp}), click tracking, and completion stats displayed on dashboard. Referral codes captured from ?ref= URL parameter and completed on signup.
- **Automatic Maintenance Mode**: User-friendly maintenance page displayed during server unavailability with auto-retry.
- **My Family Connections**: Dashboard section displaying approved user-to-user connections with relationship badges.
- **Single Source of Truth (Profile Sync)**: Claimed users manage their canonical profile, syncing personal data across all claimed profiles in family trees.
- **Membership Badge**: Downloadable/shareable digital membership card at /my-badge showing user stats (trees, members, invites), tier level (Root Starter through Legacy Builder), and embedded referral QR code. Uses html-to-image for PNG export and Web Share API for native sharing. Tiers based on total member count across all trees.

## External Dependencies

- **Database**: PostgreSQL
- **Authentication**: Replit OpenID Connect provider
- **AI**: OpenAI via Replit AI Integrations
- **Email**: Resend
- **Video Generation**: HeyGen API
- **Social Media**: Bluesky
- **Payments**: Stripe (subscription management, merchandise checkout, supports card and crypto payments)
- **Print-on-Demand**: Printful API
- **Genealogy Research**: FamilySearch API
- **NPM Packages**: Radix UI, Tailwind CSS, react-hook-form, zod, @tanstack/react-query, drizzle-orm, passport, openid-client, express-session, connect-pg-simple, html-to-image, react-leaflet.

## Critical Implementation Notes

### Family Tree Visualization (DO NOT MODIFY without testing)

The family tree visualization (`client/src/components/family-tree-visualization.tsx`) has specific requirements that must be maintained:

1. **Transform Origin**: Must be `"0 0"` (top-left) - NOT `"center center"`. This ensures SVG connection lines align with HTML member cards.

2. **Container Hierarchy** (in `tree-view.tsx`):
   - Outer container: `h-screen` (fixed height, not `min-h-screen`)
   - Add `overflow-hidden` to prevent scroll issues
   - TabsContent: `flex-1 overflow-hidden`
   - Tree container: `w-full h-full`

3. **Coordinate System**: SVG paths and HTML elements share the same coordinate space. Both use absolute positioning within the transformed container.

4. **Centering Logic**: The useEffect that centers on focusMemberId calculates offset based on container dimensions and node positions.

5. **Layout Rules** (Updated Jan 2026):
   - **Blood relatives on vertical line**: Grandparents → Parents → Focus → Children → Grandchildren
   - **Siblings**: ALL positioned to the LEFT of focus person
   - **Spouse/Partner**: Positioned to the RIGHT of focus person
   - This creates clear visual separation between bloodline and marriage connections

**Why this matters**: Changes to layout (min-h-screen vs h-screen, overflow settings, transform origin) can break the alignment between connection lines and member cards. Always test tree visualization on both desktop and mobile after any layout changes.