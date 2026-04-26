# AGENTS.md

Project conventions **and shared codebase state** for AI coding agents working on
`momakoding-jam-starter-web` — a Vue 3 + Phaser 4 + TypeScript Game Jam starter.

> **Multi-agent source of truth.** Sections 1–12 are the *rules*. Section **13 (Codebase State)** is the *living map* of everything that currently exists in `src/`. Any agent that adds, moves, renames, or deletes code **must** update §13 in the same turn, and append one line to §14 (Change Log). Stale registries silently break collaboration; outdated entries are worse than none.

---

## 0. Multi-agent collaboration protocol

### The contract

1. **Before coding**, skim §1–§12 once per session, then read the §13 subsection(s) relevant to your task.
2. **While coding**, treat §13 tables as the authoritative list. If you need a new scene key / event / asset key / route / store, register it in §13 **before** wiring it up so other agents don't collide.
3. **After coding**, do all of:
   - Update the affected §13 table(s).
   - Bump `Last updated` in each touched subsection to today's date.
   - Append a single-line entry to §14 (Change Log) with date, area, summary.
   - If you introduced a non-obvious trade-off (physics engine swap, asset pipeline change, etc.), add a row to §13.10 (Decision Log). Never silently re-decide past choices.

### Conflict-avoidance rules

- **Namespaces are unique.** Scene keys, event keys, asset keys, and route paths must be unique globally. Check §13.3 / §13.5 / §13.6 / §13.2 before adding.
- **One owner per feature.** When you start a multi-turn feature, add a `WIP` row to §13.9 with owner = your session id / agent name / date. When done, remove or mark `DONE`.
- **No silent deletes.** If you delete code, move the registry row to a `~~strikethrough~~` line at the end of the table rather than removing it, so reviewers see history.
- **No duplication of source-of-truth values.** Registries point to files; actual values (magic numbers, event names) live in TypeScript `as const` objects. If you find a mismatch, the code wins and §13 must be corrected.
- **Atomic updates.** One feature → one coherent §13 + §14 edit. Don't batch unrelated refactors into the same doc patch.

### Read-before-write checklist (copy into your plan)

- [ ] Read §13.1 (directory map) to locate the right folder.
- [ ] Read the registry table(s) for the layer I'm touching (scenes? events? assets?).
- [ ] Confirm my new keys don't already exist.
- [ ] Confirm nothing in §13.9 (WIP) is already claiming this area.

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

# 13. Codebase State (living registry)

> Update discipline: every row below must point to a real file/symbol in `src/`. If you rename or delete it, update the row *in the same turn*. Do not remove rows — mark them `~~deprecated~~` at the bottom of the table.

**Current scaffold status:** *Phase A2 architecture + comprehensive demo shipped. Two playable levels (grass → space biome) with auto-scroll + 3-layer parallax; double-jump default; flight unlocked via NPC dialogue choice or mid-level pickup. NPC dialogue system with branching choices + commands (grant-skill / equip-skill). Boss fight ("影之使徒") at end of level-02: camera lock + enemy bullet pool + HP bar.*
**Scaffold last updated:** 2026-04-26;14:00

---

## 13.1 Directory map

*Last updated: 2026-04-26;14:00*

