# FamilyRoots - Family Tree Management Application

## Overview

FamilyRoots is a full-stack web application for creating, managing, and visualizing interactive family trees. It allows users to build comprehensive family histories with detailed profiles, define relationships, and explore ancestry through dynamic timelines. The platform emphasizes user collaboration, robust privacy controls, and secure authentication, aiming to be a leading tool for genealogical research and connection.

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
- **Custom Merchandise**: Order custom products with family tree prints via Printful integration, with Stripe checkout.
- **QR Code Sharing**: Share page with scannable QR code for app linking, download, and native sharing.
- **Personal Profile QR Codes**: Unique QR codes for users' public profiles to facilitate in-person connection requests with specified relationships.
- **Tiered Subscription Discounts**: Dynamic pricing based on total family members across all trees, including milestone payments for larger trees.
- **Selective Branch Import**: Control which members from connected trees count towards subscription tiers, with scope options and preview.
- **FamilySearch Integration**: OAuth-based integration for searching historical records and attaching sources (optional).
- **Comparison Page**: Marketing page comparing FamilyRoots features against Ancestry.
- **Progressive Web App (PWA)**: Full PWA support for mobile installation and offline caching.
- **Google Analytics**: Optional integration for user engagement tracking.
- **Automatic Maintenance Mode**: User-friendly maintenance page displayed during server unavailability with auto-retry.
- **My Family Connections**: Dashboard section displaying approved user-to-user connections with relationship badges.
- **Single Source of Truth (Profile Sync)**: Claimed users manage their canonical profile, syncing personal data across all claimed profiles in family trees.

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