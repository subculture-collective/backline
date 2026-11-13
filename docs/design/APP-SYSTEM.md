# Backline app design system

The app carries the Road Case identity in [BACKLINE.md](./BACKLINE.md). The mark, fonts and generated brand images live in `frontend/public/brand/backline/`.

## Tokens and themes

[Global CSS](../../frontend/src/index.css) owns theme values. [Tailwind configuration](../../frontend/tailwind.config.js) exposes them as `bl` utilities with opacity support. Load-in (light) is warm off-white with dark ink; Stage (dark) is case black with off-white text. Light, dark and system selection keep the existing storage and keyboard shortcut.

| Role                                             | Use                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| `canvas`, `recessed`, `deep`                     | Page background, wells (table heads, muted modules, workspace bar) |
| `panel`, `surface`                               | Cards and raised panels; selected and hover surfaces               |
| `ink`, `muted`                                   | Primary and supporting text                                        |
| `border`, `border-strong`                        | Panel boundaries; control and dashed muted boundaries              |
| `hardware`                                       | Case corners, list marks, the current-page bar                     |
| `accent`                                         | Text links and chart marks (amber on Stage, dark amber on Load-in) |
| `focus`                                          | Focus rings: amber on Stage, ink on Load-in                        |
| `action`, `on-action`, `action-edge`             | Amber primary buttons with dark ink labels and an edge on Load-in  |
| `success`, `warning`, `danger`                   | Status text                                                        |
| `led-live`, `led-warn`, `led-danger`, `led-off`  | Status LEDs                                                        |
| `success-solid`, `warning-solid`, `danger-solid` | Solid status backgrounds with white labels                         |

Use semantic roles for new components. Do not add fixed palettes. Amber is only for actions and focus, so selection uses a panel face with an ink bar instead (chips, the nav, theme switches). Labels on `bg-bl-action` use `text-bl-on-action`, never white. Status meanings need a word or icon as well as colour; `Badge` renders an LED and a mono word, and the danger LED is square.

The landing page is built on the same tokens, so it follows both themes. Its styles are scoped under `.backline` with `lp-` class names so they cannot collide with the `bl-` component classes.

## Typography and layout

Barlow Condensed (700, 800) sets page and section headings, numerals, stat values, the wordmark and the primary button, in caps. IBM Plex Sans sets body text, navigation, controls and module titles. IBM Plex Mono sets IDs, counts, table heads, eyebrows and states. All three are self-hosted through the shared font stylesheet, which the VitePress docs import as well.

Keep page content inside the existing maximum-width containers. Use 16px mobile gutters and 32px desktop gutters, with 16–32px spacing between sections. Panels use 1px borders and 3px corners, with no offset shadows. Controls are at least 44px tall, except the small button size (36px) inside dense cards. Reserve circles for avatars and LEDs.

## Components and application shell

[BrandHeader](../../frontend/src/components/BrandHeader.tsx) provides the Backline mark, home link, page navigation, language control and theme switch on app routes. The landing page keeps its own navigation. Login, OAuth callback and status use public links; protected routes use overview, server setup, moderation, activity and status links. Access enforcement remains in the existing route guards.

Module cards show their state through the surface: enabled cards are raised panels, disabled cards are recessed with a dashed border, and a module waiting on the operator gets an orange border and orange corner brackets.

Every protected page is built from the same parts, exported from [`components/ui`](../../frontend/src/components/ui/index.ts):

| Part                                      | Purpose                                                                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `Page`, `PageHeader`, `Section`           | Main landmark with gutters, an eyebrow/title/description header with an actions slot, and titled sections              |
| `ServerSwitcher`                          | The server picker shown on every server-scoped page; selection lives in the guild store                                |
| `Input`, `Select`, `Textarea`, `Checkbox` | Labelled controls with hint and error text wired through `aria-describedby`; `compact` keeps short controls narrow     |
| `Alert`                                   | Inline message with icon and tone. Danger announces as `alert`, other tones as `status`; pass `role="none"` to opt out |
| `Badge`                                   | State: LED plus an uppercase mono word. `accent` tone is a bordered category label without an LED                      |
| `Stat`                                    | Key figure inside a `<dl>`                                                                                             |
| `Table`                                   | Scrollable data table with a hidden caption                                                                            |
| `EmptyState`                              | Why a list is empty and what to do next                                                                                |
| `Button`, `Card`, `StatCard`, skeletons   | Existing primitives, unchanged                                                                                         |

Plain elements can adopt the same look through classes in [the global stylesheet](../../frontend/src/index.css): `bl-button-primary`, `bl-button-secondary`, `bl-button-danger` and `bl-button-sm` for buttons and links; `bl-input`, `bl-input-compact`, `bl-label`, `bl-check`, `bl-legend`, `bl-hint` for forms; `bl-form-notice` and `bl-form-alert` for inline form results; `bl-badge-*`, `bl-alert-*`, `bl-chip`, `bl-eyebrow-app`, `bl-details`, `bl-stat` and `bl-table` for the rest. The module configuration forms use these classes rather than ad-hoc utilities.

Chart colors come from [design helpers](../../frontend/src/lib/design.ts); canvas graphs and image exports resolve the CSS tokens to actual colors.

The app honors reduced-motion preferences through Framer Motion and CSS. Focus outlines remain visible. Tables sit inside `bl-table-wrap` overflow containers; navigation wraps at narrow widths.

## Page patterns

- **Overview** (`/overview`) summarizes the selected server: enabled modules by category, modules waiting on the operator, moderation actions still in flight, API service state, and the five most recent cases. It reads existing endpoints only.
- **Server setup** (`/servers`) is a module catalog. Modules are grouped by the categories in [`lib/modules.ts`](../../frontend/src/lib/modules.ts) (community, safety, engagement, automation, operator), each card shows a state badge (`Enabled`, `Off`, `Needs operator`), and settings or history open inside a `details` disclosure that starts collapsed. A search box and state chips narrow the list. The Enable/Disable control keeps its `aria-pressed` state.
- **Moderation** (`/moderation`) uses a two-column form with hints, a primary submit and a secondary refresh, and a table of cases with state badges. Request-key reuse and locking behavior are unchanged.
- **Status** and **Activity** keep their data and copy, wrapped in the shared page header and cards.
- **Analytics**, **Advanced analytics** and **Metrics** use the page header, `Stat` groups, chip toggles for date ranges and views, the shared table, and `Alert` for help and error states. The drill-down panel is a labelled dialog built on the card and stat primitives.
- **Login** is a single card with the eyebrow, mark, capability badges and the primary Discord link. Its heading, link name and terms text are the strings the end-to-end checks rely on.

Each server-scoped page reads the manageable server list through [`useServers`](../../frontend/src/hooks/useServers.ts). Server setup uses `sync` mode, which clears a selection that is no longer manageable; other pages use `passive` mode so a failed read never drops the current server.

## Verification boundaries

Use frontend lint, tests and a production build for changes. Browser checks should cover login, overview, server setup, moderation, status, activity, theme changes, narrow layouts and generated font/logo loading. Fixture API responses can verify layout without live Discord credentials, but do not qualify OAuth, authorization or Discord delivery.