```
momakoding-gamejam-starter-web/
├── .clinerules/               # Original Chinese project rules (source of AGENTS.md)
├── docs/
│   ├── game-demo.md           # Demo walkthrough
│   ├── phaser-study.md        # Phaser + Vue integration study (中文, 193 lines)
│   └── spec-framework.md      # UI framework spec
├── how-to-iterate.md          # Phase A iteration recipes (kept for reference)
├── public/                    # Static assets served as-is
├── src/
│   ├── main.ts                # App entry: Pinia + persisted-state + Router
│   ├── App.vue                # Root shell (<RouterView/>)
│   ├── style.css              # Tailwind v4 entry + @theme tokens + scrollbar utilities
│   ├── router/
│   │   └── index.ts           # Hash-history routes
│   │
│   ├── engine/                # ① 引擎层 (UI 无关 + 游戏无关，不 import 任何项目模块)
│   │   ├── game-shell/
│   │   │   ├── game-shell.ts  # Phaser.Game 生命周期薄封装
│   │   │   ├── defaults.ts    # SHELL_DEFAULTS (engine 内部 fallback，不是游戏常量)
│   │   │   └── index.ts
│   │   ├── event-bus/
│   │   │   ├── event-bus.ts   # GameEventBus (Map+Set 实现)
│   │   │   └── index.ts
│   │   ├── types.ts           # EventCallback 等引擎级类型
│   │   └── index.ts
│   │
│   ├── contents/              # ② 游戏内容层 (UI 无关，与 Phaser 耦合，但换 UI 不改)
│   │   ├── constants.ts       # ★ SCENE_KEYS / EVENT_KEYS / GAME_CONFIG /
│   │   │                      #   SCROLL_TUNING / PARALLAX_FACTORS /
│   │   │                      #   PLAYER_TUNING / CAMERA_TUNING / POOL_SIZES /
│   │   │                      #   PHASE_IDS / ACTION_IDS / SKILL_IDS /
│   │   │                      #   CAPABILITY_IDS / BIOME_IDS / PICKUP_IDS
│   │   ├── types.ts           # ID 联合、LevelDef（含 scroll/background/foreground）、
│   │   │                      # ParallaxLayerDef、DialogueDef、BossDef、事件 payload
│   │   ├── scenes/
│   │   │   ├── boot-scene.ts  # 生成占位纹理（player / bullet / biome tiles /
│   │   │   │                  # parallax / npc-* / pickup-* / boss-* / enemy-bullet）
│   │   │   │                  # → 切到 GameplayScene
│   │   │   └── gameplay-scene.ts  # 主场景：粘合 LevelRunner / Player / BulletPool /
│   │   │                          # InputSystem / SkillManager / CameraDirector /
│   │   │                          # ParallaxSystem / ScreenBoundsSystem / PhaseController
│   │   ├── entities/
│   │   │   ├── player/
│   │   │   │   ├── player.ts           # 组合式玩家：wrapper + HP + isFlying + capability registry
│   │   │   │   └── capabilities/
│   │   │   │       ├── capability.ts       # Capability 接口
│   │   │   │       ├── move-capability.ts  # 左右移动（isFlying 时 no-op）
│   │   │   │       ├── jump-capability.ts  # 跳跃 + coyote + jump-buffer +
│   │   │   │       │                        # 空中跳次数 (MAX_AIR_JUMPS=1 → 二段跳)
│   │   │   │       ├── shoot-capability.ts # 射击；持有 BulletPool 引用
│   │   │   │       └── fly-capability.ts   # 4 方向自由飞行；关重力；isFlying=true
│   │   │   ├── projectile/
│   │   │   │   └── bullet-pool.ts      # 通用子弹对象池（玩家 + 敌方共用）
│   │   │   ├── npc/
│   │   │   │   └── npc-entity.ts       # 剧情 NPC：sprite + zone + "!" 气泡；暴露 dialogueId
│   │   │   └── boss/
│   │   │       └── boss-entity.ts      # Boss 占位：悬停 + 三连散射 + HP 条事件
│   │   ├── systems/
│   │   │   ├── input-system.ts         # 按键 → ActionId；mask / 边沿事件 / 连续查询
│   │   │   ├── camera-director.ts      # follow / auto-right / lock 模式 + shake / flash
│   │   │   ├── parallax-system.ts      # 多层 TileSprite + scrollFactor
│   │   │   ├── screen-bounds-system.ts # 玩家夹在相机可视窗口内；被挤死回调
│   │   │   ├── level-runner.ts         # LevelDef → StaticGroups；checkpoint / pickup /
│   │   │   │                           # npc / boss-trigger / level-exit 查询 helper
│   │   │   ├── skill-manager.ts        # 技能注册 / unlock / equip / suppress
│   │   │   ├── dialogue-runner.ts      # DialogueDef FSM；发 DIALOGUE_* 事件 + commandHandler
│   │   │   ├── phase-controller.ts     # FSM core + RunningPhase / RespawnPhase
│   │   │   └── phases/
│   │   │       ├── dialogue-phase.ts   # pause physics + input mask + auto-end on DIALOGUE_END
│   │   │       └── boss-phase.ts       # lock camera + enemy bullets + colliders + emit phase-cleared
│   │   ├── data/
│   │   │   ├── levels/
│   │   │   │   ├── level-01.ts         # 草原 biome + sage NPC + flight orb + exit→level-02
│   │   │   │   └── level-02.ts         # 太空 biome + warrior NPC + boss-trigger(shadow) + exit→level-01
│   │   │   ├── skills/
│   │   │   │   └── skill-registry.ts   # SkillId → SkillDef (shoot / flight)
│   │   │   ├── dialogues/
│   │   │   │   ├── npc-sage.ts         # 开场 + 分支（送飞行 / 不送）
│   │   │   │   ├── npc-warrior.ts      # Boss 前独白
│   │   │   │   └── index.ts            # DIALOGUE_REGISTRY
│   │   │   └── bosses/
│   │   │       ├── boss-shadow.ts      # 影之使徒：10 HP + wisp 贴图
│   │   │       └── index.ts            # BOSS_REGISTRY
│   │   └── index.ts
│   │
│   ├── runtime/               # ③ 运行时胶水层 (Vue 侧模块级单例)
│   │   ├── event-bus.ts       # useEventBus() 单例
│   │   ├── game.ts            # useGame() 单例 (包装 GameShell)
│   │   └── index.ts
│   │
│   ├── composables/           # ④ 真·Vue composables (暂空)
│   │   └── index.ts
│   │
│   ├── components/
│   │   ├── game-button.vue    # BEM-styled button, primary/secondary variants
│   │   ├── game-hud.vue       # HUD：HP hearts + 固定热键技能槽（J/K/L）+ boss HP bar
│   │   └── dialogue-overlay.vue  # 对话覆盖层：speaker + text + choices；键盘 1/2/Enter 操作
│   │
│   └── pages/
│       ├── home-page.vue      # Home menu
│       ├── how-to-play.vue    # Instructions
│       ├── about-us.vue       # Credits
│       ├── game.vue           # Game shell: pause overlay, ESC, exit
│       └── game-demo/
│           └── index.vue      # Vue 挂载点：init(container, BootScene) + addScene(GameplayScene)
├── AGENTS.md                  # ← this file
├── README.md
├── index.html
├── package.json
├── vite.config.ts             # @ alias → ./src ; vue + tailwind plugins
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
└── pnpm-lock.yaml
```

`composables/` 目前是空 stub；新的 `useXxx()` hook（返回 `Ref` 或依赖组件生命周期）放这里，全局单例服务放 `runtime/`。

**Import direction inside `contents/`**（从外向内，不可反向）：
`scenes/ → systems/ + entities/ + data/ → constants/types`。entities 之间不互相 import（capability 只读 Player 状态 + InputSystem，不 import 其它 capability）。systems 之间也不互相 import，除非是"注入依赖"（`CameraDirector` 注入到 `ScreenBoundsSystem` / `ParallaxSystem` 构造函数）。

---

## 13.2 Routes

*Last updated: 2026-04-25;00:01. Source of truth: `src/router/index.ts`.*

| Path | Name | Component | Purpose |
|---|---|---|---|
| `/` | `home` | `pages/home-page.vue` | Title + menu |
| `/how-to-play` | `how-to-play` | `pages/how-to-play.vue` | Instructions |
| `/about-us` | `about-us` | `pages/about-us.vue` | Credits |
| `/game` | `game` | `pages/game.vue` | Game host (mounts Phaser via `game-demo/index.vue`) |

History mode: **hash** (`createWebHashHistory`).

---

## 13.3 Phaser scenes

*Last updated: 2026-04-26;13:10. Source of truth: `src/contents/scenes/` and `src/contents/constants.ts` → `SCENE_KEYS`.*

