# The Bounder

一个 Game Jam 用 Vue 3 + Phaser 4 + TypeScript starter，已经长成一个有 boss、有对话、有飞行、有 world-strip 美术底图的小型自动横向跑酷+终局 Boss 游戏。

> AI 协作规则在 [`AGENTS.md`](./AGENTS.md)；项目历史 / 决策日志 / 变更日志在 [`CODEBASE_STATE.md`](./CODEBASE_STATE.md)。这份 README 是给**人类**读的入门指南：怎么跑、怎么看、怎么改。

---

## 技术栈

- **Vue 3** Composition API + `<script setup lang="ts">`（UI / 路由 / HUD / 覆盖层）
- **Phaser 4** Arcade 物理（场景 / 物理 / 输入 / 帧循环）
- **TypeScript** 严格模式 (`any` 禁用)
- **Vite 8** + `@` alias → `./src`
- **Tailwind CSS 4** (`@tailwindcss/vite`) + `@theme` tokens + `tw-animate-css`
- **vue-router 4** (hash history)
- **Pinia** + persisted-state plugin（已挂载，但暂未定义 store）
- 工具：`@vueuse/core`、`lucide-vue-next`、`tailwind-merge`、`animate.css`

---

## 快速开始

```bash
pnpm install
pnpm dev          # 开发服务器（Vite）
pnpm build        # 生产构建
pnpm preview      # 预览生产产物
```

游戏入口：`http://localhost:5173/#/game`（默认进入 `world-strip-demo` 线性关卡，跑到底走 `level-exit` 进入 `world-strip-boss` 终极 boss）。

操作：A/D 左右、空格跳（默认二段跳）、J 射击、K 飞（拿到 `flight` 后）、E 与 NPC 对话、Esc 暂停。

---

## 四层架构（最重要的一张图）

```
pages/  →  runtime/  →  contents/  →  engine/
                                       ↑
              (UI 与 Phaser 之间的胶水)   |
                                  (与具体游戏耦合，与 UI 解耦)
                          (与具体游戏 + UI 都解耦的 Phaser 薄封装)
```

**判据**：另一个 Phaser jam 游戏能不能复用？
- `engine/` 能（薄封装 GameShell / EventBus，**不 import** 任何项目模块）
- `contents/` 不能（这就是"这一个游戏"）
- `runtime/` 不能（绑定 Vue 运行时）
- `pages/` 不能（具体页面）

**依赖方向是单向的**：`pages → runtime → contents → engine`。反向 import = 分层错了。

> ⚠️ `runtime/` 引用 `contents/` 必须走深路径（`@/contents/constants` 而非 `@/contents`）。理由见 `AGENTS.md` §11。

---

## 目录速览

```
src/
├── main.ts                # 应用入口：挂 Pinia + persisted-state + router
├── App.vue                # <RouterView/> 外壳
├── style.css              # Tailwind v4 入口 + @theme + 自定义 utilities
├── router/index.ts        # 路由：home / how-to-play / about-us / game
│
├── engine/                # ① 薄封装层
│   ├── game-shell/        # Phaser.Game 生命周期：init / addScene / switchTo / destroy
│   ├── event-bus/         # GameEventBus（基于 EventTarget，零依赖）
│   └── types.ts           # EventCallback 等
│
├── contents/              # ② 游戏内容层（重头戏，几乎所有游戏逻辑都在这里）
│   ├── constants.ts       # ★ 单一来源：场景/事件/资源/调参 全部 as const 在这
│   ├── types.ts           # ★ 单一来源：所有共享 TS 类型
│   ├── scenes/            # BootScene + GameplayScene
│   ├── entities/          # player(+capabilities)、projectile、npc、boss、enemies
│   ├── systems/           # 跑酷的"骨架"：camera/parallax/level/world-strip/
│   │                      # input/skill/dialogue/phase(+phases)/sfx/screen-bounds
│   └── data/              # 关卡 / 技能 / 对话 / boss 的纯数据
│
├── runtime/               # ③ Vue 侧模块级单例
│   ├── event-bus.ts       # useEventBus()
│   └── game.ts            # useGame()（包装 GameShell）
│
├── composables/           # ④ Vue 组件生命周期 hook（目前是空壳）
├── components/            # game-button / game-hud / dialogue-overlay
└── pages/                 # home-page / how-to-play / about-us / game / game-demo
```

`public/` 放外部素材：`bgms/`（BGM mp3）、`sfx/`（短音效 mp3）、`pics/`（world-strip 底图）、`sprites/player/`（玩家真素材）。

---

## 给学习者的阅读路径

按这个顺序读一遍，整个项目就装进脑子里了。

### Step 1 — Vue 是怎么把 Phaser 装进来的（30 分钟）

