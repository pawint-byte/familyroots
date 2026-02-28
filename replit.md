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
-   **Merchandise & Customization**: Integration with Printful (store ID 17783050) for custom merchandise. Frontend captures tree visualization as PNG via Canvas API, uploads to object storage, and sends real image URLs to Printful. Supports multiple print elements per product: tree image, QR code, custom uploaded image, and custom text — each with configurable placement. Backend shared helpers in `server/merchandiseHelpers.ts` handle QR generation, text-to-image rendering, and file assembly. Pricing managed via `server/merchandisePricing.ts`: 100% product markup, 20% shipping buffer, US state sales tax table (fallback to highest rate 9.55% for unknown states). Failed orders show error details with retry button (`POST /api/merchandise/orders/:id/retry`). Confirmation emails sent via shared helper on all payment paths (webhook, confirm-payment, retry). **Seamless checkout**: single-item orders auto-create Stripe session and redirect immediately; returning from Stripe auto-confirms and submits to Printful. **Shopping cart**: multi-item cart with "Add to Cart" + "Buy Now" buttons, cart drawer dialog with item list/removal/shipping form, 10% bulk discount at 3+ total items (`QUANTITY_DISCOUNT_THRESHOLD=3`, `QUANTITY_DISCOUNT_PERCENT=10`), quantity limit 100 (`MAX_ITEM_QUANTITY=100`). Cart checkout via `POST /api/merchandise/cart/checkout` creates one Stripe session for all items. Cart confirm via `POST /api/merchandise/cart/confirm-payment`. Order history groups cart orders by `cartSessionId` and shows discount amounts. Webhook handler (`server/webhookHandlers.ts`) supports both `merchandise` and `merchandise_cart` session types via shared `processOrderToPrintful` helper. **Visual Print Designer**: Interactive drag-and-resize canvas editor (`client/src/components/print-designer.tsx`) using `react-rnd`. Canvas proportions match the selected product/variant (poster sizes, mug wraps, shirt fronts, etc.). Each enabled element (tree image, QR code, custom image, custom text) appears as a draggable, resizable layer with z-order controls and visibility toggles. "Save Layout" flattens all visible layers into a single print-ready PNG at full print resolution using Canvas API, uploads to object storage, and sends one composited image to Printful per placement zone. Backend `buildPrintfulFiles` detects `isComposited` flag and sends only the single composited file. "Open Print Designer" button appears in the product preview area after elements are captured/generated. Backwards compatible — orders without compositing still send individual files.
-   **QR Code Sharing**: Facilitates sharing of app links, profiles, and tree invitations.
-   **Referral System**: Tracks user referrals and provides referral codes.
-   **Tree & Member Tagging**: Customizable color-coded tags for trees and members, supporting bulk assignment and actions like filtering, creating trees from tags, and emailing tagged groups.
-   **Upcoming Event Indicators**: Member cards display badges for upcoming birthdays and active gift registries.
-   **Tiered Pricing System**: A 4-tier subscription model (Explorer, Cultivator, Heritage, Legacy) with free members, unlimited tree creation, and tiered usage limits for features like AI Chat, FamilySearch Import, Group Email, AI Avatar Video, Media Upload, and Voice & Video Upload. Additional member packs are available for purchase. Voice notes and video attachments require Cultivator tier or above (explorer: 0, cultivator: 20/mo, heritage: 80/mo, legacy: 200/mo).
-   **Memory Lane**: A story feed within each tree for sharing memories and milestones with photo attachments. Video/audio attachments in memories are gated behind the `voice_video_upload` feature; photo-only memories use the `media_upload` feature.
-   **Voice Notes**: Audio recording functionality on member profiles. Requires paid subscription (Cultivator+). Free users see a locked/upgrade prompt. Voice notes are limited to 5 minutes and 25MB per file.
-   **Annual Tree Report**: Yearly statistics dashboard showing member counts, relationship breakdowns, and growth trends.
-   **User Engagement**: Includes member muting, life event broadcasting, and a "Membership Badge."
-   **Connection Request Routing**: Connection requests carry full tree context, allowing users to specify target trees and providing clear status tracking and management for both incoming and outgoing requests. In-tree connection invites simplify the process for recipients.
-   **Clone Tree**: Duplicate a tree via `POST /api/trees/:id/clone`, creating a full copy with new member UUIDs, remapped relationships, and copied tags.
-   **Save & Restore Layout**: Node positions persisted via `PATCH /api/trees/:treeId/members/positions` (batch update). FamilyTreeVisualization restores saved `customPosition` on load. "Save Layout" button appears when nodes have been dragged.
-   **Selective Member Import**: Connected tree import uses a member-picker with checkboxes. `GET /api/trees/:treeId/connections/:connectionId/available-members` returns source members with relationship badges, immediate relative IDs, already-imported flags, source relationships, and connector member IDs. Import endpoint accepts explicit `memberIds[]` array.
-   **Real-time Import Preview**: Ghost preview nodes appear on both FamilyTreeVisualization and GroupVisualization as members are selected for import. Family trees use BFS positioning from connector member; group visualizations position previews near connected existing members. Green dashed SVG connection lines drawn between preview nodes.
-   **Selective Connected Tree Merge**: Users select which connected trees to overlay via checkboxes. Backend accepts `?treeIds=` query param on `GET /api/trees/:treeId/merged`.
-   **Visualization Rescue Pass**: Iterative rescue pass places unplaced members with relationships to already-placed members before falling into "No Relationship Defined" section.
-   **Relationship Soft-Delete & Recovery**: Relationships now have a `deletedAt` column. When a member is soft-deleted, their relationships are soft-deleted too. Restoring a member also restores all their relationships. The "Recently Deleted" dialog shows birth/death dates, relationship badges, and saved relationship counts. The restore endpoint returns details about recovered relationships.
-   **Member Pool / Network Reuse**: `GET /api/trees/:treeId/member-pool?search=` searches all members across user's own trees and connected users' accessible trees. `POST /api/trees/:treeId/member-pool/import` copies selected members (with inter-relationships) into the target tree. "From Network" button in tree view header opens a search dialog to find and import existing members without re-entering data.
-   **CSV Bulk Upload**: Download a tree-type-specific CSV template via `GET /api/trees/:treeId/bulk-upload/template`. Template includes correct relationship types and example rows for all 8 tree types (family, church, sports, fraternity, friends, professional, school, custom). Simplified to essentials: row_id, first_name, last_name, email, related_to_row_id, relationship_type, qualifier. Upload via `POST /api/trees/:treeId/bulk-upload` with `{ csvData }`. Auto-creates reverse relationships. Supports quoted CSV fields. Component: `bulk-upload-dialog.tsx`.
-   **Non-Family Tree Claimed Member Protection**: In non-family tree types, when a member has claimed their profile, the tree owner can only edit tree-structure fields (visibility, position, pool sharing, notes) but cannot modify the claimed member's personal data (name, email, birth date, photo, etc.). The claimed member retains full control over their own personal information.
-   **Pool Update Notifications**: When a shared pool member is edited, notifications are sent to all trees that imported a copy of that member. Recipients see a diff of changed fields and can accept (apply changes to their copy) or dismiss (keep their version). Endpoints: `GET /api/pool-updates`, `PATCH /api/pool-updates/:id/accept`, `PATCH /api/pool-updates/:id/dismiss`. Component: `pool-updates.tsx`.
-   **Member Radar**: Members-only proximity discovery feature. Users opt into "Broadcast" (visible + can see others) or "Watch" (see others but stay hidden) mode. Uses browser Geolocation API with 30-second polling. Sessions auto-expire after 5 minutes of inactivity. Haversine distance formula for nearby member detection within configurable radius (1-50 miles). Endpoints: `POST /api/radar/activate`, `PATCH /api/radar/position`, `POST /api/radar/deactivate`, `GET /api/radar/status`, `GET /api/radar/nearby`. Table: `radar_sessions`. Page: `client/src/pages/radar.tsx`.

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