| Key (string) | Class | File | Role | Init data |
|---|---|---|---|---|
| `BootScene` | `BootScene` | `src/contents/scenes/boot-scene.ts` | 生成占位纹理（core + biome tiles + parallax + npc + pickup + boss + enemy-bullet）+ 进度条 → `game.switchToScene(GameplayScene)` | none |
| `GameplayScene` | `GameplayScene` | `src/contents/scenes/gameplay-scene.ts` | 自动滚动平台场景：auto-scroll-right + 视差 + 屏幕夹紧 + 跳 / 射 / 飞 / 受伤 / 摔死 / 重生；内含 PhaseController (running + respawn) | `IGameplaySceneData = { startCheckpointId?, levelId?, unlockedSkills? }` |
| ~~`GameScene`~~ | ~~`GameScene`~~ | ~~`src/contents/scenes/game-scene.ts`~~ | ~~星星收集 demo~~ | 2026-04-26;12:40 删除；被 `GameplayScene` 取代 |

场景装载顺序在 `src/pages/game-demo/index.vue` → `useGame().initGame(container, BootScene)` + `addScene(GameplayScene)`。`BootScene.create()` 末尾调 `game.switchToScene(GAMEPLAY)`，Phaser 会自动把 `GameplayScene.init(data)` 接上。`completeLevel(nextLevelId)` 会在关卡结束时 `scene.restart({ levelId, unlockedSkills })`，跨关保留解锁的 skill（例如飞行）。

`PHASE_IDS` 现已声明：`RUNNING` / `RESPAWN` / `DIALOGUE` / `BOSS` / `CUTSCENE` / `LEVEL_END`。Phase A2 只接线 `RUNNING` + `RESPAWN`；其它 id 留给 demo commit。

---

## 13.4 Game entities

*Last updated: 2026-04-26;14:00. Source of truth: `src/contents/entities/**` and `src/contents/systems/level-runner.ts` (静态对象).*

实体按"谁管它"分三栏。活物 entity 走 `contents/entities/`；静态世界物件由 `LevelRunner` 从 `LevelDef` 批量物化，不必各自建文件；纯标记（NPC / boss-trigger / level-exit）存到 `LevelRunner` 内部 Map，scene 按 id/x 查。

### 活物

| Entity | Type | Texture key | Defined in | Notes |
|---|---|---|---|---|
| Player | `Player` wrapper around `Phaser.Physics.Arcade.Sprite` | `player` | `src/contents/entities/player/player.ts` | 组合式：HP / 无敌帧 / facing / `isFlying` / capability registry。`MoveCapability` + `JumpCapability` 作为 passive 常驻；active 技能（`ShootCapability` / `FlyCapability`）经 `SkillManager` 动态挂载 |
| Player bullets | `BulletPool` 包装 `Phaser.Physics.Arcade.Group` | `bullet` | `src/contents/entities/projectile/bullet-pool.ts` | 对象池 `maxSize = POOL_SIZES.PLAYER_BULLETS`；寿命超过 `PLAYER_TUNING.BULLET_LIFETIME_MS` 或撞墙即回池。**现已通用化**：构造器接受 `textureKey + maxSize + lifetimeMs`，敌方子弹池也用这个类 |
| Enemy bullets | `BulletPool` 实例 | `enemy-bullet` | BossPhase 内部 | 仅在 boss phase 生命周期内存在；`maxSize = POOL_SIZES.ENEMY_BULLETS = 48`，寿命 2000ms |
| NPC | `NpcEntity` | `npc-sage` / `npc-merchant` / `npc-warrior` | `src/contents/entities/npc/npc-entity.ts` | 无物理 sprite + `Phaser.GameObjects.Zone`（static body）作交互 hitbox + 浮动 "!" 气泡；暴露 `id` / `dialogueId` |
| Boss | `BossEntity` | `boss-hulk` / `boss-wisp` / `boss-serpent` | `src/contents/entities/boss/boss-entity.ts` | dynamic body（关重力 + immovable）；悬停摆动 + 三连散射攻击；`takeHit(n)` 扣 HP 并发 `BOSS_HP_CHANGED`；0 HP → `BOSS_DEFEATED` + 死亡动画 |

### Capabilities (挂在 Player 上的能力单元)

| Capability id | File | Kind | Trigger / 行为 |
|---|---|---|---|
| `move` | `entities/player/capabilities/move-capability.ts` | passive | 读 `InputSystem.isDown('move-left' / 'move-right')`；`player.isFlying === true` 时 no-op |
| `jump` | `entities/player/capabilities/jump-capability.ts` | passive | `onAction('jump', 'down')` + coyote + jump-buffer；空中可再按 `PLAYER_TUNING.MAX_AIR_JUMPS` 次（默认 1 = 二段跳）；`player.isFlying` 时 no-op |
| `shoot` | `entities/player/capabilities/shoot-capability.ts` | active | `onAction('shoot', 'down')`；冷却 `PLAYER_TUNING.FIRE_COOLDOWN_MS` |
| `fly` | `entities/player/capabilities/fly-capability.ts` | active | attach 时关重力 + `player.isFlying=true`；update 里读 4 方向 `MOVE_*` action 做加速度 + 阻尼；detach 还原重力 |

### 静态世界物件（由 `LevelRunner.load(def)` 物化）

| 物件 | Phaser 类型 | Texture key | 源数据 | Notes |
|---|---|---|---|---|
| Platforms | `Phaser.Physics.Arcade.StaticGroup` + 独立 `TileSprite` 做视觉 | `tile-{biome}`（按 `LevelDef.biome`） | `PlatformSegmentDef` | Static body setDisplaySize+refreshBody；TileSprite 独立显示避免拉伸糊图 |
| Hazards | `Phaser.Physics.Arcade.StaticGroup` | `hazard` | `HazardSegmentDef` | 每个 sprite `setData('hazardDamage', ...)`；overlap 触发 `player.damage()` |
| Checkpoints | `Phaser.Physics.Arcade.StaticGroup` | `checkpoint` | `CheckpointSegmentDef` | 每个 sprite `setData('checkpointId', id)`；初始 α=0.5，激活后 α=1 |
| Pickups | `Phaser.Physics.Arcade.StaticGroup` | `pickup-flight` / `pickup-hp` | `PickupSegmentDef` | 带浮动 tween；overlap 后 `consumePickup()` disable body 并发 `PICKUP_COLLECTED` |

