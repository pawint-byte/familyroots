# FamilyRoots - Family Tree Management Application

## Overview

FamilyRoots is a full-stack web application for creating, managing, and visualizing interactive trees. It supports diverse community structures beyond traditional family trees, such as church groups, sports teams, and professional networks. The platform enables users to anchor themselves across multiple tree types, each with unique relationship types and terminology. The project's core vision is to provide a collaborative, privacy-aware, and securely authenticated platform for visualizing various groups, fostering connections, and preserving legacies. It offers advanced features like nested sub-groups, tree splitting, cloning, selective merged views, and an AI-powered assistant, aiming to be a comprehensive solution for community and legacy management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
The frontend is built with React 18, TypeScript, and Wouter for routing. Styling is managed with Tailwind CSS, supporting light/dark modes, and utilizing shadcn/ui components for a consistent design. The aesthetic is inspired by Ancestry.com and Linear, using Inter and Merriweather fonts.

### Technical Implementation
The backend uses Node.js, Express.js, and TypeScript, providing RESTful API endpoints. Authentication is handled via Replit Auth (OpenID Connect) with Passport.js and PostgreSQL for session management. Data is stored in PostgreSQL, with Drizzle ORM and drizzle-zod for schema validation. The application supports internationalization (English, Spanish, French, German) and PWA features.

### Core Features

-   **Multi-Tree Type Support**: Configurable relationship types, terminology, and visual layouts for various tree types (e.g., family, church, sports, professional).
-   **Tree Management**: Supports nested sub-groups, splitting trees, cloning trees, and selective merging of connected trees.
-   **Visualization**: Employs a rescue pass for unplaced members and provides unique visual layouts and styling per tree type.
-   **Authentication & Collaboration**: Secure login, role-based access (Viewer, Editor, Co-owner), and tree sharing capabilities.
-   **Profile Management**: Members can claim and manage profiles, record events, and track history. Includes a custodianship system for deceased members and cross-tree profile synchronization with conflict resolution.
-   **Privacy & Security**: Three-tier visibility controls, per-member overrides, a "Deadman Switch" for tree inheritance, and profile claiming/disassociation features.
-   **Community & Discovery**: Opt-in discoverable community trees, location sharing, and a "Network Overview."
-   **Merchandise & Customization**: Integration with Printful for custom merchandise, including tree prints and QR codes.
-   **QR Code Sharing**: Facilitates sharing of app links, profiles, and tree invitations.
-   **Referral System**: Tracks user referrals and provides referral codes.
-   **Tree & Member Tagging**: Customizable color-coded tags for trees and members, supporting bulk assignment and actions like filtering, creating trees from tags, and emailing tagged groups.
-   **Upcoming Event Indicators**: Member cards display badges for upcoming birthdays and active gift registries.
-   **Tiered Pricing System**: A 4-tier subscription model (Explorer, Cultivator, Heritage, Legacy) with free members, unlimited tree creation, and tiered usage limits for features like AI Chat, FamilySearch Import, Group Email, AI Avatar Video, and Media Upload. Additional member packs are available for purchase.
-   **Memory Lane**: A story feed within each tree for sharing memories and milestones with photo attachments.
-   **Voice Notes**: Audio recording functionality on member profiles.
-   **Annual Tree Report**: Yearly statistics dashboard showing member counts, relationship breakdowns, and growth trends.
-   **User Engagement**: Includes member muting, life event broadcasting, and a "Membership Badge."
-   **Connection Request Routing**: Connection requests carry full tree context, allowing users to specify target trees and providing clear status tracking and management for both incoming and outgoing requests. In-tree connection invites simplify the process for recipients.
-   **Clone Tree**: Duplicate a tree via `POST /api/trees/:id/clone`, creating a full copy with new member UUIDs, remapped relationships, and copied tags.
-   **Save & Restore Layout**: Node positions persisted via `PATCH /api/trees/:treeId/members/positions` (batch update). FamilyTreeVisualization restores saved `customPosition` on load. "Save Layout" button appears when nodes have been dragged.
-   **Selective Member Import**: Connected tree import uses a member-picker with checkboxes. `GET /api/trees/:treeId/connections/:connectionId/available-members` returns source members with relationship badges, immediate relative IDs, already-imported flags, source relationships, and connector member IDs. Import endpoint accepts explicit `memberIds[]` array.
-   **Real-time Import Preview**: Ghost preview nodes appear on the tree visualization as members are selected for import. Positioned via BFS from connector member. Green dashed SVG connection lines drawn between preview nodes.
-   **Selective Connected Tree Merge**: Users select which connected trees to overlay via checkboxes. Backend accepts `?treeIds=` query param on `GET /api/trees/:treeId/merged`.
-   **Visualization Rescue Pass**: Iterative rescue pass places unplaced members with relationships to already-placed members before falling into "No Relationship Defined" section.

## External Dependencies

-   **Database**: PostgreSQL
-   **Authentication**: Replit OpenID Connect provider
-   **AI**: OpenAI (via Replit AI Integrations)
-   **Email**: Resend
-   **Video Generation**: HeyGen API
-   **Payments**: Stripe
-   **Print-on-Demand**: Printful API
-   **Genealogy Research**: FamilySearch API (Beta environment) with a robust conflict detection and resolution system for importing ancestry data, involving a 7-phase true-sync approach for merging, skipping, and keeping members and their associated data.
-   **NPM Packages**: Radix UI, Tailwind CSS, react-hook-form, zod, @tanstack/react-query, drizzle-orm, passport, openid-client, express-session, connect-pg-simple, html-to-image, react-leaflet.