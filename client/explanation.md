# PocketNinja Frontend — Implementation Explanation (Arham Apon's Slice)

---

## Design System & Styling Initialization

### Phase Summary

This phase established the core visual identity of the frontend, strictly adhering to the "Lunch Money Aesthetic" requested.

| File | Purpose |
|------|---------|
| `src/index.css` | Initialized the design tokens (CSS variables), base layer styling, and scoped UI helper classes (`.lm-card`, `.lm-badge-gold`, `.lm-highlight`). |

### Implementation Details

#### Design Tokens (`src/index.css`)

**Colors & Typography:**
- **Canvas:** Replaced pure white with a soft warm ivory (`#FAF8F5`) for a more human, welcoming feel.
- **Card Surface:** Used pristine white (`#FFFFFF`) for cards to create a subtle contrast against the warm canvas.
- **Borders:** Implemented a soft stone border (`#E7E5E4`) rather than harsh lines.
- **Typography:** Configured `Plus Jakarta Sans` as the primary font for high legibility, using warm charcoal (`#1C1917`) instead of pure black for primary text.
- **Energetic Accents:** Configured primary Teal (`#0D9488`), secondary Gold (`#F59E0B`), and Coral (`#EF4444`) to provide clear visual hierarchy and feedback without feeling like a generic SaaS dashboard.

**Scoped UI Helper Classes:**
- `.lm-card`: Provides a standardized container with a pristine white background, soft borders, 12px rounded corners, and a crisp, light shadow.
- `.lm-badge-gold`: A circular container utility for icons and badges, using a soft amber background and a prominent gold foreground.
- `.lm-highlight`: A utility for emphasizing text with a playful yellow background, mimicking a highlighter marker.

### Architectural Rationale

- **CSS Variables over Hardcoded Tailwind Classes**: By defining the color palette as CSS variables (`--bg-app`, `--accent-teal`, etc.) within the `@layer base`, the design system remains centralized and easily maintainable.
- **Tailwind v4 Integration**: Prepending `@import "tailwindcss";` to `index.css` enables Tailwind v4's engine to process the CSS without relying on a traditional `tailwind.config.js` file.
- **Avoidance of Generic Aesthetics**: The explicit rejection of pure black/white contrast and dark-mode slate backgrounds ensures the UI feels bespoke, warm, and approachable, aligning perfectly with the Lunch Money philosophy.

---

## Phase 1–3: Auth Integration, UI Screens & App Shell

### Phase Summary

This phase connected the React frontend to the Node.js backend authentication API, implemented the context provider, and constructed the primary UI screens (Login, Register, Dashboard) using the established Lunch Money design tokens.

| File | Purpose |
|------|---------|
| `src/api/axios.js` | Axios instance with a request interceptor for seamless JWT injection. |
| `src/context/AuthContext.jsx` | Global state for user data and auth methods (`login`, `register`, `logout`). Restores session on load. |
| `src/components/ProtectedRoute.jsx` | Wrapper component that redirects unauthenticated users to `/login`. |
| `src/App.jsx` | Application entry point configuring `react-router-dom` and the route definitions. |
| `src/pages/Login.jsx` | Lunch Money styled login form with inline error handling. |
| `src/pages/Register.jsx` | Lunch Money styled registration form. |
| `src/pages/Dashboard.jsx` | The main App Shell containing the sidebar navigation and placeholder content areas. |

### Implementation Details

#### Auth Infrastructure

1. **Axios Interceptor**: Centralized API calls via an Axios instance. The request interceptor retrieves `pocketninja_token` from `localStorage` and injects it as a `Bearer` token. This removes the need to manually attach the token on every authenticated request.
2. **Context & Session Restoration**: `AuthContext` mounts and immediately checks for a stored token. If one exists, it fires a background request to `GET /api/auth/me`. This prevents the user from being abruptly logged out upon a page refresh.
3. **Route Guarding**: `<ProtectedRoute />` observes the `isLoading` state of the `AuthContext` to prevent premature redirects, displaying a gentle loading state while the session restores. Once loaded, it redirects to `/login` if no user exists.

#### User Interface

- **Auth Pages**: Both Login and Register use the `.lm-card` utility and gold badge styling. Inputs are styled with teal (`#0D9488`) focus rings, and submit buttons use hover/active state micro-interactions.
- **Dashboard App Shell**: 
  - Implemented a two-column responsive layout (Sidebar + Main Content).
  - Integrated `lucide-react` for clean, professional iconography.
  - Sidebar includes the user's name, email, and a prominently placed Sign Out button.
  - Built a dedicated widget card for the upcoming Web Push infrastructure phase.