### 逻辑段（LevelRunner 内部 Map，不占物理 group）

| 段 | 存储 | 查询 API | Notes |
|---|---|---|---|
| NPC | `LevelRunner.npcs: Map<id, NpcSegmentDef>` | `getNpcDef(id)` / `forEachNpc(cb)` | Demo commit 里由 `NpcEntity` 在 `create()` 时物化 |
| Boss trigger | `LevelRunner.bossTriggers: Map<id, BossTriggerSegmentDef>` | `checkBossTrigger(playerX)` | 幂等：每个 trigger 只触发一次 |
| Level exit | `LevelRunner.levelExits: Map<id, LevelExitSegmentDef>` | `findLevelExitAt(x, y, radius?)` | GameplayScene 每帧查；命中后 `completeLevel(nextLevelId)` |

### Collisions wired in `GameplayScene.create`

- `player.sprite ↔ platforms` (collider)
- `playerBullets.group ↔ platforms` (collider → `BulletPool.kill`)
- `player.sprite ↔ hazards` (overlap → `Player.damage(dmg, 'hazard')`)
- `player.sprite ↔ checkpoints` (overlap → `LevelRunner.handleCheckpointTouched`)
- `player.sprite ↔ pickups` (overlap → `handlePickup` → `SkillManager.equip(FLIGHT)` 等)

### Death causes

- `fall`：`player.sprite.y > level.height + GAME_CONFIG.FALL_DEATH_MARGIN`（每帧检测）
- `crush`：`ScreenBoundsSystem.onCrush()` —— 被 auto-scroll 推挤到左边缘时
- `hazard`：HP 归零 in `Player.damage(_, 'hazard')`
- `enemy`（reserved）：未来敌人子弹 / 接触伤害触发

---

## 13.5 EventBus events

*Last updated: 2026-04-26;14:00. Source of truth: `src/contents/constants.ts` → `EVENT_KEYS`. Bus implementation: `src/engine/event-bus/event-bus.ts`.*

Payload 类型定义在 `src/contents/types.ts`（按事件一对一）。Typed 订阅端应把 `unknown` 强转为 payload 类型。

| Key constant | String | Direction | Payload type | Emitted by | Listened by |
|---|---|---|---|---|---|
| `GAME_OVER` | `game:over` | Phaser/Runtime → Vue | *(none)* | `runtime/game.ts` `quitGame` | — (reserved) |
| `GAME_RESTART` | `game:restart` | Vue → Phaser | *(none)* | *(no emitter yet; handler lives on scene for future UI wiring)* | `GameplayScene.handleRestart` |
| `GAME_PAUSE` | `game:pause` | Vue → Phaser | *(none)* | `pages/game.vue` `pauseGame` | `GameplayScene.handlePause` |
| `GAME_RESUME` | `game:resume` | Vue → Phaser | *(none)* | `pages/game.vue` `resumeGame` | `GameplayScene.handleResume` |
| `PLAYER_HP_CHANGED` | `player:hp-changed` | Phaser → Vue | `PlayerHpChangedPayload` | `Player.damage` / `Player.kill` / `Player.respawn` / `GameplayScene.create` | `components/game-hud.vue` |
| `PLAYER_DAMAGED` | `player:damaged` | Phaser → Vue | `PlayerDamagedPayload` | `Player.damage` | — (reserved for hit SFX / shake hooks) |
| `PLAYER_DIED` | `player:died` | Phaser → Phaser | `PlayerDiedPayload` | `Player.die` | `GameplayScene.handlePlayerDied` → phase `respawn` |
| `PLAYER_RESPAWNED` | `player:respawned` | Phaser → Vue | `PlayerRespawnedPayload` | `Player.respawn` | — (reserved) |
| `CHECKPOINT_REACHED` | `checkpoint:reached` | Phaser → Vue | `CheckpointReachedPayload` | `GameplayScene` checkpoint overlap | — (reserved for toast) |
| `LEVEL_COMPLETED` | `level:completed` | Phaser → Vue | `LevelCompletedPayload` | `GameplayScene.completeLevel` | — (reserved; demo commit 会加过关面板) |
| `PICKUP_COLLECTED` | `pickup:collected` | Phaser → Vue | `PickupCollectedPayload` | `GameplayScene.handlePickup` | — (reserved for toast) |
| `DIALOGUE_START` | `dialogue:start` | Phaser → Vue | `DialogueStartPayload` | `DialogueRunner.start` | `components/dialogue-overlay.vue` |
| `DIALOGUE_NODE` | `dialogue:node` | Phaser → Vue | `DialogueNodePayload` | `DialogueRunner.emitNode` | `components/dialogue-overlay.vue` |
| `DIALOGUE_CHOICE_SELECTED` | `dialogue:choice-selected` | Vue → Phaser | `DialogueChoiceSelectedPayload` | `components/dialogue-overlay.vue` | `DialogueRunner.onChoice` |
| `DIALOGUE_ADVANCE` | `dialogue:advance` | Vue → Phaser | *(none)* | `components/dialogue-overlay.vue` + `DialoguePhase.onInput` | `DialogueRunner.onAdvance` |
| `DIALOGUE_END` | `dialogue:end` | Phaser → Vue | `DialogueEndPayload` | `DialogueRunner.end` | `components/dialogue-overlay.vue` + `DialoguePhase.onDialogueEnd` → transition running |
| `BOSS_SPAWNED` | `boss:spawned` | Phaser → Vue | `BossSpawnedPayload` | `BossEntity` constructor (inside BossPhase) | `components/game-hud.vue` (boss HP bar) |
| `BOSS_HP_CHANGED` | `boss:hp-changed` | Phaser → Vue | `BossHpChangedPayload` | `BossEntity.takeHit` / constructor | `components/game-hud.vue` |
| `BOSS_DEFEATED` | `boss:defeated` | Phaser → Vue | `BossDefeatedPayload` | `BossEntity.die` | `components/game-hud.vue` + `BossPhase.onBossDefeated` |
| `PHASE_CHANGED` | `phase:changed` | Phaser → Vue | `PhaseChangedPayload` | `PhaseController.transition` | — (reserved; debug log when `GameplayScene.debug`) |
| `SKILL_UNLOCKED` | `skill:unlocked` | Phaser → Vue | `{ id: SkillId }` | `SkillManager.unlock` | — (reserved) |
| `SKILL_EQUIPPED` | `skill:equipped` | Phaser → Vue | `SkillEquippedPayload` | `SkillManager.equip` | `components/game-hud.vue` |
| `SKILL_REVOKED` | `skill:revoked` | Phaser → Vue | `SkillRevokedPayload` | `SkillManager.unequip` | `components/game-hud.vue` |
| ~~`SCORE_UPDATE`~~ | ~~`score:update`~~ | — | ~~`number`~~ | — | — (2026-04-26;12:40 删除；星星 demo 专用) |

