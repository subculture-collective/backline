# Backline identity: Road Case

Road Case replaced the Poster Crew identity in November 2026. Poster Crew shared its look with subcult.tv; Road Case gives Backline its own.

A band's backline is the gear and crew behind the stage. The interface borrows from road cases and mixing desks: hardware corners, tape labels, status LEDs, and modules that stay muted until you bring them up. The two themes are named for the same world: **Stage** (dark) and **Load-in** (light).

The dashboard carries this identity through the [app design system](./APP-SYSTEM.md).

## Rules

- **Amber is for actions.** The primary button, and focus on Stage. Load-in focuses in ink so the ring always shows. The mark's latch is the one non-action use of amber.
- **Green means live, orange means someone needs to act, crimson means it failed.** Each state also has a word, and the failed LED is square, so no state depends on colour alone.
- **Corners mark attention.** Orange L-brackets go on the one panel that needs someone (a module waiting on the operator). Neutral hardware brackets frame the landing page's example rack and nothing else.
- **Muted things recede.** Off modules sit in a recessed, dashed surface; live modules sit on a raised panel.
- **Type:** Barlow Condensed caps for page and section headings, numerals, the wordmark and the primary button. IBM Plex Sans for reading, navigation and controls. IBM Plex Mono for IDs, counts, labels and states. All three are self-hosted with their OFL licences in `frontend/public/brand/backline/fonts/`.

## Mark and assets

The mark is a road case: handle, four corner plates and an amber latch with a keyhole. `mark.svg` is for light backgrounds, `mark-light.svg` for dark ones, and `favicon.svg` is a filled version for browser tabs. In React, use `Mark` from `frontend/src/components/brand/RoadCase.tsx`; it follows the theme through `currentColor` and the `--bl-*` tokens. The same file holds the landing page icons (24px grid, 1.75px stroke, square ends).

`og.png`, `social-banner.png`, `social-square.png`, `apple-touch-icon.png`, `avatar.png` and `favicon.ico` are rendered from the SVG mark and the fonts by `brand/backline/render_assets.py`. Run it after changing the mark, the fonts or the palette, then commit the outputs; it rewrites `brand/backline/source-provenance.json` with their hashes. Do not edit the PNGs by hand.

Poster Crew's masters still live in SUBCULT Studio (`studio/branding/library/brands/backline/`). Road Case's masters live in this repository until Studio adopts them.

## Landing page

The landing page is `/`. Server setup is `/servers`, behind RequireAuth; OAuth completion redirects there. `/login`, `/auth/callback` and `/status` keep their routes. The landing page does not create an invite, grant server access, change module defaults or deploy a service.

It reads the shared tokens, so it follows Stage and Load-in, and its own theme switch sets the same preference as the dashboard's. The hero's example rack shows five module groups as channel strips; it is labelled as a fictional example. "What's in the case" lists all 23 modules in their five groups, "Soundcheck" gives the three setup steps, and the pilot section and FAQ describe the current scope: there is no public installation, price, provider-delivery claim or sign-up collection. Styles are scoped under `.backline` with `lp-` class names.

Below 760px the navigation drops to a scrolling row under the brand. Below 480px the rack shows numbers, faders and LEDs, with a readable key underneath, and the theme switch shows icons only.

## Verification

Before a release: frontend lint, type check, tests and the production build (with prerender), then a browser pass over the landing page (both themes and 390px), login, overview, server setup (both themes and 390px), moderation and status, checking that the three fonts load and nothing scrolls sideways. Fixture API responses can verify layout without Discord credentials but do not qualify OAuth, authorization or Discord delivery.
