# Family Tree Management App - Design Guidelines

## Design Approach
**Hybrid Reference-Based**: Drawing from Ancestry.com's genealogy patterns, Notion's data organization, and Linear's modern interface aesthetics. The design balances emotional storytelling with efficient data management.

## Core Design Principles
1. **Timeless Elegance**: Design should feel enduring and respectful of family legacy
2. **Information Clarity**: Complex genealogical data presented with clear hierarchy
3. **Emotional Connection**: Visual design that honors family stories and memories
4. **Efficient Navigation**: Quick access to deep family structures

## Typography
- **Primary Font**: Inter or SF Pro Display (Google Fonts CDN)
- **Serif Accent**: Merriweather for family member names and historical dates
- **Hierarchy**:
  - H1: 3xl-4xl, serif for landing hero
  - H2: 2xl-3xl, sans-serif for section headers
  - H3: xl, medium weight for family member names
  - Body: base/lg for descriptions, notes
  - Meta: sm for dates, locations (subtle weight)

## Layout System
**Spacing Units**: Tailwind 2, 4, 6, 8, 12, 16, 24 for consistency
- Tight spacing (2-4) for related data fields
- Medium spacing (6-8) for component padding
- Generous spacing (12-16) for section separation
- Extra breathing room (24) for major layout divisions

## Component Library

### Navigation
- **Top Bar**: Fixed, slim profile (h-16), logo left, primary actions right (Search, Add Member, Account)
- **Side Panel** (Dashboard): Collapsible tree navigation (w-64 expanded, w-16 collapsed), smooth transitions
- **Breadcrumbs**: Show current position in tree hierarchy

### Tree Visualization
- **Canvas Area**: Full-screen capable, draggable background with snap-to-grid
- **Node Cards**: Rounded (rounded-lg), compact profile photo (w-16 h-16), name + dates below, relationship lines connecting
- **Interaction**: Click to expand children, right-click for quick actions, hover reveals mini-profile
- **Controls**: Floating toolbar (zoom, center, fullscreen, export) with subtle shadows

### Data Forms
- **Input Fields**: Generous height (h-12), clear labels above, inline validation
- **Date Pickers**: Custom calendar UI matching design system
- **Photo Upload**: Drag-and-drop zone (border-dashed), preview grid
- **Relationship Selector**: Visual picker with family icons

### Timeline View
- **Vertical Timeline**: Center line with alternating event cards
- **Event Cards**: Medium size (max-w-md), photo + description + date
- **Filtering Bar**: Sticky top position, quick filters for event types

### Profile Cards
- **Member Profile**: Two-column layout (photo/bio left, details right on desktop)
- **Stat Badges**: Small pills for generation number, living status, photo count
- **Quick Actions**: Icon buttons for edit, share, delete

### Authentication
- **Login/Signup**: Centered card (max-w-md), OAuth buttons prominent, form fields below
- **Security Indicators**: Lock icons, password strength meter

### Subscription/Pricing
- **Pricing Cards**: Three-column grid on desktop, feature comparison checkmarks
- **Upgrade Prompts**: Non-intrusive banners when hitting free tier limits

### Search & Filter
- **Global Search**: Expandable search bar in header, instant results dropdown
- **Advanced Filters**: Slide-out panel from right, grouped filter categories

### Notifications
- **Toast Messages**: Top-right corner, auto-dismiss
- **Birthday Alerts**: Calendar icon badge in header

## Images
**Hero Section**: Large, warm family gathering photo (full viewport width, 60vh height) with gradient overlay for text readability
**Profile Photos**: Circular avatars throughout, placeholder silhouettes for missing photos
**Timeline Events**: Support for historical photos with vintage frame treatment
**Empty States**: Custom illustrations for empty trees, encouraging first member addition

## Responsive Strategy
- **Desktop** (lg+): Full tree visualization, side-by-side layouts, multi-column grids
- **Tablet** (md): Stacked layouts, collapsible navigation
- **Mobile**: Single column, bottom navigation bar, simplified tree view (list mode)

## Key Interactions
- **Drag-to-Connect**: For adding relationships in tree view
- **Long-Press**: Mobile context menus
- **Swipe Actions**: Mobile card actions (edit/delete)
- **Smooth Transitions**: 200-300ms for state changes
- **Loading States**: Skeleton screens for data-heavy views

## Accessibility
- Semantic HTML throughout, ARIA labels on interactive tree nodes
- Keyboard navigation for entire tree (arrow keys to traverse)
- High contrast mode support
- Screen reader announcements for relationship changes