**Rule:** new events are added to `EVENT_KEYS` first, then to the table above, then wired.

---

## 13.6 Asset keys

*Last updated: 2026-04-26;13:10. Source of truth: `src/contents/scenes/boot-scene.ts`.*

All current textures are generated at runtime via `generateTexture` (no files in `public/`). When real art lands, move the loader calls into `BootScene.preload()`, keep the same keys, and drop the generator code.

### Core

| Key | Kind | Size | Generated at | Used by |
|---|---|---|---|---|
| `player` | texture (rect) | 32×48, fill `#4488ff` + white brow for facing | `BootScene.generateCoreTextures` | `Player.sprite` |
| `platform` | texture (rect) | 64×16, green + top highlight | `BootScene.generateCoreTextures` | fallback when no biome (rare) |
| `hazard` | texture (rect + triangles) | 32×16, red spikes | `BootScene.generateCoreTextures` | `LevelRunner.hazards` (scaled per-segment) |
| `checkpoint` | texture (flag + pole) | 16×48, cyan/blue | `BootScene.generateCoreTextures` | `LevelRunner.checkpoints` (alpha 0.5 inactive → 1.0 active) |
| `bullet` | texture (rect) | 8×4, yellow | `BootScene.generateCoreTextures` | `BulletPool` (`group.defaultKey`) |

### Biome tiles (32×16, TileSprite 铺砖)

| Key | Biome | Palette |
|---|---|---|
| `tile-grass` | `grass` | 棕土 + 绿顶 |
| `tile-stone` | `stone` | 灰砖 + 竖缝 |
| `tile-ice` | `ice` | 浅蓝 + 白高光 |
| `tile-space` | `space` | 深紫 + 电路高光 |

### Parallax layers (512×N, TileSprite + scrollFactor)

| Key | Size | Role |
|---|---|---|
| `px-sky-day` | 512×200 | 昼间渐变 |
| `px-sky-night` | 512×200 | 夜空 + 星点（space biome） |
| `px-mountains-far` | 512×160 | 远山剪影 |
| `px-mountains-near` | 512×120 | 近山（更饱和） |
| `px-trees` | 512×80 | 树林 |
| `px-fg-grass` | 512×32 | 前景草叶（scrollFactor > 1） |
| `px-fg-clouds` | 512×60 | 前景飘云（space 场景用） |

### NPC (32×48)

| Key | Variant | Palette |
|---|---|---|
| `npc-sage` | sage | 紫袍 + 白胡 |
| `npc-merchant` | merchant | 绿衣 + 金 $ |
| `npc-warrior` | warrior | 红甲 + 剑鞘 |

### Pickup (24×24)

| Key | Kind | Visual |
|---|---|---|
| `pickup-flight` | `flight-orb` | 金色环 + 翅膀 |
| `pickup-hp` | `hp-crystal` | 红心 |

### Boss

| Key | Variant | Size |
|---|---|---|
| `boss-hulk` | hulk | 96×96 |
| `boss-wisp` | wisp | 96×96 |
| `boss-serpent` | serpent | 128×96 |

### Enemy bullets

| Key | Kind | Size |
|---|---|---|
| `enemy-bullet` | 紫色圆点 | 10×10 |

### Deprecated

| Key | Note |
|---|---|
| ~~`star`~~ | 2026-04-26;12:40 删除 |

No audio keys yet. When added, create a separate `ASSET_KEYS.AUDIO` table.

---

## 13.7 Shared TypeScript types / interfaces

*Last updated: 2026-04-26;13:10. Source of truth: `src/contents/types.ts` (游戏类型) + scattered local `interface Props` in Vue SFCs.*

