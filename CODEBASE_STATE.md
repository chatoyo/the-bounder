# Codebase State

Living history for `momakoding-jam-starter-web` — a Vue 3 + Phaser 4 + TypeScript Game Jam starter.

> **What lives here vs. in code.**
> This file is the human-curated *history* of the project — decisions, WIP claims, change log, and a high-level directory map. It is **not** a duplicated registry of scene / event / asset / route / type names. Those live in code (`src/contents/constants.ts`, `src/contents/types.ts`, `src/router/index.ts`, the file tree itself) and are discovered by grep, not by reading this file. See [`AGENTS.md`](./AGENTS.md) §0 for the full collaboration protocol.
>
> Section numbering (`§13.x`, `§14`) is preserved for historical change-log references. §13.2–§13.8 were retired on 2026-04-28 — see §13.2 below for the replacement grep map.

---

## 13.1 Directory map

*Last updated: 2026-04-28. Top-level skeleton only — for the full file list, read `src/`.*

```
the-bounder/
├── public/
│   ├── bgms/                # BGM mp3 (menu, level, boss)
│   ├── sfx/                 # Short SFX mp3 (jump, damage, checkpoint, hit, …)
│   ├── pics/                # World-strip backgrounds (1.png/2.png/3.png/4.jpg/boss.png)
│   └── sprites/player/      # Real player art (run frames + jump)
├── src/
│   ├── main.ts              # App entry: Pinia + persisted-state + router
│   ├── App.vue              # <RouterView/> shell
│   ├── style.css            # Tailwind v4 entry + @theme tokens
│   ├── router/              # Hash-history routes
│   │
│   ├── engine/              # ① Engine layer — UI-agnostic, game-agnostic Phaser shell.
│   │                        #   GameShell + GameEventBus + SHELL_DEFAULTS.
│   │                        #   Imports nothing from inside src/. Reusable across jams.
│   │
│   ├── contents/            # ② Content layer — UI-agnostic, Phaser-coupled game world.
│   │   ├── constants.ts     #   ★ SOURCE OF TRUTH for SCENE_KEYS / EVENT_KEYS /
│   │   │                    #     ASSET_KEYS / BGM_URLS / SFX_URLS / GAME_CONFIG /
│   │   │                    #     PLAYER_TUNING / SCROLL_TUNING / CAMERA_TUNING /
│   │   │                    #     PARALLAX_FACTORS / POOL_SIZES / AUDIO_TUNING /
│   │   │                    #     PHASE_IDS / ACTION_IDS / SKILL_IDS /
│   │   │                    #     CAPABILITY_IDS / BIOME_IDS / PICKUP_IDS
│   │   ├── types.ts         #   ★ SOURCE OF TRUTH for shared TS types (LevelDef,
│   │   │                    #     SegmentDef union, WorldStrip*, EventBus payloads,
│   │   │                    #     ID literal unions derived from constants)
│   │   ├── scenes/          #   BootScene + GameplayScene
│   │   ├── entities/        #   player/ (+ capabilities/), projectile/, npc/,
│   │   │                    #     boss/, enemies/
│   │   ├── systems/         #   level-runner, world-strip-system, camera-director,
│   │   │                    #     parallax-system, screen-bounds-system, input-system,
│   │   │                    #     skill-manager, dialogue-runner, phase-controller,
│   │   │                    #     phases/{dialogue,boss}, sfx
│   │   └── data/            #   levels/, skills/, dialogues/, bosses/
│   │
│   ├── runtime/             # ③ Runtime glue — Vue-side module-level singletons
│   │                        #   (useGame, useEventBus). Imports from contents/
│   │                        #   only via deep paths (NEVER the @/contents barrel),
│   │                        #   to avoid scenes loading eagerly during runtime init.
│   │
│   ├── composables/         # ④ Real Vue composables (lifecycle-bound). Empty stub.
│   ├── components/          # Reusable UI (game-button, game-hud, dialogue-overlay)
│   └── pages/               # Route-level components: home, how-to-play, about-us,
│                            #   game, game-demo/index.vue (Phaser mount point)
├── AGENTS.md                # Stable rules for AI agents
├── CODEBASE_STATE.md        # ← this file (history + decisions + WIP + change log)
└── …                        # vite/ts/tailwind config, index.html, package.json
```

**Layer dependency direction (one-way only):** `pages → runtime → contents → engine`.
- `engine/` imports nothing from inside `src/`.
- `contents/` may import `engine/` and `runtime/`; never `pages/`.
- `runtime/ → contents/` must use deep paths (`@/contents/constants`, `@/contents/types`), never the `@/contents` barrel — `contents/scenes/*` runs `useGame()` / `useEventBus()` at module top level, and barrel re-exports would pull scenes into runtime init and trigger ES-module circular startup.

