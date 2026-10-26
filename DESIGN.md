# ALC Light Glass Studio

## 1. Visual Theme & Atmosphere

ALC is a calm, desktop-first media player designed for a bright room and long viewing sessions. The surface is mineral white and translucent, with one small library rail and one dominant playback panel. Playback is the only visual anchor: the media stage is a deep charcoal frame inside an airy glass shell, so the active content remains legible and visually important. Density is intentionally low, variance is restrained, and motion is brief, tactile, and purposeful.

The direction combines the user's light glassmorphism brief with Impeccable's operate-mode discipline: the player stays task-first, actions remain familiar, and glass is used only for the library, URL entry, playback controls, and status surface. The design seed used for this replacement world is `26198bc2`.

## 2. Color Palette & Roles

- **Mineral Canvas** (`#EEF4F5`) — primary application background.
- **Cloud White** (`#FFFFFF`) — solid surfaces, empty-state interiors, and readable control faces.
- **Translucent Glass** (`rgba(255,255,255,0.64)`) — library, URL entry, controls, and status surfaces.
- **Deep Stage** (`#16242C`) — playback canvas and audio visualizer base.
- **Ink** (`#1D2B33`) — primary text and headings; never pure black.
- **Slate Text** (`#5E7078`) — descriptions, labels, and secondary content.
- **Mist Text** (`#82939A`) — metadata and low-priority captions; never used for essential instructions.
- **Cobalt Accent** (`#3565ED`) — the single accent for primary actions, active navigation, progress, focus, and selected media.
- **Success** (`#258A67`) — ready/complete status only.
- **Warning** (`#D99135`) — audio/source metadata only.
- **Danger** (`#C65C60`) — destructive actions and errors only.

Accent usage is restrained. Components use no more than two dominant colors, and shadows are cool, soft, and offset rather than neon halos.

## 3. Typography Rules

- **UI and display:** `Avenir Next`, falling back to `Segoe UI`, with weight-driven hierarchy and tight tracking for headings.
- **Measurements:** `SFMono-Regular`, `Consolas`, or the platform monospace fallback for timestamps and duration values.
- **Scale:** 9px metadata, 10–12px utility copy, 13–16px section titles, and a 30–46px page title.
- **Headings:** track-tight (approximately `-0.05em`), balanced, and sentence case.
- **Body:** relaxed leading around `1.5`; descriptions stay short and readable.
- **Banned:** gradient text, generic serif display treatments, pure black, and tiny low-contrast essential labels.

## 4. Component Stylings

- **Glass panels:** translucent white fill, `backdrop-filter: blur(22px) saturate(125%)`, a white structural border, and a low-contrast cool shadow. Only a few purposeful panels use generous curves between 18px and 26px.
- **Buttons:** cobalt is reserved for the main action. Secondary actions are white glass with a structural border. Pressed states translate by 1px instead of glowing.
- **Icon controls:** minimum 36px hit area, rounded-square 12px corners, muted until hover or active, always paired with an accessible label/title.
- **Playback stage:** deep charcoal, 23px radius, subtle internal light, and no decorative chrome over the media.
- **Playback controls:** a separate curved glass tray below the stage with a clear seek line, cobalt progress, large play control, and familiar skip, volume, speed, and fullscreen actions.
- **Library rows:** 16px curves, light lift on hover, cobalt tint for the active row, and a stable thumbnail slot.
- **Inputs:** pill-shaped only for search or online URL entry; structural labels remain outside the field.
- **Empty states:** show a clear import action and explain accepted media formats without pretending content exists.
- **Empty states:** show one clear import action and explain accepted media formats without pretending content exists.

## 5. Layout Principles

- Desktop-first two-column player: small library rail and dominant playback stage.
- The URL entry bar sits directly above the studio as the fastest path into online playback.
- The playback stage receives the largest visual area; the library only supports discovery.
- The status rail is a separate bottom surface and must never obscure playback controls.
- Keep at least 16px between major glass surfaces and at least 12px inside controls.
- Preserve the PC minimum width; the product is not being redesigned as a mobile player.
- Keep every action in a predictable spatial zone. Do not stack floating controls over important content.

## 6. Motion & Interaction

- Use short exponential ease-out transitions around 140–220ms.
- Animate opacity, transform, border, and shadow only; never animate layout dimensions.
- Hover states are slight lifts or surface contrast changes, not color explosions.
- The one authored material effect is the soft light field inside the playback stage/audio visualizer.
- Respect `prefers-reduced-motion` by collapsing transitions and animations to near-zero duration.
- Focus-visible states use a cobalt ring with a canvas-colored separation halo for keyboard clarity.

## 7. Anti-Patterns (Banned)

- No dark-first default for this redesign.
- No purple/neon accent system, outer glow buttons, or rainbow gradients.
- No pure black text or backgrounds.
- No Inter, generic serif display, or decorative italic word swaps.
- No nested cards-inside-cards hierarchy or decorative feature panels.
- No icon-only controls without accessible labels or titles.
- No status/footer overlays covering player content.
- No fake media thumbnails made from arbitrary gradients when a real asset exists.
- No placeholder claims about universal online playback or protected-source downloading.
- No responsive layout that hides core playback controls at the desktop target width.
- No projects, playlists, watch-later, notes, captions, roadmap, command center, or settings hub in the primary player surface.
