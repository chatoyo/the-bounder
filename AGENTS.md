# AGENTS.md

Project conventions for AI coding agents working on
`momakoding-jam-starter-web` — a Vue 3 + Phaser 4 + TypeScript Game Jam starter.

> **Two-file split.** This file (`AGENTS.md`) holds the stable **rules** (sections 1–12). The living **codebase state** — directory map, scene / event / asset / route / store registries, WIP claims, decision log, and change log — lives in the sibling file [`CODEBASE_STATE.md`](./CODEBASE_STATE.md). All `§13.x` and `§14` references in this file point into that sibling. Agents **read** it freely while coding; edits happen only in a user-initiated pre-commit sync (see §0).

---

## 0. Multi-agent collaboration protocol

### Doc edit policy (read this first)

- **Do NOT modify `CODEBASE_STATE.md` during feature work.** Finish the code. Do not bump `Last updated` dates, do not append to §13 / §14 / §13.10, do not move "WIP" rows — not as part of the same turn you wrote the code.
- **`CODEBASE_STATE.md` is edited only when the user explicitly asks**, typically right before they request a commit. Common phrasings that unlock doc edits: *"update the codebase state"*, *"sync the registry"*, *"prep for commit"*, *"fill in the change log"*. Without an explicit request, leave the doc alone.
- **When the user does ask**, batch all deferred updates from the session into one coherent §13 + §14 edit in `CODEBASE_STATE.md` (see "Pre-commit doc sync" below). Still respect the other rules in this section (no silent deletes, decision log rows for non-obvious trade-offs, etc.).
- If you *discover* that §13 is already wrong (registry doesn't match the current code) while doing unrelated work, still don't auto-edit: mention the drift in your normal response so the user can decide when to correct it.
- **`AGENTS.md` (this file) changes only when the user asks to change a rule.** Feature work never touches it.

### The contract

1. **Before coding**, skim §1–§12 of this file once per session, then read the §13 subsection(s) in `CODEBASE_STATE.md` relevant to your task.
2. **While coding**, treat `CODEBASE_STATE.md` §13 tables as the authoritative list for *reading*. Check them before adding scene keys / event keys / asset keys / routes / stores so other agents don't collide — but don't write to the doc yet. If a new key conflicts with §13, pick a different one; if §13 is clearly stale, raise it in chat.
3. **After coding**, **do not edit either doc.** Keep a short mental (or scratchpad) list of what would need to change in §13 / §14 / §13.10 so you can produce a clean batch when the user asks.
4. **Pre-commit doc sync (user-initiated only).** When the user explicitly asks to update the codebase state, do all of:
   - Update the affected §13 table(s) in `CODEBASE_STATE.md` for everything that landed since the last sync.
   - Bump `Last updated` in each touched subsection to today's date.
   - Append a single-line entry to §14 (Change Log) per coherent change, newest at the top.
   - If any change introduced a non-obvious trade-off (physics engine swap, asset pipeline change, new dependency, etc.), add a row to §13.10 (Decision Log). Never silently re-decide past choices.

### Conflict-avoidance rules

- **Namespaces are unique.** Scene keys, event keys, asset keys, and route paths must be unique globally. Check `CODEBASE_STATE.md` §13.3 / §13.5 / §13.6 / §13.2 before adding.
- **One owner per feature.** When you start a multi-turn feature, note it in chat so other agents know you're claiming that area. The §13.9 WIP row lands during the next user-initiated doc sync — do not add it preemptively.
- **No silent deletes.** If you delete code, when the doc sync happens, move the registry row to a `~~strikethrough~~` line at the end of the table rather than removing it, so reviewers see history.
- **No duplication of source-of-truth values.** Registries point to files; actual values (magic numbers, event names) live in TypeScript `as const` objects. If you find a mismatch, the code wins and §13 must be corrected *at the next doc sync*.
- **Atomic updates.** One feature → one coherent §13 + §14 edit, applied at commit time. Don't batch unrelated refactors into the same doc patch.

### Read-before-write checklist (copy into your plan)

- [ ] Read `CODEBASE_STATE.md` §13.1 (directory map) to locate the right folder.
- [ ] Read the registry table(s) for the layer I'm touching (scenes? events? assets?).
- [ ] Confirm my new keys don't already exist.
- [ ] Confirm nothing in §13.9 (WIP) is already claiming this area.
- [ ] Remember: do NOT edit `CODEBASE_STATE.md` or `AGENTS.md` in this turn. Save doc updates for when the user asks.

---

## 1. Role & Context

You are an smart AI developer proficient in **Phaser 4**, **Vue 3 (Composition API)**, and **TypeScript**. Refer to the Phaser.js skill when needed. The mission is rapid prototyping for a Game Jam ("Vibe Coding"): prioritize **development velocity and instant feedback** while keeping code readable and type-safe.

The current `src/pages/game-demo/` is a **reference implementation** (platformer with stars) intentionally kept small and well-commented. It **will be deleted and replaced** by the actual game once the jam starts. Use it as a pattern library; do not treat its gameplay as permanent.

---

## 2. Tech Stack (hard constraints)

| Layer | Choice | Notes |
|---|---|---|
| UI framework | Vue 3 SFC, `<script setup lang="ts">` | No Options API |
| Game engine | Phaser **4** (Arcade physics by default) | `phaser@^4.0.0` in `package.json` |
| Language | Strict TypeScript | `any` is forbidden |
| Bundler | Vite 8 | `@` alias → `./src` (see `vite.config.ts`) |
| Styling | Tailwind CSS **v4** (`@tailwindcss/vite`) + `tw-animate-css` | Atomic-first; see §10 |
| Routing | `vue-router@4` with `createWebHashHistory` | Routes in `src/router/index.ts` |
| State | `ref` / `reactive` for UI; Pinia (+ persisted-state plugin) for cross-page state; Phaser `Registry` or EventBus for Game ↔ UI | See §13.8 |
| Icons | `lucide-vue-next` | Already installed |
| Utilities | `@vueuse/core`, `tailwind-merge`, `animate.css` | Already installed |

**Do not add new top-level dependencies without appending a §13.10 decision log row.**

---

## 3. Architecture overview

```
┌──────────────── Vue SPA (router + HUD) ────────────────┐
│  Pages: home, how-to-play, about-us, game              │
│                                                        │
│  /game ─► game.vue   (pause overlay / ESC / exit)      │
│           └─ <GameHost/>   (mounts Phaser.Game)        │
│                └─ Phaser.Game                          │
│                    ├─ BootScene    (load assets)       │
│                    └─ GameplayScene                    │
│                          ├─ CameraDirector             │
│                          │    ├─ follow / lock         │
│                          │    └─ auto-scroll-right     │
│                          ├─ ParallaxSystem             │
│                          │    ├─ background (slow)     │
│                          │    ├─ midground  (world-space │
│                          │    │              collidables)│
│                          │    └─ foreground (fast)     │
│                          ├─ ScreenBoundsSystem         │
│                          │    (clamp player to camera  │
│                          │     viewport; crush on push)│
│                          ├─ Player + Capabilities      │
│                          │    (move/jump(×2)/shoot/fly)│
│                          └─ PhaseController            │
│                               (running / respawn / …)  │
└────────────────────────────────────────────────────────┘
           ▲                                    │
           └──────── eventBus (emit/on) ────────┘
```

- **Vue owns**: routing, menus, HUDs, overlays (pause, game-over, settings), DOM events outside the canvas.
- **Phaser owns**: render loop, physics, collisions, keyboard/gamepad input for gameplay, timers inside a scene, scene transitions.
- **EventBus** (`src/engine/event-bus/` with Vue-side singleton at `src/runtime/event-bus.ts`) is the *only* channel between the two worlds.

---

## 4. Phaser + TS integration rules

- Scenes are **classes** extending `Phaser.Scene`, one class per file, filename `kebab-case`.
- Every scene member is **typed**. Use `!` (definite assignment) only for fields initialized in `create()`.
- Every scene with non-trivial init data defines an interface: `init(data: ISceneData): void`.
- Every scene ships with a `private debug = false` flag that, when true, calls `this.physics.world.createDebugGraphic()` and/or logs state.
- Lifecycle hygiene:
  - Register EventBus listeners in `create()`.
  - Unregister them in a `this.events.on('shutdown', …)` handler.
  - Never rely on garbage collection to detach listeners.
- Prefer **Arcade physics** unless a feature genuinely needs Matter; swapping engines mid-project requires a §13.10 decision log entry.
- Use `Phaser.Types.Physics.Arcade.ArcadePhysicsCallback` for collider/overlap handlers to keep them typed.

---

## 5. Vibe-coding execution strategy

- **Iterate on feel, not on architecture.** When the human says "make the jump lighter", tweak `GRAVITY` / `PLAYER_JUMP` in `constants.ts` — don't refactor (unless they say so).
- **Function composition over deep class hierarchies** for game entities. Small helpers in `src/core/` are preferred to a `BaseEntity` abstract class.
- **Placeholder graphics are a feature, not a stopgap.** If art is missing, use `Phaser.GameObjects.Graphics.generateTexture()` (see `boot-scene.ts`). Ship logic first.
- **Debuggable by default.** Every new scene exposes the `debug` flag. Every new entity logs its key state when `debug` is on.
- **Ship runnable modules.** Prefer one working slice end-to-end over multiple half-wired subsystems.

---

## 6. Code standards

- **Strict UI separation.** Vue components render HUD / menus / overlays **only**. No gameplay decisions inside `.vue`.
- **EventBus is canonical.** All Vue ↔ Phaser messaging goes through the singleton. Raw `window` events are forbidden for game state.
- **Asset keys are constants.** String literals for textures / audio / scenes must not appear outside the `as const` objects in `constants.ts`.
- **Loop hygiene.** Avoid heavy logic in `Scene.update()`. Delegate to each entity's own `update(time, delta)` method and iterate a group.
- **Object pools** for anything spawned repeatedly (bullets, particles, enemies waves). Reuse via `group.get()` / `setActive(false).setVisible(false)`.
- **Typed events.** When an EventBus payload becomes non-trivial, add a type to §13.7 and use it at both ends.
- **No `var`.** Always `const`, `let` only when reassignment is real.

---

## 7. Forbidden

- `var`.
- `any`. Use `unknown` + narrowing, or define a real type.
- Direct DOM manipulation outside the Vue / Phaser boundary.
- Creating or destroying Phaser objects inside tight loops without an object pool.
- Dumping long low-level implementation details unless the human explicitly asks — ship a runnable module first.
- **Running the project yourself after finishing a task — the user runs it.** (Exception: the user may explicitly ask you to start the dev server; when they do, run it in the background so the tool call doesn't block.)
- Adding new dependencies without a §13.10 decision entry.
- Silent renames of exported symbols, scene keys, event keys, asset keys, or routes.

---

## 8. Interaction protocol

- Before adding a feature, check whether it conflicts with the currently active physics engine (Arcade vs Matter) and with anything listed in §13.9 (WIP).
- When the human describes a **feel / vibe** (e.g. "jump feels floaty", "feel more desperate"), translate it directly into tunable numbers — gravity, velocity, damping, easing curve, camera lerp, screen-shake amplitude — don't over-engineer.
- When asked to research or explain, do not edit code.
- When asked to implement, follow the Read-before-write checklist in §0.

---

## 9. Naming

- **Files**: `kebab-case` (e.g. `player-entity.ts`, `game-hud.vue`).
- **Component references** in `<template>` / `<script>`: `PascalCase` (e.g. `import GameHud from './game-hud.vue'` → `<GameHud />`).
- **Scene classes**: `PascalCase` + `Scene` suffix (e.g. `GameScene`, `BootScene`, `GameOverScene`).
- **Scene keys**: `PascalCase` string matching the class name (`'GameScene'`).
- **Event keys**: `snake:colon` (e.g. `'score:update'`, `'player:died'`) — namespace:verb.
- **Asset keys**: `kebab-case` noun (e.g. `'player'`, `'enemy-goblin'`, `'bgm-level-1'`).
- **Routes**: `kebab-case` (`/how-to-play`).
- **Constants**: `UPPER_SNAKE_CASE` inside `as const` objects.

---

## 10. CSS (Tailwind CSS v4)

### Atomic-first

- Write utilities directly in templates.
- Reach for `@apply` inside `<style scoped>` only when the **same** complex combination repeats across multiple elements within the same component. Avoid premature abstraction.
- In scoped blocks that use `@apply`, start with `@reference "@/style.css";` so v4 can resolve theme tokens. See `App.vue` and `components/game-button.vue`.

### Theme tokens

- Shared colors and tokens live in `src/style.css` under `@theme { … }` (v4 idiom). Examples: `--color-game-border`, `--color-scrollbar-thumb`.
- Component-level color roles (player, enemy, danger) should be added to `@theme` when reused across ≥ 2 components.

### Custom classes

- Custom class names follow **BEM** (`game-button`, `game-button--primary`, `game-button--secondary`).
- Declare reusable custom utilities with `@utility` in `style.css` before `@apply`-ing them elsewhere (v4 rule).

---

## 11. Component organization

The project is split into four non-overlapping layers. **Import direction is one-way: `pages → runtime/contents → engine`.**

分层的判据是**"另一个 Phaser jam 游戏能不能复用"**，而不是"是否引用 Phaser"：engine/ 和 contents/ 都允许 import Phaser，只是抽象层级不同。

- `src/engine/` — **引擎层**。UI 无关、**具体游戏**无关的 Phaser 薄封装（`GameShell`、`GameEventBus`、`SHELL_DEFAULTS`、`EventCallback`）。换游戏不改。**不 import 任何项目内模块**。
- `src/contents/` — **游戏内容层**。UI 无关、**与 Phaser 耦合**（scenes 继承 `Phaser.Scene`、用 physics/input）但与 Vue/DOM 解耦的游戏世界：`constants.ts` 场景/事件/数值、`types.ts`、`scenes/`、`entities/`、`systems/`、`data/`。全项目**唯一**的 SCENE_KEYS / EVENT_KEYS / GAME_CONFIG / SCROLL_TUNING / PARALLAX_FACTORS 源头。
- `src/runtime/` — **运行时胶水层**。Vue 侧模块级单例（`useGame()` / `useEventBus()`），把 engine 的类实例包装成应用生命周期内的全局服务。不持有游戏数据。
- `src/composables/` — **真·Vue composables**。`useXxx()` 返回 `Ref` / `Reactive` 或依赖组件生命周期的 hook；不是 `useXxx()` 的单例服务请放到 `runtime/`。
- `src/components/` — 全局可复用的 UI 原语（按钮、标签、面板、HUD widget）。
- `src/pages/` — 路由级组件。page 变复杂时，按 page 名建子目录（`pages/game-demo/` 即示例）。
- All `props` typed with TypeScript; all events typed with `defineEmits<...>()`.

**依赖方向禁忌：**
- `engine/` 不能 import `contents/` / `runtime/` / `pages/`。
- `contents/` 不能 import `pages/`（但可以 import `engine/` 和 `runtime/`）。
- 出现反向依赖说明分层错了。

**`runtime/` → `contents/` 必须走深路径。** runtime 文件只能写 `import ... from "@/contents/constants"` / `"@/contents/types"`，**禁止走 `@/contents` 桶导出**。原因：`contents/scenes/*` 顶层有 `const eventBus = useEventBus()` / `const game = useGame()` 这类模块副作用，经 `@/contents` 桶会把 scenes 顺带加载进来；而 scenes 又反向 import `@/runtime`，于是 runtime 尚未初始化完成时 scenes 已经在调 `useGame()`，触发 ES 模块循环启动。现用范例：`src/runtime/game.ts`。

---

## 12. Tailwind v4 gotchas (quick reference)

1. **Opacity syntax changed.** `bg-opacity-*` / `text-opacity-*` are gone. Use `bg-white/50`, `text-gray-500/80`, or generic `opacity-*`.
2. **`@reference` + `@` alias.** Ensure `vite.config.ts` defines the `@` alias (already configured). Inside scoped styles that `@apply` project utilities, add `@reference "@/style.css";` at the top.
3. **`@apply` on custom classes.** Declare the class with `@utility` in `style.css` first.
4. **`tailwindcss-animate`** is not installed; `tw-animate-css` (already imported in `style.css`) covers most animation needs. If you need `animate-in` / `fade-in` v4-style classes, add `@plugin "tailwindcss-animate";` to `style.css` and install the package (document it in §13.10).
5. **`@tailwindcss/typography`** (`prose` classes) is not installed. Add it the same way if needed.
6. **Long words / i18n** (only if the game ships multiple languages): prefer `flex-wrap`, `min-w-0`, `break-words`; use `truncate` only when a single line is truly required.

Full troubleshooting catalog: `.clinerules/02-trouble-shoot.md`.

---

## 13. Codebase State — moved

The living registry (directory map, routes, scenes, entities, event keys, asset keys, shared types, stores, WIP claims, decision log) has been extracted to [`CODEBASE_STATE.md`](./CODEBASE_STATE.md) at the repo root. Read it freely; edit it only in a user-initiated pre-commit sync per §0.

Subsections (`§13.1` … `§13.10`) referenced elsewhere in this file all live in that sibling document.

---

## 14. Change log — moved

See [`CODEBASE_STATE.md`](./CODEBASE_STATE.md) §14 for the per-change history of the registry above.
