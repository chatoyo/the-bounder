# AGENTS.md

Project conventions for AI coding agents working on `momakoding-jam-starter-web`.
Translated and consolidated from `.clinerules/`.

---

## 1. Role & Context

You are a senior game developer proficient in **Phaser.js 3**, **Vue 3 (Composition API)** and **TypeScript**. The goal is rapid prototyping for a Game Jam ("Vibe Coding"): prioritize **development velocity and instant feedback** while keeping code readable.

---

## 2. Tech Stack (Hard Constraints)

- **Framework**: Vue 3 SFC, `<script setup lang="ts">`
- **Engine**: Phaser.js 3.x
- **Language**: strict TypeScript (no `any`)
- **Styling**: Tailwind CSS v4 (atomic-first)
- **State**:
  - `ref` / `reactive` for UI state
  - Phaser `Registry` or a global **EventBus** for Game ↔ UI communication

---

## 3. Phaser + TS Integration Rules

- Define scenes as **classes** extending `Phaser.Scene`.
- Scene member variables **must** be typed. `any` is forbidden.
- Define an interface for scene init data: `init(data: ISceneData)`.
- Lifecycle: manually clean up custom listeners in `shutdown` / `destroy`.

---

## 4. Vibe Coding Execution Strategy

- **Fast iteration**: prefer function composition over deep class hierarchies for game entities.
- **Placeholder logic**: when art assets are missing, use primitive shapes (rectangle/circle) so logic can ship first.
- **Debug mode**: every new scene ships with a `debug` toggle for collider visualization / state logs.

---

## 5. Code Standards

- **UI separation**: Vue components only render HUD / menus / UI. **Never** put core game logic inside a Vue component.
- **Event bus**: a singleton `EventBus.ts` is the canonical cross-framework channel.
- **Asset management**: every asset key lives in a constant or enum — no string literals scattered around.
- **Loop optimization**: do not run heavy logic in a scene's `update()`; delegate to each entity's own `update` method.

---

## 6. Forbidden

- No `var`.
- No direct DOM manipulation outside the Vue / Phaser boundary.
- No frequent create/destroy of objects inside loops without an object pool.
- Do not dump long low-level implementation details unless explicitly asked — ship a runnable module first.
- **Do not run the project yourself after finishing a task — the user runs it.**

---

## 7. Interaction Protocol

- Before adding a new feature, confirm whether it conflicts with the active Phaser physics system (Arcade / Matter).
- When the user describes a **feel / vibe** (e.g. "make the jump feel lighter"), translate it directly into gravity, damping or easing curve adjustments — don't over-engineer.

---

## 8. Naming

- **Files**: `kebab-case` (e.g. `global-search-bar.vue`).
- **Component references** in `<template>` and `<script>` imports: `PascalCase` (e.g. `import GlobalSearchBar from '...'` → `<GlobalSearchBar />`).
- **Pages / routes**: files under `pages/` auto-generate routes, also `kebab-case` (`pages/recent-cases.vue` → `/recent-cases`).

---

## 9. CSS (Tailwind CSS v4)

### Atomic-first

- Use utility classes directly in templates.
- Only reach for `@apply` in `<style>` when the **same** complex combination is repeated across multiple elements. Avoid premature abstraction.
- Custom class names follow **BEM**.

### Theme colors

- Shared palette (e.g. alert red / orange / yellow) goes in `tailwind.config.ts` under `theme.extend.colors` so it can be used globally.

### PrimeVue (if used)

- Customize PrimeVue via **Pass Through (PT)** — bind Tailwind classes through PT rather than overriding PrimeVue CSS.

### i18n & typography

- The app supports long-word languages (German, Russian, etc.). Be careful with fixed widths and truncation.
- Prefer flexible layout: `flex-wrap`, `min-w-0`, `break-words`.
- Pick a font that covers all 8 supported languages.

---

## 10. Component Organization

- `components/` — globally reusable primitives (buttons, tags, collapsible panels, ...).
- `pages/` — route-level components. If a page grows complex, split its sub-modules into a subdirectory named after the page.
- Type component `props` with TypeScript.
- Type emitted events with `defineEmits`.

### UI library scope

- **Front-end portal (`2dpo-portal`)**: use `@nuxt/ui` headless primitives; wrap your own base components where it falls short.
- **Admin (`2dpo-admin`)**: use `PrimeVue` + Tailwind via Pass Through.

---

## 11. Troubleshooting Reference

Full details live in `.clinerules/02-trouble-shoot.md`. Quick index:

1. **Tailwind v4 `@reference` + `@` alias** → configure the `@` alias in `vite.config.ts` (`path.resolve(__dirname, './src')`).
2. **`@apply` on custom classes** → declare the class with `@utility` in `main.css`, then `@apply` it.
3. **Ink animation jank on low-end devices** → check Canvas draw calls, enable GPU acceleration (`transform: translateZ(0)` / `will-change`), throttle resize/scroll. Fallback plan: CSS gradient animation or a static pre-rendered image gated by `navigator.hardwareConcurrency` / screen size.
4. **i18n text overflow** → avoid fixed widths, use `min-w-*` + padding, `flex-wrap`, `break-words` / `break-all`; use `truncate` only when a single line is truly required.
5. **PrimeVue PT not applying** → ensure `unstyled: true` and `pt: {}` are set in the Nuxt plugin, verify the PT selector path against PrimeVue docs, and include `./node_modules/primevue/**/*.{vue,js,ts,jsx,tsx}` in `tailwind.config.ts` `content`.
6. **Nuxt 4 specifics**:
   - Components under `components/` are auto-imported — no manual `import`.
   - Routes come from `app/pages/` (e.g. `app/pages/risk-profile/[id].vue` → `/risk-profile/:id`).
   - Layouts live under `app/layouts/`; pick one with `definePageMeta({ layout: 'default' })`.
7. **Tailwind v4 vs v3 differences**:
   - Opacity: `bg-opacity-*` / `text-opacity-*` are **gone**. Use `bg-white/50`, `text-gray-500/80`, or generic `opacity-*`.
   - Animation classes (`animate-in`, `fade-in`, `slide-in-from-bottom-4`) require `tailwindcss-animate` — install it and add `@plugin "tailwindcss-animate";` in `main.css`.
   - `prose` / `prose-lg` require `@tailwindcss/typography` — install it and add `@plugin "@tailwindcss/typography";` in `main.css`.

---

## 12. Persona (optional)

The project includes an optional role-play persona in `.clinerules/04-customized-profile.md` ("媛媛" — a cheerful penguin-girl engineer). It is a stylistic preference for the user's own sessions and must **not** affect code quality, correctness, or the rules above. Ignore it when it would conflict with any rule in this document.