**Inside `contents/`** (also one-way): `scenes → systems + entities + data → constants/types`. Entities don't import each other (capabilities only read Player state + InputSystem). Systems don't import each other except as injected dependencies in constructors (e.g. `CameraDirector` injected into `ScreenBoundsSystem`); cross-system reads otherwise go through `scene.data.get(key)`.

---

## 13.2 Source-of-truth pointers (replaces the old §13.2–§13.8 registries)

*Adopted 2026-04-28.* The old per-section tables (routes / scenes / entities / event keys / asset keys / shared types / state stores) duplicated information that lives authoritatively in code. Maintaining the duplicate caused drift. From now on, **discover by grep**:

| Looking for… | Read this file / grep this symbol |
|---|---|
| Route paths | `src/router/index.ts` |
| Scene keys / classes | `SCENE_KEYS` in `src/contents/constants.ts`; classes in `src/contents/scenes/` |
| Event keys + payloads | `EVENT_KEYS` in `src/contents/constants.ts`; `*Payload` types in `src/contents/types.ts` |
| Asset / texture / animation keys | `ASSET_KEYS` (incl. `ASSET_KEYS.AUDIO`) in `src/contents/constants.ts` |
| BGM / SFX URLs + volumes | `BGM_URLS`, `SFX_URLS`, `AUDIO_TUNING` in `src/contents/constants.ts` |
| Tunables (gravity / speeds / HP / cooldowns) | `GAME_CONFIG`, `PLAYER_TUNING`, `SCROLL_TUNING`, `CAMERA_TUNING`, `POOL_SIZES`, `PARALLAX_FACTORS` in `src/contents/constants.ts` |
| ID vocabularies (phase / action / skill / capability / biome / pickup) | `PHASE_IDS`, `ACTION_IDS`, `SKILL_IDS`, `CAPABILITY_IDS`, `BIOME_IDS`, `PICKUP_IDS` in `src/contents/constants.ts` |
| Level / segment / world-strip data shapes | `src/contents/types.ts` (`LevelDef`, `SegmentDef`, `WorldStripLoopDef`, `BuiltWorldStripLevel`, …) |
| Levels / skills / dialogues / bosses (data) | `src/contents/data/{levels,skills,dialogues,bosses}/*.ts` |
| Entity classes (Player, Boss, NPC, BulletPool, enemy pools) | `src/contents/entities/**` |
| Phaser `scene.data` bridge keys | grep `scene.data.set(` / `scene.data.get(` (currently: `cameraDirector`, `playerBulletsGroup`, `bossPhaseLevelId`) |
| State stores (Pinia) | `src/stores/` (currently empty — Pinia + persisted-state mounted in `main.ts` but no stores defined; cross-level state passed via `IGameplaySceneData.unlockedSkills` to `scene.restart`) |

**Conflict rule.** Before adding a new scene / event / asset / route / store key, grep the relevant constant object to ensure it doesn't already exist. Don't maintain a parallel registry here — the `as const` object is canonical, and historical change-log entries that reference removed §13.x sections still make sense as "this commit changed those areas."

---

## 13.9 Work in progress (WIP)

*Claim an area before starting a multi-turn feature. Clear your row when done. Strikethrough = completed.*