1. [`src/pages/game.vue`](./src/pages/game.vue) — 游戏页面外壳，处理暂停 / 退出。
2. [`src/pages/game-demo/index.vue`](./src/pages/game-demo/index.vue) — Phaser 真实挂载点：`useGame().initGame(container, BootScene)` + `addScene(GameplayScene)`。
3. [`src/runtime/game.ts`](./src/runtime/game.ts) + [`src/engine/game-shell/game-shell.ts`](./src/engine/game-shell/game-shell.ts) — `useGame()` 单例 + `GameShell` 类怎么薄封装 `new Phaser.Game(...)`。
4. [`src/runtime/event-bus.ts`](./src/runtime/event-bus.ts) + [`src/engine/event-bus/event-bus.ts`](./src/engine/event-bus/event-bus.ts) — Vue ↔ Phaser 唯一的合法通信渠道。

### Step 2 — Phaser 这边的世界（40 分钟）

1. [`src/contents/scenes/boot-scene.ts`](./src/contents/scenes/boot-scene.ts) — 怎么 `load.image / load.audio` + 怎么用 `generateTexture` 生成占位贴图 + 注册全局 `'player-run'` 动画。
2. [`src/contents/scenes/gameplay-scene.ts`](./src/contents/scenes/gameplay-scene.ts) — 主场景。在 `create()` 里把所有 systems 装配起来；`update()` 里每帧推进。这是整个 Phaser 侧的"组装现场"，看完就懂大半。
3. [`src/contents/constants.ts`](./src/contents/constants.ts) — **vibe coding 的旋钮全在这里**。改一个数字就能改"跳得软不软、飞得灵不灵、boss 难不难"。所有 `*_TUNING` 对象都附带中文注释。
4. [`src/contents/types.ts`](./src/contents/types.ts) — 共享类型（`LevelDef`, `SegmentDef`, `WorldStrip*`, EventBus payload）。这是只读 reference。

### Step 3 — 玩家是怎么"动"起来的（30 分钟）

1. [`src/contents/entities/player/player.ts`](./src/contents/entities/player/player.ts) — `Player` wrapper：HP / facing / `isFlying` / capability registry / `updateVisuals()`（地面播跑步动画、空中切静态贴图）。
2. [`src/contents/entities/player/capabilities/`](./src/contents/entities/player/capabilities/) —
   - `move-capability.ts` 左右移动（无输入时按 `BASE_FORWARD_RATIO` 漂移，自动滚动关卡的精髓）
   - `jump-capability.ts` 跳跃 + coyote + jump-buffer + `MAX_AIR_JUMPS`
   - `shoot-capability.ts` 射击（active，要先装备）
   - `fly-capability.ts` 飞行（active，会关重力）
3. [`src/contents/systems/input-system.ts`](./src/contents/systems/input-system.ts) — **键 → 语义 Action**。Capability 永远不直接读键码；要重绑键 / 接手柄 / 关卡屏蔽输入都在这一层。
4. [`src/contents/systems/skill-manager.ts`](./src/contents/systems/skill-manager.ts) — 技能怎么动态装到 Player 上。

### Step 4 — 世界是怎么"流"过来的（30 分钟）

跑酷类游戏的核心是"相机推世界、玩家被夹在屏幕里"——不是玩家在跑：

1. [`src/contents/systems/camera-director.ts`](./src/contents/systems/camera-director.ts) — `follow / auto-right / lock` 三种模式 + shake / flash。
2. [`src/contents/systems/parallax-system.ts`](./src/contents/systems/parallax-system.ts) — `TileSprite + scrollFactor` 多层视差。
3. [`src/contents/systems/screen-bounds-system.ts`](./src/contents/systems/screen-bounds-system.ts) — 把玩家夹在相机视窗内；被推出左缘触发 `crush` 死亡。
4. [`src/contents/systems/level-runner.ts`](./src/contents/systems/level-runner.ts) — 把 `LevelDef.segments` 物化成物理 group；loop 模式用 chunk 滑动窗口实现"无限关卡"。
5. [`src/contents/systems/world-strip-system.ts`](./src/contents/systems/world-strip-system.ts) — 与 `LevelRunner` 平行的"美术整张图当背景"系统：变宽定高图片串 + `overlapNext` + 每图自带地面段。

### Step 5 — 状态机 / 对话 / Boss（30 分钟）

1. [`src/contents/systems/phase-controller.ts`](./src/contents/systems/phase-controller.ts) — FSM 核心 + `RunningPhase` / `RespawnPhase`。`Phase.freezesWorld` 标记 = "这个阶段世界停转"。
2. [`src/contents/systems/phases/dialogue-phase.ts`](./src/contents/systems/phases/dialogue-phase.ts) — 进对话即停世界，`DIALOGUE_END` 后回 RUNNING。
3. [`src/contents/systems/phases/boss-phase.ts`](./src/contents/systems/phases/boss-phase.ts) — boss 战 phase：锁相机 + 复用玩家子弹池做"子弹打 boss" overlap。
4. [`src/contents/systems/dialogue-runner.ts`](./src/contents/systems/dialogue-runner.ts) — `DialogueDef` FSM；命令包括 `grant-skill` / `equip-skill` / `heal` 等。
5. [`src/contents/entities/boss/boss-entity.ts`](./src/contents/entities/boss/boss-entity.ts) — 单 boss 占位实现（悬停 + 三连散射 + HP 条事件）。

### Step 6 — 数据怎么写（最重要的"上手"步骤）

