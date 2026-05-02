# AGENTS.md

Project conventions for AI coding agents working on
`momakoding-jam-starter-web` — a Vue 3 + Phaser 4 + TypeScript Game Jam starter.

> **Two-file split.** This file (`AGENTS.md`) holds the stable **rules** (sections 1–12). The sibling [`CODEBASE_STATE.md`](./CODEBASE_STATE.md) holds the project's *history*: directory map (top-level only), WIP claims (§13.9), decision log (§13.10), and change log (§14). It does **not** duplicate scene / event / asset / type registries — those live as `as const` objects in `src/contents/constants.ts` and `src/contents/types.ts` and are discovered by grep (see `CODEBASE_STATE.md` §13.2 for the lookup map). Agents read the sibling freely while coding; edits happen only in a user-initiated pre-commit sync (see §0).

---

## 0. Multi-agent collaboration protocol

### Doc edit policy (read this first)

- **Do NOT modify `CODEBASE_STATE.md` during feature work.** Finish the code. Do not bump `Last updated` dates, do not append to §13.9 / §13.10 / §14, do not move "WIP" rows — not as part of the same turn you wrote the code.
- **`CODEBASE_STATE.md` is edited only when the user explicitly asks**, typically right before they request a commit. Common phrasings that unlock doc edits: *"update the codebase state"*, *"sync the codebase state"*, *"prep for commit"*, *"fill in the change log"*. Without an explicit request, leave the doc alone.
- **When the user does ask**, batch all deferred updates from the session into one coherent edit in `CODEBASE_STATE.md` (see "Pre-commit doc sync" below). Still respect the other rules in this section (decision log rows for non-obvious trade-offs, etc.).
- **`AGENTS.md` (this file) changes only when the user asks to change a rule.** Feature work never touches it.

### The contract

1. **Before coding**, skim §1–§12 of this file once per session, then check `CODEBASE_STATE.md` §13.9 (WIP claims) and §13.10 (decision log) for anything relevant to your task. The directory map (§13.1) is a useful orientation read on first touch of an area.
2. **While coding**, the canonical *registry* of names is the code itself: grep `src/contents/constants.ts` (scene / event / asset / SFX / BGM / tunable / ID keys), `src/contents/types.ts` (shared types), `src/router/index.ts` (routes). `CODEBASE_STATE.md` §13.2 has the full grep map. Before adding a new key, confirm it doesn't exist in the relevant `as const` object — don't rely on the doc for this.
3. **After coding**, **do not edit either doc.** Keep a short mental (or scratchpad) list of what would need to change in §13.9 / §13.10 / §14 so you can produce a clean batch when the user asks.
4. **Pre-commit doc sync (user-initiated only).** When the user explicitly asks to update the codebase state, do all of:
   - Append a single-line entry to §14 (Change Log) per coherent change, newest at the top, with date prefix.
   - If any change introduced a non-obvious trade-off (physics engine swap, asset pipeline change, new dependency, shutdown-safety pattern, etc.), add a row to §13.10 (Decision Log). Never silently re-decide past choices.
   - If §13.1 (directory map) drifted at the *folder* level (new top-level directory under `src/`, new asset folder under `public/`), update it. Don't enumerate individual new files — the directory map is intentionally folder-level only.
   - Update §13.9 (WIP) if the work claimed a multi-turn area: strikethrough the row when done.

### Conflict-avoidance rules

- **Namespaces are unique.** Scene keys, event keys, asset keys, route paths, store names must be unique globally. Confirm by grepping `src/contents/constants.ts` / `src/router/index.ts` / `src/stores/` — not by reading `CODEBASE_STATE.md`.
- **One owner per feature.** When you start a multi-turn feature, note it in chat so other agents know you're claiming that area. The §13.9 WIP row lands during the next user-initiated doc sync — do not add it preemptively.
- **Code wins, doc follows.** `CODEBASE_STATE.md` is human-curated history; if it ever conflicts with the code, the code is right. There is no "registry to keep in sync" anymore — just the change log + decisions.
- **Atomic doc updates.** One feature → one coherent §13.10 / §14 edit at commit time. Don't batch unrelated refactors into the same doc patch.

### Read-before-write checklist (copy into your plan)

- [ ] Skim `CODEBASE_STATE.md` §13.1 if I'm touching an unfamiliar folder, and §13.9 (WIP) to make sure no one's claimed this area.
- [ ] Grep `src/contents/constants.ts` (or `types.ts` / `router/index.ts`) for any new key I plan to add — confirm no collision.
- [ ] If a relevant decision exists in §13.10, follow it; if my approach contradicts one, raise it in chat before re-deciding.
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
| State | `ref` / `reactive` for UI; Pinia (+ persisted-state plugin) for cross-page state; Phaser `Registry` or EventBus for Game ↔ UI | Pinia mounted in `main.ts`; no stores defined yet (cross-level state passed via `IGameplaySceneData.unlockedSkills`) |
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

### Canvas size resolution (画布尺寸分层决策)

画布使用 Phaser `Scale.RESIZE` 模式，运行时自动跟随父容器（= 全屏）。初始分辨率由分层 fallback 决定：

| 优先级 | 来源 | 说明 |
|---|---|---|
| 1（最高） | 场景内 `this.scale.resize(w, h)` | 临时覆盖，用于特殊场景需要固定画幅时 |
| 2 | `GAME_CONFIG.WIDTH / HEIGHT`（contents 层） | 游戏设计基准分辨率；runtime 的 `resolveCanvasSize()` 在容器未布局时使用 |
| 3（最低） | `SHELL_DEFAULTS`（engine 层） | 引擎内部兜底，几乎不会被用到 |

决策逻辑在 `src/runtime/game.ts` 的 `resolveCanvasSize(container)` 函数：优先取容器 `clientWidth/clientHeight`，为 0 时 fallback 到 `GAME_CONFIG`。结果传给 `GameShell.createGameShell` 的 `size` 参数。

场景内获取真实视口尺寸：`this.cameras.main.width / height`，不要硬编码 `GAME_CONFIG.WIDTH/HEIGHT` 做布局计算。

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
- **Typed events.** When an EventBus payload becomes non-trivial, define a named type in `src/contents/types.ts` and use it at both ends.
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

## 13. Codebase State — moved (and trimmed)

[`CODEBASE_STATE.md`](./CODEBASE_STATE.md) at the repo root holds the project's *history*: §13.1 directory map (top-level only), §13.2 source-of-truth pointer map (where to grep for what), §13.9 WIP claims, §13.10 decision log, §14 change log. The old per-namespace registries (§13.2 routes / §13.3 scenes / §13.4 entities / §13.5 events / §13.6 assets / §13.7 types / §13.8 stores) were retired on 2026-04-28 — those names live as `as const` objects in `src/contents/constants.ts` and in `src/contents/types.ts`, and are discovered by grep, not by reading the doc.

Read the sibling freely; edit it only in a user-initiated pre-commit sync per §0.

---

## 14. Change log — moved

See [`CODEBASE_STATE.md`](./CODEBASE_STATE.md) §14 for the per-change history.