| Symbol | Defined in | Used by | Purpose |
|---|---|---|---|
| `SceneKey`, `PhaseId`, `ActionId`, `SkillId`, `CapabilityId`, `BiomeId`, `PickupId` | `src/contents/types.ts` | scenes / systems / capabilities / data | 从 `constants.ts` 的 `as const` 对象反推的字面量联合；全局 ID 词汇表 |
| `IGameplaySceneData` | `src/contents/types.ts` | `GameplayScene.init` | `{ startCheckpointId?, levelId?, unlockedSkills? }`；跨关传参 |
| `ParallaxLayerDef` | `src/contents/types.ts` | `LevelDef.background` / `.foreground`, `ParallaxSystem` | 单层视差定义：textureKey + scrollFactor + y/anchor + tint/alpha/depth |
| `ScrollMode`, `LevelScrollDef` | `src/contents/types.ts` | `LevelDef.scroll`, `GameplayScene` | 'auto-right' / 'follow' / 'locked' + speed |
| `PlatformSegmentDef` / `HazardSegmentDef` / `CheckpointSegmentDef` / `PickupSegmentDef` / `NpcSegmentDef` / `BossTriggerSegmentDef` / `LevelExitSegmentDef` / `SegmentDef` | `src/contents/types.ts` | `data/levels/*` + `LevelRunner.load` | 关卡数据的 discriminated union（`type` 字段） |
| `LevelDef` | `src/contents/types.ts` | `data/levels/*` | `{ id, width, height, biome, scroll?, spawn?, background?, foreground?, segments[] }` |
| `LoadedLevel` | `src/contents/types.ts` | `LevelRunner` | 运行时关卡结构体（含 platforms / hazards / checkpoints / pickups StaticGroups） |
| `SkillKind`, `SkillDef` | `src/contents/types.ts` | `data/skills/*`, `SkillManager` | `{ id, displayName, kind, capabilities[], hotkey?, suppresses? }` |
| `DialogueDef`, `DialogueNode`, `DialogueChoice`, `DialogueCommand` | `src/contents/types.ts` | demo commit: `DialogueRunner` + `data/dialogues/*` | 节点树 + 命令（grant-skill / equip-skill / heal / set-flag） |
| `BossDef` | `src/contents/types.ts` | demo commit: `BossEntity` + `data/bosses/*` | `{ id, displayName, maxHp, spawnX, spawnY, sprite? }` |
| `PlayerHpChangedPayload`, `PlayerDamagedPayload`, `PlayerDiedPayload`, `PlayerRespawnedPayload` | `src/contents/types.ts` | `Player` + `components/game-hud.vue` | EventBus payloads for player lifecycle |
| `CheckpointReachedPayload`, `LevelCompletedPayload`, `PickupCollectedPayload` | `src/contents/types.ts` | `GameplayScene` + HUD | 关卡进度事件 |
| `DialogueStartPayload` / `DialogueNodePayload` / `DialogueChoiceSelectedPayload` / `DialogueEndPayload` | `src/contents/types.ts` | demo commit: dialogue overlay | 对话 UI 同步 |
| `BossSpawnedPayload`, `BossHpChangedPayload`, `BossDefeatedPayload` | `src/contents/types.ts` | demo commit: boss HP bar | Boss 战 HUD |
| `PhaseChangedPayload` | `src/contents/types.ts` | `PhaseController` + HUD | `{ from, to }` |
| `SkillEquippedPayload`, `SkillRevokedPayload` | `src/contents/types.ts` | `SkillManager` + `components/game-hud.vue` | 装备/卸载技能的 HUD 同步 |
| `CapabilityContext`, `Capability` | `src/contents/entities/player/capabilities/capability.ts` | all capabilities + `Player` | Capability 接口（`attach / detach / update? / onAction?`） |
| `CameraMode` | `src/contents/systems/camera-director.ts` | scene 侧查询当前相机模式 | `'follow' \| 'auto-right' \| 'lock'` |
| `ScreenBoundsConfig`, `CrushCallback` | `src/contents/systems/screen-bounds-system.ts` | scene 侧配置夹紧行为 | `{ clampY, pad* }` |
| `PhaseContext`, `Phase` | `src/contents/systems/phase-controller.ts` | Phase 实现 | `{ scene, player, levelRunner, inputSystem, controller }` |
| `Props` (game-button) | `src/components/game-button.vue` | `<GameButton>` usage | `{ label, variant?: 'primary' \| 'secondary' }` |

When an EventBus payload becomes non-trivial (e.g. `GAME_OVER` carrying final score + cause), define a named type here and import it at both ends.

---

## 13.8 State stores

*Last updated: 2026-04-26;13:10.*

- **Pinia**: installed and mounted (`src/main.ts`), persisted-state plugin enabled. **No stores defined yet.** When you add one, create `src/stores/<name>-store.ts` and register it here.
- **Phaser Registry**: unused so far. Cross-level persistence currently done via `IGameplaySceneData.unlockedSkills` passed into `scene.restart(data)`. If we need true multi-session persistence (e.g. "has this player ever unlocked flight?"), promote to a Pinia `progressStore`.
- **Vue reactive**: in-component `ref` / `reactive` only (no shared reactive singletons outside Pinia).

| Store / key | Location | Kind | Persisted? | Purpose |
|---|---|---|---|---|
| *(none)* | — | — | — | — |

---

## 13.9 Work in progress (WIP)

*Claim an area before starting a multi-turn feature. Clear your row when done.*

| Owner | Area / files | Started | Notes |
|---|---|---|---|
| *(none)* | — | — | — |
| ~~agent:kilo/2026-04-26~~ | ~~Phase A: runner skeleton~~ | ~~2026-04-26;12:27~~ | **DONE 2026-04-26;12:40** — vertical slice playable |
| ~~agent:kilo/2026-04-26~~ | ~~Phase A2: auto-scroll + parallax + flight architecture~~ | ~~2026-04-26;12:55~~ | **DONE 2026-04-26;13:10** — see §14; architecture + APIs only, demo entities arrive in next commit |
| ~~agent:kilo/2026-04-26~~ | ~~Demo: dialogue + NPC + boss + level-02~~ | ~~2026-04-26;13:30~~ | **DONE 2026-04-26;14:00** — see §14; all reserved event keys now live, boss HP bar in HUD, two playable levels |

---

## 13.10 Decision log (append-only)