| Owner | Area / files | Started | Notes |
|---|---|---|---|
| *(none)* | — | — | — |
| ~~agent:kilo/2026-04-26~~ | ~~Phase A: runner skeleton~~ | ~~2026-04-26;12:27~~ | **DONE 2026-04-26;12:40** — vertical slice playable |
| ~~agent:kilo/2026-04-26~~ | ~~Phase A2: auto-scroll + parallax + flight architecture~~ | ~~2026-04-26;12:55~~ | **DONE 2026-04-26;13:10** — see §14 |
| ~~agent:kilo/2026-04-26~~ | ~~Demo: dialogue + NPC + boss + level-02~~ | ~~2026-04-26;13:30~~ | **DONE 2026-04-26;14:00** — see §14 |
| ~~agent:kilo/2026-04-26~~ | ~~Infinite-loop runner + world-paced drift + freezesWorld~~ | ~~2026-04-26;14:30~~ | **DONE 2026-04-26;15:30** — see §14 |
| ~~agent:kilo/2026-04-26~~ | ~~World-strip loop + invisible platforms + BGM wiring~~ | ~~2026-04-26;16:30~~ | **DONE 2026-04-26;17:36** — see §14 |

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
| 2026-04-26;15:30 | **水平无限循环 = `LevelRunner` chunk 滑动窗口**（`loop: true` + `platformTemplates` / `hazardTemplates` / `checkpointTemplates` + `tickSpawner`） | 让一个 3600px 的关卡能永远跑下去，不用写 36000px 的 segment 数据；pickup / NPC / boss-trigger / level-exit 仍然只出现一次（它们本来就是单次触发语义）。Checkpoint 在每个 chunk 获得 `${id}@${k}` 的唯一 id 永久保留进 `spawnById`，respawn 不受 chunk 回收影响。`LOOP_WORLD_MAX_X = 1e9` 做相机/物理世界的"事实上的无限"边界 |
| 2026-04-26;15:30 | **`Phase.freezesWorld` 声明式 flag** 替换散落在 GameplayScene 里的 `phase-id === DIALOGUE \|\| phase-id === RESPAWN` 检查 | 新 phase（CutscenePhase / LevelEndPhase）加一行 `readonly freezesWorld = true` 就自动停世界；不用回头改 GameplayScene。输入 + PhaseController 始终运行（对话要按键翻页、respawn 要倒计时），其它系统按 flag 跳过 |
| 2026-04-26;15:30 | **NPC 对话入 zone 自动触发**（`seenNpcs: Set<string>` 去重），同时保留显式 `INTERACT` 入口 | Auto-scroll 关卡里玩家停不下来，按 E 的窗口短到不可靠；入 zone 即开讲才能保证剧情打得中。同一 NPC 一次 scene 只触发一次，避免 respawn 反复进对话。follow/locked 关卡仍可用 E 作为显式入口 |
| 2026-04-26;15:30 | **`Player.getCruiseSpeed()` 作为"世界节奏"的单一来源**；MoveCapability 按 `BASE_FORWARD_RATIO` 缩放、FlyCapability 按 `FLY_IDLE_RATIO` 缩放 | Auto-scroll 关卡下"无输入时默认漂移的方向/速度"是 capability 共识。走单一 getter（惰性解析 `scene.data.cameraDirector`）避免每个 capability 各自存 director 引用，也避免 Player 直 import CameraDirector（会构成循环） |
| 2026-04-26;15:30 | **AGENTS.md / CODEBASE_STATE.md 拆分** —— 规则（§1–§12）留在 AGENTS.md，活体注册表（§13 + §14）迁出到 `CODEBASE_STATE.md` | AGENTS.md 里塞 680+ 行让真正的规则被埋；每次同步注册表都要碰整份文件；分离后：规则静态、注册表活跃，两者可独立演进。保留 §13.x / §14 编号，避免历史变更日志引用失效 |
| 2026-04-26;17:36 | **World-strip 模型**：变宽定高图片串 + 每图 `overlapNext` + 每图 `sections` 地面轮廓；`buildWorldStripLevel` 编译到 `loop:true` + invisible platform segments | 美术要求"整张背景画出来的关卡"（包含地面起伏和艺术光影），Tilemap / TileSprite 都要重新出图才能匹配每张图的局部地面形状。改为"每图自己声明地面段"后：美术给图 + 写几个数字即可上线；`WorldStripSystem` 只管铺图、`LevelRunner` 继续管物理 + checkpoint/pickup/boss；两套系统平行运行，复杂度没有重叠 |
| 2026-04-26;17:36 | **`PlatformSegmentDef.invisible?: boolean`** 抑制默认 biome TileSprite 视觉 | world-strip 关卡的地面已经画在底图里；若仍跑 TileSprite 会画出一排重复瓦片盖在美术之上。判断点放在 `LevelRunner.createPlatformSegment` 里 —— 其它系统完全无感，loop 模板复制、碰撞、checkpoint 依然走老路 |
| 2026-04-26;17:36 | **`WorldStripSystem` 独立于 `LevelRunner`，不并入后者** | LevelRunner 的核心职责是"把 LevelDef 里的 segment 物化成物理 group"，加图片渲染会让它兼管视觉。抽一个独立系统后：① 普通关卡完全不付代价（GameplayScene 判空）；② 底图 depth / scrollFactor / displaySize 逻辑集中一处；③ 未来换成 tilemap / spine / video 底图只改这一个系统 |
| 2026-04-26;17:36 | **World-strip image `depth = -10000 + k*N + imageIdx`，且后图盖前图** | 让"后一张图遮住前一张的 `overlapNext` 像素"这个关键视觉规则成为单调 depth 的直接后果，不需要每帧调 z-order。同时把整组 strip 图压到 -10000 以下保证永远在 platforms / player / parallax 之下 |
| 2026-04-26;17:36 | **菜单 BGM 走 Vue / HTMLAudio，游戏 BGM 走 Phaser sound** | 菜单没 Phaser 实例（没必要 boot 整个 Game 只为播 mp3）；游戏 BGM 要和 scene.pause / shutdown 严格同步 —— Phaser 的 sound manager 自带这个耦合，Vue 侧写生命周期会很脆。分两条路径后各自都是本域里最简单的写法；代价仅是 "autoplay unlock" 的 15 行 fallback（首次访问 `/` 时用户不互动就不能响） |
| 2026-04-26;17:36 | **BGM key 表 `LEVEL_BGM: Record<levelId, audioKey>`** 而不是 `LevelDef.bgm?: string` | 关卡数据目前不依赖运行时 audio key；把 audio 绑定放在 scene 层表里让关卡数据 pure-data（可以单测、可以 JSON 化），并支持"多个关卡共用一首曲子"（现在 level-01 + world-strip-demo 都用 `BGM_LEVEL_01`）。如果未来每关都有独立 BGM 再升级到 LevelDef.bgm |
| 2026-04-26;17:36 | **相机 X 初始化统一用 `cam.width / 2`，删掉 `- 200` 旧偏移**；RespawnPhase 同步 | 800×600 视口下 200 偏移让玩家落在 1/4 屏处，spawn.x 较小时还会被 bounds 夹到屏幕最左。改成居中后：首次进关卡和复活后玩家感觉一致，auto-scroll 的 `BASE_FORWARD_RATIO=0.8` 会把玩家缓慢推向左缘，留出最大反应余量 |
| 2026-04-26;17:36 | **`LevelDef.height > cam.height` 时相机 Y 锁底**（`cam.setScroll(_, level.height - cam.height)`） | world-strip demo 的图片高度 672 超过视口 600；不锁底就看到的是"画面上半部分天空"，看不到脚下地面。世界 ≤ 相机高度时等于 0，行为和过去一致 |
| 2026-04-26;23:00 | **线性 world-strip 关卡（`loop=false`）作为"跑到终点 → boss 场景"通用模式** | world-strip-demo 从循环改成线性 7 图 + 末端 `level-exit (to-boss)`。非 loop 下 `WorldStripSystem.tickSpawner` 只保留 chunk 0、LevelRunner 的周期模板也不复制，相机被 `camera.bounds=chunkWidth` clamp 在世界右端；玩家被 auto-scroll 推到屏幕最右沿，`findLevelExitAt(player.x, player.y, 40)` 命中 level-exit → `completeLevel` 进入 boss 场景。这样"一条有明确终点的关卡"不用新增任何场景机制，复用现有 LevelRunner + level-exit + BossPhase 即可串起来 |
| 2026-04-26;23:00 | **`WorldStripLoopDef.loop?: boolean` + `BuiltWorldStripLevel.loop`（与 `LevelDef.loop` 同步）** | 非循环语义同时出现在**世界图铺图**（`WorldStripSystem`）和**物理段复制**（`LevelRunner`）两处；两边必须一致。让 builder 一次决定并写进 `BuiltWorldStripLevel.loop`，`WorldStripSystem` 直接读这一字段分派 —— 不用反向查 `built.level.loop`，也杜绝"图继续循环但平台停下"之类的不一致 |
| 2026-04-26;23:00 | **`SPAWN_PAD_X` 从 world-strip-demo.ts 的模块顶层移到 `buildWorldStripLevel` 函数体内** | world-strip-boss.ts 顶层 `import { buildWorldStripLevel } from './world-strip-demo'` 并**立即调用**（`export const WORLD_STRIP_BOSS_BUILD = buildWorldStripLevel(WORLD_STRIP_BOSS)`），造成循环依赖：demo.ts 从顶部 import boss.ts 的瞬间，boss.ts 就开始跑 —— 此时 demo.ts 的模块级 const 都还在 TDZ，`SPAWN_PAD_X` 读不到。函数局部变量每次调用各自初始化，彻底绕开模块初始化顺序。规则：**`buildWorldStripLevel` 函数体只能读函数参数或闭包内 const，不能读模块级 const** |
| 2026-04-26;23:00 | **`GameplayScene.onBossPhaseCleared`：结算（BOSS_VICTORY 面板）与转场（completeLevel）解耦** | 以前 "loop 关卡 + 无 nextLevelId" 直接跳过结算继续跑圈。现在把两者拆开：结算（锁相机 + 暂停物理 + BOSS_VICTORY 覆盖层）恒定发生；只有存在 `nextLevelId` 时才 `delayedCall(2500, completeLevel)`。world-strip-boss 这类"终极 boss 无下一关"场景因此能正常展示 BossVictoryOverlay 作为游戏终章（覆盖层常驻，直到玩家回主菜单） |
| 2026-04-26;23:00 | **`BossPhase.exit` 在"boss 尚活"时复位 `firedBossTriggers`** | BossPhase 被非正常中断 = 几乎都是玩家在 boss 战中死亡 → RESPAWN → BossPhase.exit。如果 `firedBossTriggers` 不清，玩家 respawn 后再次走过 trigger 不会触发 boss，而 BossEntity 已经被 exit 销毁了 → trigger 残留 + boss 消失的 bug。只在 `boss?.isAlive()` 时清，确保 boss 已死的正常路径不会在 loop 关卡里让 boss 反复刷新。新增 `LevelRunner.clearFiredBossTriggers()` 作为最小暴露面 |
| 2026-04-26;23:00 | **玩家真素材 + `player-run` 动画；`BootScene.registerPlayerAnimations` 在 Phaser 全局 AnimationManager 里注册一次** | Phaser `AnimationManager` 挂在 game 级而不是 scene 级，BootScene 注册完后 `scene.restart` 也不需要重注册（用 `anims.exists('player-run')` 幂等）。`Player.updateVisuals()` 负责空中 / 地面切换：`anims.play('player-run', true)`（ignoreIfPlaying）避免"双脚打颤"；airborne 停动画并 `setTexture('player-jump')` 省去再做一个 1 帧 anim。朝向翻转仍由 Move/Fly Capability 写 `setFlipX`，视觉态切换不干涉朝向 |
| 2026-04-26;23:00 | **玩家 `setScale(0.2)` + tex-px hitbox (100×270)** 调一个数字就能改玩家视觉大小 | 真素材 500×500 原生像素直接 setSize 不可控：改 scale 连带 hitbox 自动缩放，而 setSize/setOffset 又是纹理坐标而不是屏幕像素。用 `SPRITE_SCALE=0.2` 一个常量控制显示大小，hitbox 在纹理坐标系里用 `(500-W)/2` 居中；改大小只动 SCALE，hitbox 自动跟随，`setOffset` 的推导式不用改 |
| 2026-04-27;16:40 | **SFX 走 `playSfx(scene, key, volume)` 工具函数（`src/contents/systems/sfx.ts`），不开类 / 不开单例** | 短音效是 fire-and-forget；`scene.sound.add` 适合 BGM（要保留引用做 pause/resume），SFX 用 `scene.sound.play(key, opts)` 让 Phaser SoundManager 内部池化 + 重叠播放。`playSfx` 只多做一件事 —— `scene.cache.audio.exists(key)` 护栏：mp3 文件没补上时 Phaser loader 已经 warn 过 404，再播会刷错；缺资源就静默 no-op，作者补 mp3 时无感切换。所有调用点统一为"拿 scene ref + 调函数"一种姿势，SoundManager 不再需要 register/destroy |
| 2026-04-27;16:40 | **`physics.world?.pause()` / `?.resume()`** —— RunningPhase / RespawnPhase / DialoguePhase / `onBossPhaseCleared` / `completeLevel` 全部加可选链 | Phaser 4 `ArcadePhysics.shutdown()` 会把 `physics.world` 置 null。玩家在 boss 死亡 2s 缓冲内发 restart / 离开页面，scene 已进 shutdown 中间态时还会有 phase transition / cleared 回调跑进来；不加 `?.` 就崩在 "Cannot read 'pause' of null"。这是 jam 阶段必备的 shutdown 防御，全项目统一姿势 |
| 2026-04-27;16:40 | **`Player.die` 关 `body.enable=false`，`Player.respawn` 重新打开** | `damage()` 的 `if (!_alive)` 只能吞数值，挡不住"死后这一帧 Matrix 弹幕仍 overlap 玩家"导致 PhaseController 又转一次 RESPAWN —— 第二次 transition 在 shutdown 中间态会崩。从源头关 body 直接让 collide/overlap 跳过玩家；respawn 配套打开，少一个就"复活后穿透一切" |
| 2026-04-27;16:40 | **`handlePlayerDied` 双闸：`scene.isActive()` + `physics?.world`** | 即便 die 已发出，scene 可能正处于 shutdown / sleep / 未完成 create 的中间态。两道闸独立兜底：① 状态机判 RUNNING；② 真实 world 引用还在。任何一个不满足就早退，反正死 → restart 自己会重建 phase + player |
| 2026-04-27;16:40 | **Boss 关卡专属：强制 equip flight + 切到 `player-floating-platform` sprite** | world-strip-boss 是空中战；不依赖前关有没有捡飞行 orb 直接给玩家飞行能力，视觉换成"踏在浮空平台上"的姿势让玩家一眼读懂"现在该飞了"。执行点放在 `cameraDirector` 之后、`unlockedSkills` 回放之后，避免被后续 equip 路径二次 attach |

