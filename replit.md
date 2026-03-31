# FamilyRoots - Family Tree Management Application

## Overview
FamilyRoots is a full-stack web application designed for creating, managing, and visualizing interactive trees. It supports diverse community structures beyond traditional family trees, including church groups, sports teams, and professional networks. The platform allows users to anchor themselves across multiple tree types, each with unique relationship types and terminology. The core vision is to provide a collaborative, privacy-aware, and securely authenticated platform for visualizing various groups, fostering connections, and preserving legacies, offering features like nested sub-groups, tree splitting, cloning, selective merged views, and an AI-powered assistant.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
The frontend is built with React 18, TypeScript, and Wouter for routing. Styling uses Tailwind CSS, supporting light/dark modes, and shadcn/ui components. The design is inspired by Ancestry.com and Linear, utilizing Inter and Merriweather fonts.

### Technical Implementation
The backend uses Node.js, Express.js, and TypeScript, providing RESTful API endpoints. Authentication combines Replit Auth (OpenID Connect) and email/password authentication using Node's built-in scrypt for hashing. Email verification and password reset functionalities are implemented with token-based mechanisms. Sessions are managed with `express-session` and `connect-pg-simple` for PostgreSQL storage. Data persistence uses PostgreSQL with Drizzle ORM and drizzle-zod for schema validation. The application supports internationalization (English, Spanish, French, German) and PWA features.

### Core Features
-   **Multi-Tree Type Support**: Configurable relationship types, terminology, and visual layouts for various tree types.
-   **Tree Management**: Supports nested sub-groups, splitting, cloning, and selective merging of trees.
-   **Visualization**: Employs a rescue pass for unplaced members and provides unique visual layouts.
-   **Authentication & Collaboration**: Secure login, role-based access (Viewer, Editor, Co-owner), and tree sharing.
-   **Auto-Redirect to Tree**: Logged-in users landing at `/` are automatically redirected to their most recently updated tree. Users with no trees stay on the dashboard. Explicit `/dashboard` always shows the full dashboard.
-   **Profile Management**: Members can claim and manage profiles, record events, track history, and utilize a custodianship system.
-   **Privacy & Security**: Three-tier visibility controls, per-member overrides, and a "Deadman Switch" for tree inheritance.
-   **Community & Discovery**: Opt-in discoverable community trees, location sharing, and a "Network Overview."
-   **Merchandise & Customization**: Integration with Printful for custom merchandise, supporting canvas-based visual print designer for composited print-ready images, and a shopping cart with bulk discounts.
-   **QR Code Sharing**: Facilitates sharing of app links, profiles, and tree invitations.
-   **Referral System**: Tracks user referrals and provides referral codes.
-   **Tree & Member Tagging**: Customizable color-coded tags for filtering and actions.
-   **Upcoming Event Indicators**: Member cards display badges for upcoming birthdays and active gift registries.
-   **Tiered Pricing System**: A 4-tier subscription model (Explorer, Cultivator, Heritage, Legacy) with free members, unlimited tree creation, and tiered usage limits for features like AI Chat, FamilySearch Import, Group Email, AI Avatar Video, Media Upload, and Voice & Video Upload. Additional member packs are available for purchase.
-   **Memory Lane**: A story feed within each tree for sharing memories and milestones with multimedia attachments.
-   **Voice Notes**: Audio recording functionality on member profiles, gated by subscription tier.
-   **Annual Tree Report**: Yearly statistics dashboard for member counts, relationship breakdowns, and growth trends.
-   **User Engagement**: Includes member muting, life event broadcasting, and a "Membership Badge."
-   **Connection Request Routing**: Manages connection requests with full tree context, clear status tracking, and in-tree invitation support.
-   **Clone Tree**: Duplicates a tree with new member UUIDs and remapped relationships.
-   **Save & Restore Layout**: Persists and restores node positions in visualizations.
-   **Selective Member Import**: Allows importing selected members from connected trees with a member picker and real-time preview.
-   **Selective Connected Tree Merge**: Enables overlaying selected connected trees in visualizations.
-   **Relationship Soft-Delete & Recovery**: Implements soft-deletion and recovery for members and their relationships.
-   **Member Pool / Network Reuse**: Allows searching and importing members across user's own trees and connected trees.
-   **CSV Bulk Upload**: Supports bulk import of members via tree-type-specific CSV templates.
-   **Non-Family Tree Claimed Member Protection**: Protects personal data of claimed members in non-family trees from owner edits.
-   **Pool Update Notifications**: Notifies users of changes to shared pool members and allows accepting or dismissing updates.
-   **Member Radar**: Proximity discovery feature with opt-in broadcast/watch modes and Haversine distance calculation.
-   **Personalized Branch Labels**: Generates dynamic, possessive branch labels in family tree visualizations.
-   **Affiliate Tracking**: Automatically adds affiliate tracking to gift registry product URLs from supported retailers.
-   **Production-to-Dev Sync**: Additive-only script to sync production data to dev, preventing data loss.
-   **Connection Request Notifications**: Email notifications when connection requests are sent, approved, or denied, plus automatic reminders after 3 days of inactivity.
-   **Tree Wall / Group Chat**: Real-time group messaging wall within each tree (Cultivator+ subscription required to post). Supports replies, editing, soft-delete, and auto-refresh.
-   **Annual Year-in-Review Email**: Scheduled December emails with yearly stats (trees, members, connections) and "We miss you" messaging for inactive users (90+ days).

## External Dependencies
-   **Database**: PostgreSQL
-   **Authentication**: Replit OpenID Connect provider
-   **AI**: OpenAI (via Replit AI Integrations)
-   **Email**: Resend
-   **Video Generation**: HeyGen API
-   **Payments**: Stripe (with webhook integration)
-   **Print-on-Demand**: Printful API
-   **Genealogy Research**: FamilySearch API (Beta environment)
-   **NPM Packages**: Radix UI, Tailwind CSS, react-hook-form, zod, @tanstack/react-query, drizzle-orm, passport, openid-client, express-session, connect-pg-simple, html-to-image, react-leaflet.