Record non-obvious architectural choices so future agents don't re-litigate them.

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-25;00:01 | Use Arcade physics (not Matter) as default | Simpler API, enough for 2D jam games; swap only if a feature requires it |
| 2026-04-25;00:01 | EventBus built on `EventTarget` (not mitt/EventEmitter) | Zero-dependency, browser-native, simple typing |
| 2026-04-25;00:01 | Placeholder textures generated via `graphics.generateTexture` | Lets gameplay ship before art; keys stay stable when real art replaces them |
| 2026-04-25;00:01 | Router uses hash history | Works for `file://` and static hosting without server config |
| 2026-04-25;00:01 | Pinia + persisted-state installed but unused | Reserved for real-game save data; no stub stores until needed |
| 2026-04-25;00:01 | `game-demo/` is reference-only and will be deleted | New game code should live at `src/pages/game/` (or similar) and import from `src/core/` — not extend the demo in place |
| 2026-04-26;01:20 | 分层重构：`core/` → `engine/` + 新增 `contents/` + `composables/runtime/` → `runtime/` | 四层职责正交：engine 换游戏不改、contents 换 UI 不改、runtime 仅做 Vue 胶水、pages 仅 UI |
| 2026-04-26;01:20 | `createGameShell(container, initialScene)` 签名不接受 config 对象 | 避免 Java-style 构造参数爆炸；游戏要覆盖画幅 / 物理就在 `BootScene.init()` 里用 Phaser 原生 API |
| 2026-04-26;01:20 | `src/pages/game-demo/` 只保留 `index.vue` | Vue 侧"如何挂载一个 Phaser 游戏"是 page 层的职责；场景本身是游戏内容，住 `contents/` |
| 2026-04-26;01:35 | `contents/` 的定位是"UI 无关 + 与 Phaser 耦合" | 分层判据是"另一个 Phaser jam 游戏能不能复用"，engine 能复用、contents 不能复用，两边都可 import Phaser |
| 2026-04-26;01:35 | scenes 留在 `contents/scenes/`，不单拎为顶层 `src/scenes/` | scenes 高度依赖 `contents/constants` / `types` / `entities`；jam 节奏下内容层向内生长而非向外膨胀 |
| 2026-04-26;01:35 | `runtime/` → `contents/` 一律走深路径，禁止走桶 | `contents/scenes/*` 顶层调 `useGame()` / `useEventBus()`；桶导出会拖入 scenes 触发循环启动 |
| 2026-04-26;12:40 | Phase A：**单 scene + PhaseController FSM** | 场景切换丢世界状态；"map morph" / boss 接玩家 等跨阶段变化要求同一世界持续 |
| 2026-04-26;12:40 | Phase A：**Player 用组合 + Capability Registry** | 继承锁死"玩家能做什么"；capability 模式下加技能 = 新文件 + 注册一行，不动 Player |
| 2026-04-26;12:40 | 所有输入走 **InputSystem 语义 Action 层** | 支持按阶段屏蔽 / 手柄 / 重绑键位 / 回放，都免改 capability |
| 2026-04-26;12:40 | 玩法参数拆分：`GAME_CONFIG` / `PLAYER_TUNING` / `CAMERA_TUNING` / `POOL_SIZES` | "Vibe coding" 的调参必须一目了然 |
| 2026-04-26;12:40 | 关卡以 **TS `as const` discriminated union**（非 JSON / Tiled） | Jam 节奏下数据就是代码；DU + type 字段让 LevelRunner 的 switch 类型安全 |
| 2026-04-26;12:40 | Phase A **不引入 Pinia store**（持久化延后） | 跑酷骨架只需要 per-run 状态；Registry + 场景字段够用 |
| 2026-04-26;12:40 | 不起并行 `UIScene`（HUD 走 Vue 覆盖层） | Vue 拥有 HUD 分工；Phaser UIScene 仅在"画布内浮动元素"时再建 |
| 2026-04-26;13:10 | **World 向左流过 = 相机 auto-scroll-right**（不写 platforms 的 velocity） | 所有物理对象都在世界空间不动；相机滚带来视觉位移；视差 / 碰撞 / 屏幕夹紧 都能套 Phaser 原生 API（scrollFactor / camera.setScroll / camera.setBounds），无需自定义物理帧对齐 |
| 2026-04-26;13:10 | **视差用 `TileSprite + scrollFactor`**，不手写 tilePosition 每帧对齐 | Phaser 已经正确处理 scrollFactor × camera.scroll；多数情况 tilePositionX 自动推导无缝。特例可在 `ParallaxSystem.update()` hook 补修正 |
| 2026-04-26;13:10 | **ScreenBoundsSystem 独立于 FlyCapability** | 两者关心同一件事（"不出屏幕"）但触发条件不同：飞行时硬夹，跑酷时被相机挤压触发 `crush` 死亡。拆开后"滚动节" / "非飞行保留可向右探出屏幕"都是 setConfig 一行能调的 |
| 2026-04-26;13:10 | **Fly ≠ Jump suppress**：FlyCapability 通过 `player.isFlying` 让 Move/Jump 自我闭嘴，不 detach | 保持 SkillManager 语义简洁（"装了一个 skill"）；`isFlying` 也是 boss 阶段检测 / 压制的最简 API |
| 2026-04-26;13:10 | **Platform 视觉 = 独立 `TileSprite`**，物理体 `setVisible(false)` 贴在下面 | Arcade StaticBody 用 `setScale` 会把 64×16 底图拉成巨大色块；拆视觉和碰撞后底图保持 32×16 原色，TileSprite 自动铺砖，无需 Phaser Tilemap 的重型 pipeline |
| 2026-04-26;13:10 | **Level 间解锁通过 `IGameplaySceneData.unlockedSkills` 显式传递**，不引 Pinia | Phase A2 demo 只两关；显式传参比建 store 简单得多。真多关进度（成就 / 金币 / 重复挑战）出现时再升格到 `progressStore` |
| 2026-04-26;13:10 | **跳跃次数配置化 `MAX_AIR_JUMPS`**（默认 1 → 二段跳） | "二段跳是默认能力"是本项目的设计倾向；改数字即可变三段跳 / 单段跳，不改 capability 代码 |
| 2026-04-26;13:10 | **BIOME_IDS 与 `tile-{biome}` 纹理一一对应** | 关卡美术主题更换不改代码，换 `LevelDef.biome` 就行；BootScene 生成全部 biome 贴图，按需选 |
| 2026-04-26;14:00 | **Phases 进入 `systems/phases/` 子目录** | 单文件一 phase：`dialogue-phase.ts` / `boss-phase.ts` 各自 import 独立，`phase-controller.ts` 仅保留 FSM core + 默认的 Running/Respawn。未来加 CutscenePhase / LevelEndPhase 只加文件，不膨胀核心 |
| 2026-04-26;14:00 | **Phase ↔ Scene 交互走 `scene.data` 字典**（cameraDirector / playerBulletsGroup / bossPhaseLevelId） | 给 PhaseContext 再加字段会让 core phase 被迫感知 boss/enemy 概念；用 `scene.data.get(key)` 做"按需查找"更松耦合。BossPhase / DialoguePhase 自己的"scene-local 事件"用 `this.scene.events.emit` 而非 eventBus（eventBus 是 Vue ↔ Phaser 跨界用的） |
| 2026-04-26;14:00 | **Boss 接触 / 子弹命中 colliders 在 BossPhase.enter 里挂，exit 里销毁** | 生命周期和 Boss 一致；RunningPhase 下不该存在 boss colliders 否则 player 会和"看不见的 boss"叠图。`Phaser.Physics.Arcade.Collider.destroy()` 是便宜操作，jam 阶段按 phase 边界挂拆是最清晰的模型 |
| 2026-04-26;14:00 | **Flight 拾取 ≡ NPC "take" 选项**（两条路径解锁同一 skill） | Demo 里两关都能通关：sage 送 / 捡 orb / 进 level-02 必给。设计上"可选路径"比"强制路径"更符合 jam 可玩性调校；SkillManager.equip 幂等，重复拿不会炸 |