关卡 / 技能 / 对话 / boss 都是 **TS `as const` discriminated union**，不是 JSON、不是 Tiled。

- 关卡：[`src/contents/data/levels/`](./src/contents/data/levels/) — `level-01.ts`（loop=true 草原 demo）、`level-02.ts`（space biome）、`world-strip-demo.ts`（线性 7 图美术关卡）、`world-strip-boss.ts`（终局 boss 单图场景）。
- 技能：[`src/contents/data/skills/skill-registry.ts`](./src/contents/data/skills/skill-registry.ts) — `SkillId → SkillDef`。
- 对话：[`src/contents/data/dialogues/`](./src/contents/data/dialogues/) — sage / warrior + `DIALOGUE_REGISTRY` 索引。
- Boss：[`src/contents/data/bosses/`](./src/contents/data/bosses/) — `boss-shadow.ts` + `BOSS_REGISTRY`。

**写一个新关卡**就读 `level-01.ts` —— 100 行不到，从 `id` / `width` / `biome` / `scroll` 一路看到 `segments[]`，下一关一抄就上线。

---

## 调参速查（"vibe coding"的旋钮）

全在 [`src/contents/constants.ts`](./src/contents/constants.ts)，每个对象都带详细中文注释：

| 想改… | 改这个 |
|---|---|
| 玩家血量 / 子弹 / 跳跃 / 飞行 / 移动 | `PLAYER_TUNING` |
| 全局重力 / 摔死阈值 | `GAME_CONFIG` |
| 自动滚动关卡的相机速度 | `SCROLL_TUNING` |
| 视差层 scrollFactor | `PARALLAX_FACTORS` |
| 相机抖动 / lerp / lookahead | `CAMERA_TUNING` |
| 子弹池 / 敌人池大小 | `POOL_SIZES` |
| 飞行小敌 / 弹幕节奏 | `FLYING_ENEMY_TUNING` / `CODE_DANMAKU_TUNING` |
| BGM / SFX 音量 | `AUDIO_TUNING` |
| 资源 URL（mp3 / 视频） | `BGM_URLS` / `SFX_URLS` / `VIDEO_URLS` |

改一个数字 → `pnpm dev` 立即生效。这是这个项目的核心工作流。

---

## 事件总线

Vue ↔ Phaser **唯一**合法通信通道是 `useEventBus()`（Vue 侧）和 `eventBus`（Phaser scenes 侧顶部 `const eventBus = useEventBus()`）。

- 全部事件名在 `EVENT_KEYS`（[`constants.ts`](./src/contents/constants.ts)）。
- 全部 payload 类型在 [`types.ts`](./src/contents/types.ts)（按事件命名 `*Payload`）。
- 监听规则：在 scene 的 `create()` 里 `eventBus.on(...)`，在 `'shutdown'` 里成对 `off`。永不依赖 GC 卸载。

---

## 关于 AI 协作（如果你也用 Claude / Cursor / Cline 写这个项目）

- AI 的硬规则在 [`AGENTS.md`](./AGENTS.md)（§1–§12 是稳定规则，§0 是多 agent 协作约定）。
- 项目"现在长什么样"的人类可读历史在 [`CODEBASE_STATE.md`](./CODEBASE_STATE.md)：directory map（§13.1）、source-of-truth grep map（§13.2）、WIP（§13.9）、决策日志（§13.10）、变更日志（§14）。
- **核心约定**：场景 / 事件 / 资源 / 类型这些"名字"不在文档里维护，只在 `contents/constants.ts` + `contents/types.ts` 里维护，靠 grep 发现，避免文档与代码漂移。

---

## 历史文档（仅供参考，可能略陈旧）

- [`docs/spec-framework.md`](./docs/spec-framework.md) — 早期 UI/工程框架规格
- [`docs/game-demo.md`](./docs/game-demo.md) — 旧版星星 demo 说明（已被 runner 替代）
- [`docs/phaser-study.md`](./docs/phaser-study.md) — Phaser + Vue 集成学习拆解（193 行中文）
- [`docs/engine-structure.md`](./docs/engine-structure.md) — engine 层结构说明

---

## 开发约定（要点摘要）

- 文件：kebab-case；组件引用：PascalCase；场景类：PascalCase + Scene；事件 key：`namespace:verb`（例 `player:died`）；资源 key：kebab-case 名词。
- 严格 TS：`any` 禁用，宽口走 `unknown` + 收窄。
- 禁止 `var`；除非确实需要重新赋值，否则一律 `const`。
- Phaser 场景：监听器 `create()` 注册，`'shutdown'` 注销；高频生成对象走对象池。
- Vue 组件只渲染 HUD / 菜单 / 覆盖层，**禁止**在 `.vue` 里写游戏决策。
- 占位贴图是 feature 不是 stopgap：先 `generateTexture` 把游戏跑通，美术到位再换。
- 加新依赖必须在 [`CODEBASE_STATE.md`](./CODEBASE_STATE.md) §13.10 留一条决策记录。

完整规则：[`AGENTS.md`](./AGENTS.md)。
