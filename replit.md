# FamilyRoots - Family Tree Management Application

## Overview

FamilyRoots is a full-stack web application designed for creating, managing, and visualizing interactive trees. Initially focused on family trees, the platform has expanded to support various community structures such as church groups, sports teams, and professional networks. It allows users to anchor themselves across multiple tree types, each with its unique relationship types and terminology. The project's vision is to offer a collaborative, privacy-aware, and securely authenticated platform for diverse group visualization, fostering connections and preserving legacies.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
The frontend is built with React 18, TypeScript, and Wouter for routing. Styling is managed with Tailwind CSS, supporting light/dark modes, and utilizing shadcn/ui components for a consistent design. The aesthetic is inspired by Ancestry.com and Linear, using Inter and Merriweather fonts.

### Technical Implementation
The backend uses Node.js, Express.js, and TypeScript, providing RESTful API endpoints. Authentication is handled via Replit Auth (OpenID Connect) with Passport.js and PostgreSQL for session management. Data is stored in PostgreSQL, with Drizzle ORM and drizzle-zod for schema validation. The application supports internationalization (English, Spanish, French, German) and PWA features.

### Core Features

-   **Multi-Tree Type Support**: Supports diverse tree types (family, church, sports, etc.) with configurable relationship types, terminology, and visual layouts.
-   **Nested Sub-groups**: Allows creation of hierarchical sub-groups within trees (e.g., "Class of 2025" within a school tree). Supports re-parenting (moving existing trees under another as sub-groups) and detaching (making sub-groups standalone again) via `PATCH /api/trees/:id/parent`. Circular references are prevented by ancestry traversal check.
-   **Tree Splitting**: Owners/co-owners can split a tree by selecting members to move into a new tree via `POST /api/trees/:id/split`. Supports assigning a different owner, preserving intra-group relationships, removing cross-tree relationships, and optionally linking the trees via a tree connection. All member-scoped data (events, mutes, invitations, claims, custodianship) migrates with members.
-   **Visual Layout Per Tree Type**: Each tree type has a unique visual layout and styling, including distinct accent colors, connection line styles, and node shapes, with visual hierarchy based on relationship ranks.
-   **Authentication & Collaboration**: Secure login via Replit Auth; users can share trees with role-based access (Viewer, Editor, Co-owner).
-   **Profile Management**: Members can claim and manage their profiles, record life events, and track education/career history. A custodianship system allows relatives to manage deceased members' profiles.
-   **Privacy & Security**: Three-tier visibility controls, per-member overrides, and a "Deadman Switch" for inheritance of trees. Profile claiming and disassociation features are implemented to manage personal data.
-   **Community & Discovery**: Opt-in discoverable community trees, location sharing, and a "Network Overview" for visualizing connections across trees.
-   **AI & Integrations**: An OpenAI GPT-4.1-mini chatbot for assistance, HeyGen for AI avatar video generation, and FamilySearch integration for genealogical research.
-   **Merchandise & Customization**: Integration with Printful for custom merchandise orders, allowing extensive customization options including tree prints, QR codes, and custom text.
-   **QR Code Sharing**: Facilitates sharing of app links, profiles, and tree invitations via QR codes.
-   **Referral System**: Tracks user referrals and provides referral codes.
-   **Tree & Member Tagging**: Customizable color-coded tags for trees and members (e.g., "Class of 2025", "Chapter Alpha", "Member Since 2020"). Tags are defined at the tree level (`tree_tags` table) and can be assigned to individual members (`member_tags` join table). Supports bulk assignment via the Manage Tags dialog. Tags display on dashboard tree cards, tree view header, and member detail panels. **Tag Actions**: Filter tree view by tag (click tag in header), Create Tree from Tag (moves tagged members into new tree/sub-group via `POST /api/trees/:id/tags/:tagId/create-tree`), Email Tagged Group (sends email to tagged members via `POST /api/trees/:id/tags/:tagId/email`). Tags can be assigned during member creation. API: `GET/POST /api/trees/:id/tags`, `DELETE /api/trees/:id/tags/:tagId`, `POST /api/trees/:id/members/:memberId/tags`, `DELETE /api/trees/:id/members/:memberId/tags/:tagId`, `POST /api/trees/:id/tags/:tagId/members` (bulk).
-   **User Engagement**: Includes features like member muting, life event broadcasting, and a "Membership Badge" with user stats.

## External Dependencies

-   **Database**: PostgreSQL
-   **Authentication**: Replit OpenID Connect provider
-   **AI**: OpenAI (via Replit AI Integrations)
-   **Email**: Resend
-   **Video Generation**: HeyGen API
-   **Payments**: Stripe
-   **Print-on-Demand**: Printful API
-   **Genealogy Research**: FamilySearch API (Beta environment). Tree import uses a sub-tree approach: `POST /api/familysearch/import-as-tree` creates a new sub-tree under the target tree with all imported members and relationships. A conflict detection step (`POST /api/trees/:id/detect-conflicts`) compares imported members against existing tree members using fuzzy matching (name, birth year within 5 years, birth place, gender). Users resolve potential duplicates via a side-by-side comparison UI before connecting (`POST /api/trees/:id/resolve-conflicts`). Resolution options: merge (combine data), keep both (separate people), or skip (remove imported duplicate). Tree connections link the sub-tree to the parent tree after resolution. The original direct import endpoint (`POST /api/familysearch/import`) remains for single-person search imports. FamilySearch ancestry import fetches 4 generations up (great-great-grandparents). Visualization recursively renders all ancestor generations found in the data using `placeAncestorsRecursively`, so any depth of ancestors will be connected. All relationship types use "parent" (not "parent-child") for visualization compatibility. Great-grandparent rendering is applied both in the main parent grandparent path and the co-parent grandparent path.
-   **NPM Packages**: Radix UI, Tailwind CSS, react-hook-form, zod, @tanstack/react-query, drizzle-orm, passport, openid-client, express-session, connect-pg-simple, html-to-image, react-leaflet.