---

## 14. Change log

One line per change that touches §13. Newest at the top. Keep it short.

- **2026-04-26;14:00** — Comprehensive demo on top of Phase A2. New entities `NpcEntity` + `BossEntity` (dir `entities/npc/` + `entities/boss/`); new `DialogueRunner` system + Vue `components/dialogue-overlay.vue`; `phase-controller.ts` split — `systems/phases/dialogue-phase.ts` + `systems/phases/boss-phase.ts`. `BulletPool` generalized (textureKey + maxSize + lifetimeMs params) so enemy bullets reuse it. New level `data/levels/level-02.ts` (space biome, Boss "影之使徒" at end, loops back to level-01). `level-01.ts` gains Sage NPC + `nextLevelId: 'level-02'`. Dialogue registry `data/dialogues/{npc-sage,npc-warrior,index}.ts`; boss registry `data/bosses/{boss-shadow,index}.ts`. All previously-reserved `DIALOGUE_*` / `BOSS_*` / `LEVEL_COMPLETED` / `PICKUP_COLLECTED` events now live; `components/game-hud.vue` renders boss HP bar. §13.1 / §13.4 / §13.5 updated; §13.10 +4 decisions.
- **2026-04-26;13:10** — Phase A2 architecture refactor: auto-scroll + 3-layer parallax + screen-bound clamp + double-jump + flight capability/skill. New systems `ParallaxSystem` / `ScreenBoundsSystem`; `CameraDirector` gained `auto-right` mode; `JumpCapability` gained `MAX_AIR_JUMPS`; `Player.isFlying` flag; `FlyCapability` manages gravity + 4-dir input. `LevelDef` extended with `biome` / `scroll` / `background` / `foreground`; new segment types `pickup` / `npc` / `boss-trigger` / `level-exit` (runtime for NPC/boss arrives in demo commit). New EVENT_KEYS: `LEVEL_COMPLETED`, `PICKUP_COLLECTED`, `DIALOGUE_{START,NODE,CHOICE_SELECTED,ADVANCE,END}`, `BOSS_{SPAWNED,HP_CHANGED,DEFEATED}`. New ACTION_IDS: `MOVE_UP`, `MOVE_DOWN`, `ADVANCE`, `CHOICE_1`, `CHOICE_2`. New SKILL `flight`; new CAPABILITY `fly`; new BIOME_IDS / PICKUP_IDS. Many new asset keys (biome tiles, parallax layers, NPC/pickup/boss/enemy-bullet variants). 7 new §13.10 decisions.
- **2026-04-26;12:40** — Phase A runner skeleton shipped. `SCENE_KEYS.GAME` → `SCENE_KEYS.GAMEPLAY`; `game-scene.ts` deleted, replaced by `gameplay-scene.ts`. New subtrees: `contents/{entities,systems,data}/**`. New `EVENT_KEYS`: PLAYER_{HP_CHANGED,DAMAGED,DIED,RESPAWNED}, CHECKPOINT_REACHED, PHASE_CHANGED, SKILL_{UNLOCKED,EQUIPPED,REVOKED}; dropped SCORE_UPDATE. New asset keys: bullet / hazard / checkpoint; dropped star. New HUD: `components/game-hud.vue`. `constants.ts` split into GAME_CONFIG / PLAYER_TUNING / CAMERA_TUNING / POOL_SIZES / PHASE_IDS / ACTION_IDS / SKILL_IDS / CAPABILITY_IDS. 7 new §13.10 decisions documented.
- **2026-04-26;01:35** — 修正 `contents/` 分层描述（"UI 无关 + 与 Phaser 耦合"，不是"引擎无关"）；确认 scenes 留在 `contents/scenes/` 不外拎；新增"runtime → contents 必须走深路径"规则到 §11；同步 §13.10 决策日志（三条新决策）。
- **2026-04-26;01:20** — 分层重构：`core` → `engine`；新增 `contents` 作为游戏内容层（场景/常量/类型的唯一源）；`composables/runtime` → `runtime`（提升到顶级）；`game-demo` 只保留 Vue 挂载示范。同步 §11 / §13.1 / §13.3 / §13.10；engine 不再依赖 `GAME_CONFIG`，改用内部 `SHELL_DEFAULTS`。
- **2026-04-25;00:01** — Initial AGENTS.md rewrite: removed Nuxt / PrimeVue / portal sections irrelevant to this project; added §13 Codebase State registries (routes, scenes, entities, events, assets, types, stores, WIP, decisions) and §0 multi-agent protocol.