---

## 14. Change log

One line per change that touches code structure, public surfaces, or non-obvious tunings. Newest at the top. Keep it short.

- **2026-04-27;16:40** — **Sound effects + audio resilience.** New `src/contents/systems/sfx.ts` exporting `playSfx(scene, key, volume)` with `cache.audio.exists` guard. `constants.ts` gains `ASSET_KEYS.AUDIO.SFX_*` (damage / shoot / checkpoint / player-die / boss-defeated / boss-phase-transition / enemy-hit / jump), `SFX_URLS` map (`public/sfx/*.mp3`), `ASSET_KEYS.AUDIO.BGM_BOSS` + `BGM_URLS.BOSS = '/bgms/ok6.mp3'`, and `AUDIO_TUNING.SFX_*_VOLUME` (+ `SFX_BOSS_PHASE_TRANSITION_VOLUME`). `BootScene.preload` registers all SFX URLs; `BootScene.generateCoreTextures` recolors `bullet` to a 3-tone teal-green (light-bullet aesthetic). `playSfx` calls wired in: `JumpCapability` (ground + coyote + air double-jump), `ShootCapability` (each fire), `Player.die` (player-die SFX), `GameplayScene.handlePlayerDamagedSfx` (new `PLAYER_DAMAGED` listener), checkpoint overlap (only on `res.changed`), player-bullet vs flying-enemy overlap (enemy-hit), `BossPhase.onBulletHitBoss` (enemy-hit, shared key), `onBossPhaseCleared` (boss-defeated, deferred until `BOSS_ENDING_ENDED`). **Shutdown safety:** `physics.world?.pause()` / `?.resume()` everywhere — `RunningPhase.enter`, `RespawnPhase.enter`, `DialoguePhase.enter`, `GameplayScene.onBossPhaseCleared`, `GameplayScene.completeLevel`. **Death safety:** `Player.die` sets `body.enable = false`, `Player.respawn` re-enables; `GameplayScene.handlePlayerDied` adds `scene.isActive()` + `physics?.world` double-guard. **Boss-scene flight:** `GameplayScene.create` for `LEVEL_WORLD_STRIP_BOSS` force-unlocks + equips `FLIGHT` and calls `Player.useStaticSprite('player-floating-platform')`. Tunings: `PLAYER_TUNING.MAX_HP 10 → 3`, `INVULN_MS 1000 → 500`, `BULLET_SPEED 700 → 800` (vibe pass for boss-scene difficulty). `world-strip-demo.ts` retuned ~70 lines (image widths / overlaps / spawn). §13.10 +5 decisions. §13.1 / §13.2 (source-of-truth pointers) updated.
- **2026-04-26;21:35** — `PLAYER_TUNING.MAX_HP` reverted 5 → 10 (commit `cbb3acb`); the prior 10 → 5 vibe tweak (commit `278cfd5`, 2026-04-26;20:24) was rolled back. Net effect over the gap: no change (later superseded by 6722206 setting MAX_HP=3).
- **2026-04-26;23:00** — **Linear world-strip → boss scene + real player sprite & animations.** New `src/contents/data/levels/world-strip-boss.ts` — single-image `WorldStripLoopDef` over `public/pics/boss.png` + `loop: false` + boss-trigger (`boss-shadow`, no nextLevelId); exports `WORLD_STRIP_BOSS_DEF` / `WORLD_STRIP_BOSS_BUILD` / `LEVEL_WORLD_STRIP_BOSS`. `world-strip-demo` reshaped to **linear 7-image strip** (`1/2/3.png` ×2 + `4.jpg` final, `loop: false`) terminating in `level-exit (to-boss)` @ chunk x=8950; `SPAWN_PAD_X` moved inside `buildWorldStripLevel` to dodge TDZ from the boss module's eager top-level call; `WORLD_STRIP_LEVELS` now indexes both demo + boss builds. `WorldStripLoopDef.loop?: boolean` (default true) + `BuiltWorldStripLevel.loop` added to `types.ts`; `buildWorldStripLevel` respects `strip.loop`; `WorldStripSystem.tickSpawner` keeps only chunk 0 when `built.loop === false`. `LevelRunner.clearFiredBossTriggers()` new helper — called by `BossPhase.exit` when boss is still alive (phase interrupted = player death) so respawn can re-trigger. `GameplayScene.onBossPhaseCleared` refactored: settlement (`BOSS_VICTORY` + lock camera + pause physics) decoupled from transition — `completeLevel` only runs when `nextLevelId` exists, terminal bosses keep the victory overlay indefinitely. `LEVEL_REGISTRY` + `LEVEL_BGM` gain `LEVEL_WORLD_STRIP_BOSS` entry (shares `BGM_LEVEL_01`). `GameplayScene.update` now calls `levelRunner.tickSpawner` + `worldStrip?.tickSpawner` unconditionally (both self-gate on loop). Player entity swapped from generated blue rectangle to real sprite: `public/sprites/player/{1..5,jump}.png` loaded by `BootScene.preload`, `ALL_WORLD_STRIP_DEFS = [demo, boss]` iterated with set-dedupe for image preloads, `registerPlayerAnimations()` binds global `'player-run'` animation (frameRate 8, repeat -1); `Player.constructor` defaults to `'player-run-1'` + `setScale(0.2)` + 100×270 tex-px hitbox; new `Player.updateVisuals()` toggles `anims.play('player-run')` (grounded) vs `setTexture('player-jump')` (airborne / flying). New static assets: `public/pics/boss.png`, `public/sprites/player/*.png`. §13.10 +7 decisions.
- **2026-04-26;17:36** — **World-strip demo + BGM wiring.** New `src/contents/systems/world-strip-system.ts` (chunk-based image spawner, depth `-10000 + k*N + imageIdx`). New `src/contents/data/levels/world-strip-demo.ts` — `WorldStripLoopDef` over `public/pics/*` + `buildWorldStripLevel` builder emitting `loop:true` + `PlatformSegmentDef{invisible:true}` + per-image checkpoints + default spawn; exports `LEVEL_WORLD_STRIP_DEMO` + `WORLD_STRIP_LEVELS`. `PlatformSegmentDef` gains `invisible?: boolean` (LevelRunner skips the TileSprite). `types.ts` gains `WorldStripGroundSection` / `WorldStripImageDef` / `WorldStripLoopDef` / `WorldStripPlacement` / `BuiltWorldStripLevel`. `constants.ts` gains `ASSET_KEYS.AUDIO` / `BGM_URLS` / `AUDIO_TUNING`. `BootScene.preload` loads `BGM_LEVEL_01` + strip image URLs; `create` adds `generateWorldStripTextures` + helper `drawBigDigit` (7-seg) as placeholder when URLs missing. `GameplayScene` registers world-strip in `LEVEL_REGISTRY`, sets `DEFAULT_LEVEL = LEVEL_WORLD_STRIP_DEMO`, instantiates `WorldStripSystem` when `WORLD_STRIP_LEVELS[level.id]` exists, calls `worldStrip.tickSpawner` each frame, starts/pauses/resumes/stops BGM via `LEVEL_BGM` map, clamps camera Y to bottom when world > viewport, replaces camera init `- 200` with `- cam.width / 2`. `RespawnPhase` uses same `cam.width / 2` centering. `home-page.vue` plays `BGM_URLS.MENU` on mount with pointerdown/keydown autoplay-unlock fallback. New static assets: `public/bgms/*.mp3`, `public/pics/*.{png,jpg}`. §13.10 +8 decisions.
- **2026-04-26;15:30** — **Doc split:** §13 (Codebase State) + §14 (Change log) extracted from `AGENTS.md` into this file (`CODEBASE_STATE.md`) at repo root; `AGENTS.md` §13/§14 replaced with a pointer. Same turn, catch up registry with commit `f6afae5`: `LevelDef` gains `loop?` + `chunkWidth?`; `LevelRunner` grows chunk-spawner (`platformTemplates` / `hazardTemplates` / `checkpointTemplates` / `chunkObjects` / `tickSpawner` / `isLooping` / exported `LOOP_WORLD_MAX_X`), checkpoint ids rewritten to `${id}@${k}` in loop mode. `Phase.freezesWorld?: boolean` added (RespawnPhase + DialoguePhase set it true); `PhaseController.getCurrent()` exposed. `Player.getCruiseSpeed()` reads `scene.data.cameraDirector`; `MoveCapability` drifts at `cruise × BASE_FORWARD_RATIO` when idle; `FlyCapability` cruises at `cruise × FLY_IDLE_RATIO` instead of damping to 0. NPC dialogue auto-triggers on zone overlap (`seenNpcs` Set; explicit E still works for follow/locked). `level-01` → `loop: true`, drops `level-exit`, adds `boss-trigger` at x=2950, checkpoints thinned to `start` + `pre-boss`; `level-02.scroll.speed 110 → 240`. `SCROLL_TUNING.DEFAULT_SPEED 90 → 200`; `PLAYER_TUNING` adds `BASE_FORWARD_RATIO=0.8` + `FLY_IDLE_RATIO=1.0`. §13.10 +4 decisions.
- **2026-04-26;14:00** — Comprehensive demo on top of Phase A2. New entities `NpcEntity` + `BossEntity` (dir `entities/npc/` + `entities/boss/`); new `DialogueRunner` system + Vue `components/dialogue-overlay.vue`; `phase-controller.ts` split — `systems/phases/dialogue-phase.ts` + `systems/phases/boss-phase.ts`. `BulletPool` generalized (textureKey + maxSize + lifetimeMs params) so enemy bullets reuse it. New level `data/levels/level-02.ts` (space biome, Boss "边界清理程序" at end, loops back to level-01). `level-01.ts` gains Sage NPC + `nextLevelId: 'level-02'`. Dialogue registry `data/dialogues/{npc-sage,npc-warrior,index}.ts`; boss registry `data/bosses/{boss-shadow,index}.ts`. All previously-reserved `DIALOGUE_*` / `BOSS_*` / `LEVEL_COMPLETED` / `PICKUP_COLLECTED` events now live; `components/game-hud.vue` renders boss HP bar. §13.10 +4 decisions.
- **2026-04-26;13:10** — Phase A2 architecture refactor: auto-scroll + 3-layer parallax + screen-bound clamp + double-jump + flight capability/skill. New systems `ParallaxSystem` / `ScreenBoundsSystem`; `CameraDirector` gained `auto-right` mode; `JumpCapability` gained `MAX_AIR_JUMPS`; `Player.isFlying` flag; `FlyCapability` manages gravity + 4-dir input. `LevelDef` extended with `biome` / `scroll` / `background` / `foreground`; new segment types `pickup` / `npc` / `boss-trigger` / `level-exit` (runtime for NPC/boss arrives in demo commit). New EVENT_KEYS: `LEVEL_COMPLETED`, `PICKUP_COLLECTED`, `DIALOGUE_{START,NODE,CHOICE_SELECTED,ADVANCE,END}`, `BOSS_{SPAWNED,HP_CHANGED,DEFEATED}`. New ACTION_IDS: `MOVE_UP`, `MOVE_DOWN`, `ADVANCE`, `CHOICE_1`, `CHOICE_2`. New SKILL `flight`; new CAPABILITY `fly`; new BIOME_IDS / PICKUP_IDS. Many new asset keys (biome tiles, parallax layers, NPC/pickup/boss/enemy-bullet variants). 7 new §13.10 decisions.
- **2026-04-26;12:40** — Phase A runner skeleton shipped. `SCENE_KEYS.GAME` → `SCENE_KEYS.GAMEPLAY`; `game-scene.ts` deleted, replaced by `gameplay-scene.ts`. New subtrees: `contents/{entities,systems,data}/**`. New `EVENT_KEYS`: PLAYER_{HP_CHANGED,DAMAGED,DIED,RESPAWNED}, CHECKPOINT_REACHED, PHASE_CHANGED, SKILL_{UNLOCKED,EQUIPPED,REVOKED}; dropped SCORE_UPDATE. New asset keys: bullet / hazard / checkpoint; dropped star. New HUD: `components/game-hud.vue`. `constants.ts` split into GAME_CONFIG / PLAYER_TUNING / CAMERA_TUNING / POOL_SIZES / PHASE_IDS / ACTION_IDS / SKILL_IDS / CAPABILITY_IDS. 7 new §13.10 decisions documented.
- **2026-04-26;01:35** — 修正 `contents/` 分层描述（"UI 无关 + 与 Phaser 耦合"，不是"引擎无关"）；确认 scenes 留在 `contents/scenes/` 不外拎；新增"runtime → contents 必须走深路径"规则到 §11；同步 §13.10 决策日志（三条新决策）。
- **2026-04-26;01:20** — 分层重构：`core` → `engine`；新增 `contents` 作为游戏内容层（场景/常量/类型的唯一源）；`composables/runtime` → `runtime`（提升到顶级）；`game-demo` 只保留 Vue 挂载示范。同步 §11 / §13.10；engine 不再依赖 `GAME_CONFIG`，改用内部 `SHELL_DEFAULTS`。
- **2026-04-25;00:01** — Initial AGENTS.md rewrite: removed Nuxt / PrimeVue / portal sections irrelevant to this project; added §13 Codebase State registries (routes, scenes, entities, events, assets, types, stores, WIP, decisions) and §0 multi-agent protocol.
