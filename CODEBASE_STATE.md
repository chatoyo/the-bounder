# Codebase State

Living registry for `momakoding-jam-starter-web` — a Vue 3 + Phaser 4 + TypeScript Game Jam starter. Every row below points to a real file/symbol in `src/`.

> **Workflow.** Read this file freely while coding; it is the authoritative *reading* source for scene / event / asset / route / store namespaces. **Do NOT edit it during feature work** — doc syncs are a user-initiated pre-commit step. See `AGENTS.md` §0 for the full collaboration protocol (edit policy, conflict avoidance, decision-log rules).
>
> Section numbering (`§13.x`, `§14`) is intentional: these sections originated inside `AGENTS.md` and change-log rows reference them historically. Renumbering would rewrite that history.

**Current scaffold status:** *Linear world-strip demo → dedicated boss scene + real player sprite & animations. Default scene is `LEVEL_WORLD_STRIP_DEMO`, now a **non-looping** 7-image strip (`1.png, 2.png, 3.png` × 2 + `4.jpg` final) whose right end contains a `level-exit (to-boss)` → `scene.restart` into `LEVEL_WORLD_STRIP_BOSS` (single-image arena built from `public/pics/boss.png`, final-boss fight). `WorldStripLoopDef.loop?: boolean` (default true) + `BuiltWorldStripLevel.loop` let `WorldStripSystem` + `buildWorldStripLevel` run both loop and linear strips; linear mode keeps only chunk 0 and lets the camera clamp at the world's right edge. `GameplayScene.onBossPhaseCleared` is decoupled from level-completion: settlement (lock camera + pause physics + `BossVictoryOverlay`) always happens on boss defeat; `completeLevel(nextLevelId)` only runs when there's a next level — terminal boss levels stay on the victory panel. `BossPhase.exit` clears `firedBossTriggers` if the boss was still alive (= phase interrupted by player death), so respawned players can re-trigger the boss. Player entity switched from generated blue rectangle to real sprite: `public/sprites/player/{1..5,jump}.png` loaded by `BootScene`, `player-run` animation registered (frameRate 8, repeat -1); `Player` now toggles between `anims.play('player-run')` on ground and `setTexture('player-jump')` in the air / while flying. Player sprite drawn at `setScale(0.2)` (500→100 display px) with a tightened 100×270 tex-px hitbox. Gameplay BGM wiring unchanged (both world-strip levels share `BGM_LEVEL_01`). Infinite-loop auto-scroll runner (level-01 / level-02) still ships unchanged.*
**Scaffold last updated:** 2026-04-26;23:00

---

## 13.1 Directory map

*Last updated: 2026-04-26;23:00*

```
momakoding-gamejam-starter-web/
├── .clinerules/               # Original Chinese project rules (source of AGENTS.md)
├── docs/
│   ├── game-demo.md           # Demo walkthrough
│   ├── phaser-study.md        # Phaser + Vue integration study (中文, 193 lines)
│   └── spec-framework.md      # UI framework spec
├── how-to-iterate.md          # Phase A iteration recipes (kept for reference)
├── public/                    # Static assets served as-is
│   ├── bgms/                  # BGM audio (menu.mp3 / 1-rust-city.mp3 / 余下备选)
│   ├── pics/                  # World-strip 底图（1.png / 2.png / 3.png / 4.jpg / boss.png）
│   └── sprites/
│       └── player/            # 真素材玩家贴图：1..5.png 跑步帧 + jump.png 跳跃静态帧
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
│   │   │                      #   SCROLL_TUNING (DEFAULT_SPEED=200) /
│   │   │                      #   PARALLAX_FACTORS /
│   │   │                      #   PLAYER_TUNING (含 BASE_FORWARD_RATIO /
│   │   │                      #     FLY_IDLE_RATIO / MAX_AIR_JUMPS) /
│   │   │                      #   CAMERA_TUNING / POOL_SIZES /
│   │   │                      #   PHASE_IDS / ACTION_IDS / SKILL_IDS /
│   │   │                      #   CAPABILITY_IDS / BIOME_IDS / PICKUP_IDS /
│   │   │                      #   ASSET_KEYS.AUDIO / BGM_URLS / AUDIO_TUNING
│   │   ├── types.ts           # ID 联合、LevelDef（含 loop / chunkWidth / scroll /
│   │   │                      #   background / foreground）、ParallaxLayerDef、
│   │   │                      #   DialogueDef、BossDef、WorldStrip* 系列、事件 payload;
│   │   │                      #   PlatformSegmentDef 含可选 invisible?
│   │   ├── scenes/
│   │   │   ├── boot-scene.ts  # 生成占位纹理（bullet / biome tiles / parallax /
│   │   │   │                  # npc-* / pickup-* / boss-* / enemy-bullet /
│   │   │   │                  # world-strip-* 占位图）；load.audio(BGM_LEVEL_01) +
│   │   │   │                  # 迭代 ALL_WORLD_STRIP_DEFS(demo + boss) 走 load.image
│   │   │   │                  # (set 去重) + load.image 玩家真素材
│   │   │   │                  # (player-run-1..5 / player-jump) + registerPlayerAnimations
│   │   │   │                  # ('player-run' frameRate=8 repeat=-1) → 切到 GameplayScene
│   │   │   └── gameplay-scene.ts  # 主场景：粘合 LevelRunner / Player / BulletPool /
│   │   │                          # InputSystem / SkillManager / CameraDirector /
│   │   │                          # ParallaxSystem / ScreenBoundsSystem /
│   │   │                          # WorldStripSystem(可选) / PhaseController;
│   │   │                          # 每帧无条件调 LevelRunner.tickSpawner +
│   │   │                          # WorldStripSystem.tickSpawner(两者自己判 loop);
│   │   │                          # 按 phase.freezesWorld 决定是否推进世界；
│   │   │                          # 按 LEVEL_BGM 表挂 BGM; onBossPhaseCleared 把
│   │   │                          # 结算(BOSS_VICTORY) 与转场(completeLevel) 解耦
│   │   │                          # —— 无 nextLevelId 时结算面板常驻
│   │   ├── entities/
│   │   │   ├── player/
│   │   │   │   ├── player.ts           # 组合式玩家：wrapper + HP + isFlying +
│   │   │   │   │                        # getCruiseSpeed() (读 scene.data.cameraDirector) +
│   │   │   │   │                        # capability registry; 默认 tex 'player-run-1' +
│   │   │   │   │                        # setScale(0.2) + 100×270 tex-px hitbox;
│   │   │   │   │                        # updateVisuals()：地面播 anims 'player-run'、
│   │   │   │   │                        # 空中/飞行 setTexture('player-jump')
│   │   │   │   └── capabilities/
│   │   │   │       ├── capability.ts       # Capability 接口
│   │   │   │       ├── move-capability.ts  # 左右移动；无输入时按
│   │   │   │       │                        # cruise × BASE_FORWARD_RATIO 向前漂；
│   │   │   │       │                        # isFlying 时 no-op
│   │   │   │       ├── jump-capability.ts  # 跳跃 + coyote + jump-buffer +
│   │   │   │       │                        # 空中跳次数 (MAX_AIR_JUMPS=1 → 二段跳)
│   │   │   │       ├── shoot-capability.ts # 射击；持有 BulletPool 引用
│   │   │   │       └── fly-capability.ts   # 4 方向飞行；无输入时 vx 收敛到
│   │   │   │                                # cruise × FLY_IDLE_RATIO；detach 还原重力
│   │   │   ├── projectile/
│   │   │   │   └── bullet-pool.ts      # 通用子弹对象池（玩家 + 敌方共用）
│   │   │   ├── npc/
│   │   │   │   └── npc-entity.ts       # 剧情 NPC：sprite + zone + "!" 气泡；暴露 dialogueId
│   │   │   └── boss/
│   │   │       └── boss-entity.ts      # Boss 占位：悬停 + 三连散射 + HP 条事件
│   │   ├── systems/
│   │   │   ├── input-system.ts         # 按键 → ActionId；mask / 边沿事件 / 连续查询
│   │   │   ├── camera-director.ts      # follow / auto-right / lock 模式 + shake / flash +
│   │   │   │                           # getAutoScrollSpeed()
│   │   │   ├── parallax-system.ts      # 多层 TileSprite + scrollFactor
│   │   │   ├── screen-bounds-system.ts # 玩家夹在相机可视窗口内；被挤死回调
│   │   │   ├── level-runner.ts         # LevelDef → StaticGroups；水平无限循环
│   │   │   │                           # (platforms / hazards / checkpoints 周期模板) +
│   │   │   │                           # tickSpawner / chunkObjects / LOOP_WORLD_MAX_X;
│   │   │   │                           # pickup / npc / boss-trigger / level-exit 单次触发;
│   │   │   │                           # PlatformSegmentDef.invisible=true 跳过 TileSprite 视觉;
│   │   │   │                           # clearFiredBossTriggers() 给 BossPhase 中断时复位 trigger
│   │   │   ├── world-strip-system.ts   # 可变宽底图 (BuiltWorldStripLevel) 的 chunk 滑窗 spawner
│   │   │   │                           # loop=true 滑窗补齐前后 chunk；loop=false 只保留 chunk 0
│   │   │   ├── skill-manager.ts        # 技能注册 / unlock / equip / suppress
│   │   │   ├── dialogue-runner.ts      # DialogueDef FSM；发 DIALOGUE_* 事件 + commandHandler
│   │   │   ├── phase-controller.ts     # FSM core (含 Phase.freezesWorld 声明) +
│   │   │   │                           # RunningPhase / RespawnPhase(freezesWorld;
│   │   │   │                           # 复活后相机横向居中=cam.width/2)
│   │   │   └── phases/
│   │   │       ├── dialogue-phase.ts   # freezesWorld=true；pause physics + input mask +
│   │   │       │                        # auto-end on DIALOGUE_END
│   │   │       └── boss-phase.ts       # lock camera + enemy bullets + colliders +
│   │   │                                # emit phase-cleared
│   │   ├── data/
│   │   │   ├── levels/
│   │   │   │   ├── level-01.ts         # 草原 biome + loop=true + sage NPC +
│   │   │   │   │                        # flight orb + 单次 boss-trigger(x=2950)；
│   │   │   │   │                        # 无 level-exit → 打完继续无限跑
│   │   │   │   ├── level-02.ts         # 太空 biome + scroll.speed=240 + warrior NPC +
│   │   │   │   │                        # boss-trigger(shadow) + exit→level-01
│   │   │   │   ├── world-strip-demo.ts # WorldStripLoopDef **loop=false** 7 张图
│   │   │   │   │                        # (1.png/2.png/3.png ×2 + 4.jpg final) +
│   │   │   │   │                        # buildWorldStripLevel → LevelDef(loop=false) +
│   │   │   │   │                        # level-exit (to-boss) @ chunk x=8950 →
│   │   │   │   │                        # world-strip-boss；SPAWN_PAD_X 作为函数局部变量
│   │   │   │   │                        # 以绕 world-strip-boss.ts 的循环 import TDZ；
│   │   │   │   │                        # LEVEL_WORLD_STRIP_DEMO + WORLD_STRIP_LEVELS 索引
│   │   │   │   │                        # (同时收录 boss build)
│   │   │   │   └── world-strip-boss.ts # 单图 boss 场景 (boss.png, 1568×672) +
│   │   │   │                            # loop=false + boss-trigger @ x=520 (bossId=boss-shadow)
│   │   │   │                            # 无 nextLevelId → BossVictoryOverlay 常驻终章；
│   │   │   │                            # LEVEL_WORLD_STRIP_BOSS / WORLD_STRIP_BOSS_DEF /
│   │   │   │                            # WORLD_STRIP_BOSS_BUILD 导出
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
├── AGENTS.md                  # Agent rules + pointer to this file
├── CODEBASE_STATE.md          # ← this file (living registry)
├── README.md
├── index.html
├── package.json
├── vite.config.ts             # @ alias → ./src ; vue + tailwind plugins
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
└── pnpm-lock.yaml
```

`composables/` 目前是空 stub；新的 `useXxx()` hook（返回 `Ref` 或依赖组件生命周期）放这里，全局单例服务放 `runtime/`。

**Import direction inside `contents/`**（从外向内，不可反向）：
`scenes/ → systems/ + entities/ + data/ → constants/types`。entities 之间不互相 import（capability 只读 Player 状态 + InputSystem，不 import 其它 capability）。systems 之间也不互相 import，除非是"注入依赖"（`CameraDirector` 注入到 `ScreenBoundsSystem` / `ParallaxSystem` 构造函数；`Player.getCruiseSpeed()` 通过 `scene.data.get('cameraDirector')` 惰性解析，不直 import）。

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

*Last updated: 2026-04-26;23:00. Source of truth: `src/contents/scenes/` and `src/contents/constants.ts` → `SCENE_KEYS`.*

| Key (string) | Class | File | Role | Init data |
|---|---|---|---|---|
| `BootScene` | `BootScene` | `src/contents/scenes/boot-scene.ts` | 生成占位纹理（core + biome tiles + parallax + npc + pickup + boss + enemy-bullet + world-strip-*）+ 进度条；`load.audio(BGM_LEVEL_01, BGM_URLS.LEVEL_01)`；迭代 `ALL_WORLD_STRIP_DEFS`（demo + boss）把所有声明了 `url` 的图片走 `load.image`（set 去重）；`load.image` 玩家真素材 `player-run-1..5` + `player-jump`（来自 `public/sprites/player/*.png`）；`create()` 里 `registerPlayerAnimations()` 注册全局 `'player-run'` 动画（frameRate 8, repeat -1）→ `game.switchToScene(GameplayScene)` | none |
| `GameplayScene` | `GameplayScene` | `src/contents/scenes/gameplay-scene.ts` | 自动滚动平台场景：auto-scroll-right + 视差 + 屏幕夹紧 + 跳 / 射 / 飞 / 受伤 / 摔死 / 重生 + 按 `LEVEL_BGM` 表播放关卡 BGM（pause/resume/shutdown 同步暂停/销毁）；world-strip 关卡额外挂 `WorldStripSystem`；内含 PhaseController (running + respawn + 可选 dialogue/boss)；每帧无条件调 `levelRunner.tickSpawner` + `worldStrip?.tickSpawner`（两者自己按 loop 标记早退）；`onBossPhaseCleared` 把结算（`BOSS_VICTORY`）与转场（`completeLevel`）解耦 —— 无 nextLevelId 时结算常驻作为终章 | `IGameplaySceneData = { startCheckpointId?, levelId?, unlockedSkills?, fromTransition? }` |
| ~~`GameScene`~~ | ~~`GameScene`~~ | ~~`src/contents/scenes/game-scene.ts`~~ | ~~星星收集 demo~~ | 2026-04-26;12:40 删除；被 `GameplayScene` 取代 |

场景装载顺序在 `src/pages/game-demo/index.vue` → `useGame().initGame(container, BootScene)` + `addScene(GameplayScene)`。`BootScene.create()` 末尾调 `game.switchToScene(GAMEPLAY)`，Phaser 会自动把 `GameplayScene.init(data)` 接上。`completeLevel(nextLevelId)` 会在关卡结束时 `scene.restart({ levelId, unlockedSkills })`，跨关保留解锁的 skill（例如飞行）。

**Default level** 现由 `GameplayScene` 内部的 `DEFAULT_LEVEL` 常量决定（当前 = `LEVEL_WORLD_STRIP_DEMO`）；`init()` 的 `levelId` 缺省就 fallback 到它。想切回 `LEVEL_01` 改这一行即可，无需改路由 / 启动参数。

**关卡链**：`world-strip-demo`（线性 7 图, loop=false）→ level-exit `to-boss` → `world-strip-boss`（单图 boss 场景, loop=false, boss-trigger 无 nextLevelId）→ BossVictoryOverlay 终章常驻。`level-01`（loop=true）/ `level-02` 是独立的 auto-scroll 循环 demo，互相链接但不进 world-strip 链。

**BGM 路由**：`LEVEL_BGM: Record<levelId, audioKey | undefined>` 把 level-id 映射到 `ASSET_KEYS.AUDIO.*`。当前 level-01 + world-strip-demo + world-strip-boss 都用 `BGM_LEVEL_01`（同一个 key Phaser 只加载一次）；level-02 暂无专属 BGM → 静音。

`PHASE_IDS` 现已声明：`RUNNING` / `RESPAWN` / `DIALOGUE` / `BOSS` / `CUTSCENE` / `LEVEL_END`。Phase A2 只接线 `RUNNING` + `RESPAWN`；其它 id 留给 demo commit。

---

## 13.4 Game entities

*Last updated: 2026-04-26;23:00. Source of truth: `src/contents/entities/**`, `src/contents/systems/level-runner.ts` (静态对象) 和 `src/contents/systems/world-strip-system.ts` (world-strip 底图).*

实体按"谁管它"分三栏。活物 entity 走 `contents/entities/`；静态世界物件由 `LevelRunner` 从 `LevelDef` 批量物化，不必各自建文件；纯标记（NPC / boss-trigger / level-exit）存到 `LevelRunner` 内部 Map，scene 按 id/x 查。

### 活物

| Entity | Type | Texture key | Defined in | Notes |
|---|---|---|---|---|
| Player | `Player` wrapper around `Phaser.Physics.Arcade.Sprite` | `player-run-1` (默认) / `player-run-1..5` (anim frames) / `player-jump` (空中静态帧) | `src/contents/entities/player/player.ts` | 组合式：HP / 无敌帧 / facing / `isFlying` / `getCruiseSpeed()` / capability registry。真素材 500×500 → `setScale(0.2)` 显示 100px；hitbox 为纹理 100×270（`setSize` + 居中 `setOffset`）。`update()` 末尾调私有 `updateVisuals()`：地面 + 非飞行 `anims.play('player-run', true)`；空中 OR `isFlying=true` 停动画并 `setTexture('player-jump')`；朝向翻转由 Move/Fly Capability 写 `setFlipX`。`getCruiseSpeed()` 通过 `scene.data.get('cameraDirector')` 惰性查 `CameraDirector.getAutoScrollSpeed()`；auto-right 返 `scroll.speed`，follow/locked 返 0。`MoveCapability` + `JumpCapability` 作为 passive 常驻；active 技能（`ShootCapability` / `FlyCapability`）经 `SkillManager` 动态挂载 |
| Player bullets | `BulletPool` 包装 `Phaser.Physics.Arcade.Group` | `bullet` | `src/contents/entities/projectile/bullet-pool.ts` | 对象池 `maxSize = POOL_SIZES.PLAYER_BULLETS`；寿命超过 `PLAYER_TUNING.BULLET_LIFETIME_MS` 或撞墙即回池。**通用化**：构造器接受 `textureKey + maxSize + lifetimeMs`，敌方子弹池也用这个类 |
| Enemy bullets | `BulletPool` 实例 | `enemy-bullet` | BossPhase 内部 | 仅在 boss phase 生命周期内存在；`maxSize = POOL_SIZES.ENEMY_BULLETS = 48`，寿命 2000ms |
| NPC | `NpcEntity` | `npc-sage` / `npc-merchant` / `npc-warrior` | `src/contents/entities/npc/npc-entity.ts` | 无物理 sprite + `Phaser.GameObjects.Zone`（static body）作交互 hitbox + 浮动 "!" 气泡；暴露 `id` / `dialogueId`。**入 zone 自动开对话**（`GameplayScene.maybeAutoStartDialogue` + `seenNpcs` Set 去重）——auto-scroll 没有"按 E"的窗口期 |
| Boss | `BossEntity` | `boss-hulk` / `boss-wisp` / `boss-serpent` | `src/contents/entities/boss/boss-entity.ts` | dynamic body（关重力 + immovable）；悬停摆动 + 三连散射攻击；`takeHit(n)` 扣 HP 并发 `BOSS_HP_CHANGED`；0 HP → `BOSS_DEFEATED` + 死亡动画 |

### Capabilities (挂在 Player 上的能力单元)

| Capability id | File | Kind | Trigger / 行为 |
|---|---|---|---|
| `move` | `entities/player/capabilities/move-capability.ts` | passive | 读 `InputSystem.isDown('move-left' / 'move-right')`；**无输入时** `vx = player.getCruiseSpeed() × min(BASE_FORWARD_RATIO, 1)` 向右漂（auto-right 下默认 0.8×，跟不上世界所以被相机缓慢推向左缘）；`player.isFlying === true` 时 no-op |
| `jump` | `entities/player/capabilities/jump-capability.ts` | passive | `onAction('jump', 'down')` + coyote + jump-buffer；空中可再按 `PLAYER_TUNING.MAX_AIR_JUMPS` 次（默认 1 = 二段跳）；`player.isFlying` 时 no-op |
| `shoot` | `entities/player/capabilities/shoot-capability.ts` | active | `onAction('shoot', 'down')`；冷却 `PLAYER_TUNING.FIRE_COOLDOWN_MS` |
| `fly` | `entities/player/capabilities/fly-capability.ts` | active | attach 时关重力 + `player.isFlying=true` + 初始 vx 设到 `cruise × FLY_IDLE_RATIO`；update 里按 4 方向输入加减速度；**水平无输入时** vx 向 `cruise × FLY_IDLE_RATIO` 收敛（默认 1.0 = 恰好跟随世界悬停），垂直无输入时 vy 向 0 收敛；clamp 到 `cruise ± FLY_SPEED_X` / `±FLY_SPEED_Y`；detach 还原重力 |

### 静态世界物件（由 `LevelRunner.load(def)` 物化）

非 loop 模式：`load(def)` 一次性在原始坐标物化全部 segment。
Loop 模式：`platforms` / `hazards` / `checkpoints` 被当作**周期模板**（由 `LevelRunner.platformTemplates` / `hazardTemplates` / `checkpointTemplates` 持有），每帧由 `GameplayScene.update` 调 `levelRunner.tickSpawner(scrollX, viewWidth)`，在相机视窗前后各留 1 chunk 的缓冲动态 spawn/despawn（`chunkObjects: Map<chunkIdx, GameObject[]>`）。`pickups` / `npcs` / `boss-triggers` / `level-exits` 始终只在原始坐标出现一次，不参与循环。

| 物件 | Phaser 类型 | Texture key | 源数据 | Notes |
|---|---|---|---|---|
| Platforms | `Phaser.Physics.Arcade.StaticGroup` + 独立 `TileSprite` 做视觉 | `tile-{biome}`（按 `LevelDef.biome`） | `PlatformSegmentDef` | Static body setDisplaySize+refreshBody；TileSprite 独立显示避免拉伸糊图；loop 模式下每个 chunk 复制一份；`PlatformSegmentDef.invisible === true` 时**跳过 TileSprite**（world-strip 关卡地面画在底图里） |
| Hazards | `Phaser.Physics.Arcade.StaticGroup` | `hazard` | `HazardSegmentDef` | 每个 sprite `setData('hazardDamage', ...)`；overlap 触发 `player.damage()`；loop 模式下每个 chunk 复制一份 |
| Checkpoints | `Phaser.Physics.Arcade.StaticGroup` | `checkpoint` | `CheckpointSegmentDef` | 每个 sprite `setData('checkpointId', id)`；初始 α=0.5，激活后 α=1；**loop 模式下 id 被改写为 `${tpl.id}@${chunkIdx}`，spawnById 永久保留**（即使 chunk 已 despawn，respawn 点仍然可用） |
| Pickups | `Phaser.Physics.Arcade.StaticGroup` | `pickup-flight` / `pickup-hp` | `PickupSegmentDef` | 带浮动 tween；overlap 后 `consumePickup()` disable body 并发 `PICKUP_COLLECTED`；**不循环**（单次触发） |

### 逻辑段（LevelRunner 内部 Map，不占物理 group）

| 段 | 存储 | 查询 API | Notes |
|---|---|---|---|
| NPC | `LevelRunner.npcs: Map<id, NpcSegmentDef>` | `getNpcDef(id)` / `forEachNpc(cb)` | 由 `NpcEntity` 在 `create()` 时物化；**不循环** |
| Boss trigger | `LevelRunner.bossTriggers: Map<id, BossTriggerSegmentDef>` | `checkBossTrigger(playerX)` | 幂等：每个 trigger 只触发一次（`firedBossTriggers` Set）；loop 模式下不循环，boss 战是一次性事件 |
| Level exit | `LevelRunner.levelExits: Map<id, LevelExitSegmentDef>` | `findLevelExitAt(x, y, radius?)` | GameplayScene 每帧查；命中后 `completeLevel(nextLevelId)`；loop 关卡不写这个就永不转场 |

### 无限循环 helpers

- `LevelRunner.isLooping(): boolean`
- `LevelRunner.getChunkWidth(): number`
- `LevelRunner.tickSpawner(scrollX, viewWidth): void` — 非 loop 下是 no-op
- `LOOP_WORLD_MAX_X = 1_000_000_000`（exported from `level-runner.ts`）— loop 模式下相机 / 物理世界的 X 上界

### World-strip 底图（由 `WorldStripSystem` 管理，与 LevelRunner 平行）

只在使用 `BuiltWorldStripLevel` 的关卡里启用。`GameplayScene.create` 判断 `WORLD_STRIP_LEVELS[level.id]` 有值时实例化 `WorldStripSystem` 并在 `update()` 里用相机的 `scrollX / width` 调 `tickSpawner`（无论关卡是否 loop 都 tick，系统内部按 `built.loop` 分派）。

| 物件 | Phaser 类型 | Texture key | 源数据 | Notes |
|---|---|---|---|---|
| World-strip image | `Phaser.GameObjects.Image` | `world-strip-1` / `world-strip-2` / …（由 `WorldStripImageDef.textureKey` 决定） | `BuiltWorldStripLevel.placements` | 每 chunk 按 placement 实例化一份；`setOrigin(0,0)` + `setScrollFactor(1,1)` + `setDisplaySize(p.width, strip.height)`（原生 ≠ 显示时自动缩放）；`depth = WORLD_STRIP_DEPTH_BASE(-10000) + k * N + imageIdx`，后图盖前图、下个 chunk 盖上个 chunk，始终位于 platform / player / parallax 之下 |

**Loop 模式分派（`WorldStripSystem.tickSpawner`）：**
- `built.loop === true`：滑动窗口，保持相机视窗前后各 1 个 chunk 的图片在场（同 LevelRunner）。
- `built.loop === false`：只保留 chunk 0 —— 相机 X 会被 `camera.bounds = chunkWidth` clamp 在世界右端，永远看不到 chunk 1，无需生成。首帧铺一次后几乎 no-op。

地面轮廓由 `buildWorldStripLevel` 编译到 `LevelDef.segments` 里的 `PlatformSegmentDef{invisible:true}`，走 `LevelRunner` 的常规 platform 通道（loop 模式下进模板 + 每 chunk 复制；非 loop 模式下只物化原始坐标一份）；也就是说 world-strip 关卡的物理碰撞仍然是 LevelRunner 的职责，`WorldStripSystem` **只**负责把图像铺上去。

### Collisions wired in `GameplayScene.create`

- `player.sprite ↔ platforms` (collider) — 包括 world-strip 的 invisible 平台
- `playerBullets.group ↔ platforms` (collider → `BulletPool.kill`)
- `player.sprite ↔ hazards` (overlap → `Player.damage(dmg, 'hazard')`)
- `player.sprite ↔ checkpoints` (overlap → `LevelRunner.handleCheckpointTouched`)
- `player.sprite ↔ pickups` (overlap → `handlePickup` → `SkillManager.equip(FLIGHT)` 等)
- `player.sprite ↔ npc.zone` (overlap → set `currentNpcInRange` + `maybeAutoStartDialogue`)

### Camera framing（新）

- 世界高度 > 相机视口（world-strip demo：level.height=672 > cam.height=600）时，`cameraY = level.height - cam.height` 把相机锁在底部，让玩家能看到脚下地面；世界 ≤ 相机高度则 cameraY=0，行为等同旧版。
- 初始相机 X 和 `RespawnPhase` 复活相机 X 都用 `spawn.x - cam.width/2`（过去是 `spawn.x - 200`），让玩家横向落在屏幕正中央。

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
| `LEVEL_COMPLETED` | `level:completed` | Phaser → Vue | `LevelCompletedPayload` | `GameplayScene.completeLevel` | — (reserved; 过关面板待做) |
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

*Last updated: 2026-04-26;23:00. Source of truth: `src/contents/scenes/boot-scene.ts` + `src/contents/constants.ts` (`ASSET_KEYS` / `BGM_URLS`).*

Most textures are still generated at runtime via `generateTexture`. Exceptions (real files in `public/`):
- `public/pics/{1..3}.png` / `4.jpg` / `boss.png` — world-strip real art; loaded via `BootScene.preload` by iterating `ALL_WORLD_STRIP_DEFS = [WORLD_STRIP_DEMO_DEF, WORLD_STRIP_BOSS_DEF]` (set-based dedupe on textureKey — demo reuses `1/2/3.png` across 6 of its 7 slots). If a `WorldStripImageDef.url` is missing, `BootScene.generateWorldStripTextures()` falls back to colored placeholders with per-image palettes + 7-segment label digits.
- `public/sprites/player/{1..5,jump}.png` — player real sprite (run frames + static jump frame); loaded unconditionally in `BootScene.preload`. The old generated blue-rectangle `player` texture is **no longer generated** — `Player.constructor` defaults to `'player-run-1'` and `BootScene.registerPlayerAnimations` binds the `'player-run'` animation used by `Player.updateVisuals()`.
- `public/bgms/*.mp3` — BGM audio (see Audio table below).

When more real art lands, add a `load.image / load.audio` call in `BootScene.preload`, keep the same key, and the generator path remains as a safety net.

### Core

| Key | Kind | Size | Generated at | Used by |
|---|---|---|---|---|
| `player-run-1..5` | texture (real sprite) | 500×500 source (displayed at `setScale(0.2)` = 100 px) | `BootScene.preload` via `load.image` from `public/sprites/player/{1..5}.png` | `Player.sprite` default + `player-run` animation frames |
| `player-jump` | texture (real sprite) | 500×500 source | `BootScene.preload` via `load.image` from `public/sprites/player/jump.png` | `Player.updateVisuals()` sets this when airborne / flying |
| `platform` | texture (rect) | 64×16, green + top highlight | `BootScene.generateCoreTextures` | fallback when no biome (rare) |
| `hazard` | texture (rect + triangles) | 32×16, red spikes | `BootScene.generateCoreTextures` | `LevelRunner.hazards` (scaled per-segment) |
| `checkpoint` | texture (flag + pole) | 16×48, cyan/blue | `BootScene.generateCoreTextures` | `LevelRunner.checkpoints` (alpha 0.5 inactive → 1.0 active) |
| `bullet` | texture (rect) | 8×4, yellow | `BootScene.generateCoreTextures` | `BulletPool` (`group.defaultKey`) |

### Player animations

Registered once by `BootScene.registerPlayerAnimations()` (idempotent — skips if `anims.exists`). Phaser `AnimationManager` is global, so GameplayScene doesn't need to re-register after `scene.restart`.

| Animation key | Frames | frameRate | repeat | Used by |
|---|---|---|---|---|
| `player-run` | `player-run-1 → 5` | 8 | -1 (infinite) | `Player.updateVisuals()` when grounded & not flying |

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

### World-strip images (variable width × 672 fixed height)

Textures come from `public/pics/*` when `WorldStripImageDef.url` is set; `BootScene.generateWorldStripTextures()` provides debug-colored placeholders otherwise. Texture keys follow the `world-strip-{n}` / `world-strip-final` / `world-strip-boss` convention; the authoritative lists are `WORLD_STRIP_DEMO_DEF.images` in `src/contents/data/levels/world-strip-demo.ts` and `WORLD_STRIP_BOSS_DEF.images` in `src/contents/data/levels/world-strip-boss.ts` — read those files for current order, widths, overlaps, and ground sections (this section intentionally does not duplicate those numbers because the strips are under active iteration).

Current `world-strip-demo` ≈ 7 images built from `public/pics/{1.png, 2.png, 3.png}` (repeated twice) + `4.jpg` as the final, followed by a linear `level-exit` into `world-strip-boss` (single image = `public/pics/boss.png`). WorldStripSystem always calls `setDisplaySize(p.width, strip.height)` so real images at any native resolution get scaled to the declared display size. `BootScene.preload` iterates `ALL_WORLD_STRIP_DEFS = [WORLD_STRIP_DEMO_DEF, WORLD_STRIP_BOSS_DEF]` and dedupes by `textureKey` so `1.png` (referenced by `world-strip-1` + `world-strip-4`) only loads once.

### Audio

Source of truth for keys: `ASSET_KEYS.AUDIO` in `constants.ts`. Source of truth for URLs: `BGM_URLS`. Volumes in `AUDIO_TUNING`.

| Key constant | String | File | Loaded by | Played by |
|---|---|---|---|---|
| `ASSET_KEYS.AUDIO.BGM_LEVEL_01` | `bgm-level-01` | `public/bgms/1-rust-city.mp3` (`BGM_URLS.LEVEL_01`) | `BootScene.preload` → `this.load.audio` | `GameplayScene.startBgmForLevel` → `this.sound.add(key, { loop: true, volume: AUDIO_TUNING.GAME_VOLUME = 0.45 })` |
| *(Vue-side, not a Phaser key)* | — | `public/bgms/menu.mp3` (`BGM_URLS.MENU`) | `home-page.vue` `onMounted` → `new Audio(...)` | `home-page.vue`; autoplay-unlock fallback on first `pointerdown` / `keydown`; volume = `AUDIO_TUNING.MENU_VOLUME = 0.5` |

备选 BGM（存在文件但尚未接入）：`public/bgms/2-.mp3`、`ok3.mp3`、`ok5.mp3`、`ok6.mp3`。接入新曲时：①加一行 `ASSET_KEYS.AUDIO.XXX`、②加一行 `BGM_URLS.XXX`、③`BootScene.preload` 追加 `load.audio`、④`GameplayScene.LEVEL_BGM` 挂到目标 level-id。

### Deprecated

| Key | Note |
|---|---|
| ~~`star`~~ | 2026-04-26;12:40 删除 |
| ~~`player` (generated rect)~~ | 2026-04-26;23:00 删除；被 `player-run-1..5` + `player-jump` 真素材取代。`Player.constructor` 默认 key 改成 `'player-run-1'` |

---

## 13.7 Shared TypeScript types / interfaces

*Last updated: 2026-04-26;23:00. Source of truth: `src/contents/types.ts` (游戏类型) + scattered local `interface Props` in Vue SFCs.*

| Symbol | Defined in | Used by | Purpose |
|---|---|---|---|
| `SceneKey`, `PhaseId`, `ActionId`, `SkillId`, `CapabilityId`, `BiomeId`, `PickupId` | `src/contents/types.ts` | scenes / systems / capabilities / data | 从 `constants.ts` 的 `as const` 对象反推的字面量联合；全局 ID 词汇表 |
| `IGameplaySceneData` | `src/contents/types.ts` | `GameplayScene.init` | `{ startCheckpointId?, levelId?, unlockedSkills? }`；跨关传参 |
| `ParallaxLayerDef` | `src/contents/types.ts` | `LevelDef.background` / `.foreground`, `ParallaxSystem` | 单层视差定义：textureKey + scrollFactor + y/anchor + tint/alpha/depth |
| `ScrollMode`, `LevelScrollDef` | `src/contents/types.ts` | `LevelDef.scroll`, `GameplayScene` | 'auto-right' / 'follow' / 'locked' + speed |
| `PlatformSegmentDef` / `HazardSegmentDef` / `CheckpointSegmentDef` / `PickupSegmentDef` / `NpcSegmentDef` / `BossTriggerSegmentDef` / `LevelExitSegmentDef` / `SegmentDef` | `src/contents/types.ts` | `data/levels/*` + `LevelRunner.load` | 关卡数据的 discriminated union（`type` 字段）。`PlatformSegmentDef.invisible?: boolean` = true 时 `LevelRunner` 跳过 TileSprite 视觉，只保留碰撞体（world-strip 关卡地面画在底图里） |
| `LevelDef` | `src/contents/types.ts` | `data/levels/*` | `{ id, width, height, biome, scroll?, loop?, chunkWidth?, spawn?, background?, foreground?, segments[] }`。`loop=true` 时 platforms/hazards/checkpoints 被当作周期模板；`chunkWidth` 缺省 = `width` |
| `LoadedLevel` | `src/contents/types.ts` | `LevelRunner` | 运行时关卡结构体（含 platforms / hazards / checkpoints / pickups StaticGroups） |
| `SkillKind`, `SkillDef` | `src/contents/types.ts` | `data/skills/*`, `SkillManager` | `{ id, displayName, kind, capabilities[], hotkey?, suppresses? }` |
| `DialogueDef`, `DialogueNode`, `DialogueChoice`, `DialogueCommand` | `src/contents/types.ts` | `DialogueRunner` + `data/dialogues/*` | 节点树 + 命令（grant-skill / equip-skill / heal / set-flag） |
| `BossDef` | `src/contents/types.ts` | `BossEntity` + `data/bosses/*` | `{ id, displayName, maxHp, spawnX, spawnY, sprite? }` |
| `WorldStripGroundSection` | `src/contents/types.ts` | `WorldStripImageDef.sections`, `buildWorldStripLevel` | 本地图片坐标系的地面段：`{ startX, endX, groundHeight }` |
| `WorldStripImageDef` | `src/contents/types.ts` | `WorldStripLoopDef.images`, `BootScene.preload` | 单张 strip 图片：`{ textureKey, url?, width, overlapNext, sections[] }`；有 `url` 时 BootScene 走 `load.image`，无 `url` 时生成占位纹理 |
| `WorldStripLoopDef` | `src/contents/types.ts` | `data/levels/world-strip-demo.ts`, `data/levels/world-strip-boss.ts`, `buildWorldStripLevel` | 一条 world strip 描述：`{ id, height, images[], scroll?, biome?, spawn?, loop?, extraSegments? }`。`loop?: boolean` 默认 true；false 时 `buildWorldStripLevel` 产出 `LevelDef.loop=false` 且 segments 不按 chunk 复制 |
| `WorldStripPlacement` | `src/contents/types.ts` | `buildWorldStripLevel` 产物, `WorldStripSystem.spawnChunk` | 每张图在 chunk 空间的 `{ imageIdx, textureKey, width, leftX, rightX, ownedStartX, ownedEndX }` |
| `BuiltWorldStripLevel` | `src/contents/types.ts` | `WORLD_STRIP_LEVELS` 索引, `GameplayScene.create`, `WorldStripSystem` | `buildWorldStripLevel` 产物：`{ level, strip, placements, chunkWidth, loop }`。`loop` 与 `level.loop` 同步，方便 `WorldStripSystem.tickSpawner` 分派 loop / 非 loop 行为不必反查 LevelDef |
| `PlayerHpChangedPayload`, `PlayerDamagedPayload`, `PlayerDiedPayload`, `PlayerRespawnedPayload` | `src/contents/types.ts` | `Player` + `components/game-hud.vue` | EventBus payloads for player lifecycle |
| `CheckpointReachedPayload`, `LevelCompletedPayload`, `PickupCollectedPayload` | `src/contents/types.ts` | `GameplayScene` + HUD | 关卡进度事件 |
| `DialogueStartPayload` / `DialogueNodePayload` / `DialogueChoiceSelectedPayload` / `DialogueEndPayload` | `src/contents/types.ts` | `dialogue-overlay.vue` | 对话 UI 同步 |
| `BossSpawnedPayload`, `BossHpChangedPayload`, `BossDefeatedPayload` | `src/contents/types.ts` | `game-hud.vue` boss HP bar | Boss 战 HUD |
| `PhaseChangedPayload` | `src/contents/types.ts` | `PhaseController` + HUD | `{ from, to }` |
| `SkillEquippedPayload`, `SkillRevokedPayload` | `src/contents/types.ts` | `SkillManager` + `components/game-hud.vue` | 装备/卸载技能的 HUD 同步 |
| `CapabilityContext`, `Capability` | `src/contents/entities/player/capabilities/capability.ts` | all capabilities + `Player` | Capability 接口（`attach / detach / update? / onAction?`） |
| `CameraMode` | `src/contents/systems/camera-director.ts` | scene 侧查询当前相机模式 | `'follow' \| 'auto-right' \| 'lock'` |
| `ScreenBoundsConfig`, `CrushCallback` | `src/contents/systems/screen-bounds-system.ts` | scene 侧配置夹紧行为 | `{ clampY, pad* }` |
| `PhaseContext`, `Phase` | `src/contents/systems/phase-controller.ts` | Phase 实现 | `Phase` 含可选 `freezesWorld?: boolean` —— true 时 GameplayScene 跳过所有推进世界的系统（`Dialogue` / `Respawn` / 将来的 `Cutscene`） |
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

### `Phaser.Scene.data` bridge keys

*Light-weight service-locator used by cross-cutting concerns so they don't need mutual imports.*

| Key | Set by | Read by | Notes |
|---|---|---|---|
| `cameraDirector` | `GameplayScene.create` | `Player.getCruiseSpeed` | Used so `MoveCapability` / `FlyCapability` can pull "current world cruise speed" without importing `CameraDirector` (which would create a cycle) |
| `playerBulletsGroup` | `GameplayScene.create` | `BossPhase` | Phase-owned enemy colliders reuse player bullet group for bullet-vs-boss overlaps |
| `bossPhaseLevelId` | `GameplayScene.transitionIntoBossPhase` | `BossPhase.enter` | Lets the shared `BossPhase` resolve which `BossDef` to spawn |

---

## 13.9 Work in progress (WIP)

*Claim an area before starting a multi-turn feature. Clear your row when done.*

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

---

## 14. Change log

One line per change that touches §13. Newest at the top. Keep it short.

- **2026-04-26;23:00** — **Linear world-strip → boss scene + real player sprite & animations.** New `src/contents/data/levels/world-strip-boss.ts` — single-image `WorldStripLoopDef` over `public/pics/boss.png` + `loop: false` + boss-trigger (`boss-shadow`, no nextLevelId); exports `WORLD_STRIP_BOSS_DEF` / `WORLD_STRIP_BOSS_BUILD` / `LEVEL_WORLD_STRIP_BOSS`. `world-strip-demo` reshaped to **linear 7-image strip** (`1/2/3.png` ×2 + `4.jpg` final, `loop: false`) terminating in `level-exit (to-boss)` @ chunk x=8950; `SPAWN_PAD_X` moved inside `buildWorldStripLevel` to dodge TDZ from the boss module's eager top-level call; `WORLD_STRIP_LEVELS` now indexes both demo + boss builds. `WorldStripLoopDef.loop?: boolean` (default true) + `BuiltWorldStripLevel.loop` added to `types.ts`; `buildWorldStripLevel` respects `strip.loop`; `WorldStripSystem.tickSpawner` keeps only chunk 0 when `built.loop === false`. `LevelRunner.clearFiredBossTriggers()` new helper — called by `BossPhase.exit` when boss is still alive (phase interrupted = player death) so respawn can re-trigger. `GameplayScene.onBossPhaseCleared` refactored: settlement (`BOSS_VICTORY` + lock camera + pause physics) decoupled from transition — `completeLevel` only runs when `nextLevelId` exists, terminal bosses keep the victory overlay indefinitely. `LEVEL_REGISTRY` + `LEVEL_BGM` gain `LEVEL_WORLD_STRIP_BOSS` entry (shares `BGM_LEVEL_01`). `GameplayScene.update` now calls `levelRunner.tickSpawner` + `worldStrip?.tickSpawner` unconditionally (both self-gate on loop). Player entity swapped from generated blue rectangle to real sprite: `public/sprites/player/{1..5,jump}.png` loaded by `BootScene.preload`, `ALL_WORLD_STRIP_DEFS = [demo, boss]` iterated with set-dedupe for image preloads, `registerPlayerAnimations()` binds global `'player-run'` animation (frameRate 8, repeat -1); `Player.constructor` defaults to `'player-run-1'` + `setScale(0.2)` + 100×270 tex-px hitbox; new `Player.updateVisuals()` toggles `anims.play('player-run')` (grounded) vs `setTexture('player-jump')` (airborne / flying). New static assets: `public/pics/boss.png`, `public/sprites/player/*.png`. §13.1 / §13.3 / §13.4 / §13.6 / §13.7 updated; §13.10 +7 decisions.
- **2026-04-26;17:36** — **World-strip demo + BGM wiring.** New `src/contents/systems/world-strip-system.ts` (chunk-based image spawner, depth `-10000 + k*N + imageIdx`). New `src/contents/data/levels/world-strip-demo.ts` — `WorldStripLoopDef` over `public/pics/*` + `buildWorldStripLevel` builder emitting `loop:true` + `PlatformSegmentDef{invisible:true}` + per-image checkpoints + default spawn; exports `LEVEL_WORLD_STRIP_DEMO` + `WORLD_STRIP_LEVELS`. `PlatformSegmentDef` gains `invisible?: boolean` (LevelRunner skips the TileSprite). `types.ts` gains `WorldStripGroundSection` / `WorldStripImageDef` / `WorldStripLoopDef` / `WorldStripPlacement` / `BuiltWorldStripLevel`. `constants.ts` gains `ASSET_KEYS.AUDIO` / `BGM_URLS` / `AUDIO_TUNING`. `BootScene.preload` loads `BGM_LEVEL_01` + strip image URLs; `create` adds `generateWorldStripTextures` + helper `drawBigDigit` (7-seg) as placeholder when URLs missing. `GameplayScene` registers world-strip in `LEVEL_REGISTRY`, sets `DEFAULT_LEVEL = LEVEL_WORLD_STRIP_DEMO`, instantiates `WorldStripSystem` when `WORLD_STRIP_LEVELS[level.id]` exists, calls `worldStrip.tickSpawner` each frame, starts/pauses/resumes/stops BGM via `LEVEL_BGM` map, clamps camera Y to bottom when world > viewport, replaces camera init `- 200` with `- cam.width / 2`. `RespawnPhase` uses same `cam.width / 2` centering. `home-page.vue` plays `BGM_URLS.MENU` on mount with pointerdown/keydown autoplay-unlock fallback. New static assets: `public/bgms/*.mp3`, `public/pics/*.{png,jpg}`. §13.1 / §13.3 / §13.4 / §13.6 / §13.7 updated; §13.10 +8 decisions.
- **2026-04-26;15:30** — **Doc split:** §13 (Codebase State) + §14 (Change log) extracted from `AGENTS.md` into this file (`CODEBASE_STATE.md`) at repo root; `AGENTS.md` §13/§14 replaced with a pointer. Same turn, catch up registry with commit `f6afae5`: `LevelDef` gains `loop?` + `chunkWidth?`; `LevelRunner` grows chunk-spawner (`platformTemplates` / `hazardTemplates` / `checkpointTemplates` / `chunkObjects` / `tickSpawner` / `isLooping` / exported `LOOP_WORLD_MAX_X`), checkpoint ids rewritten to `${id}@${k}` in loop mode. `Phase.freezesWorld?: boolean` added (RespawnPhase + DialoguePhase set it true); `PhaseController.getCurrent()` exposed. `Player.getCruiseSpeed()` reads `scene.data.cameraDirector`; `MoveCapability` drifts at `cruise × BASE_FORWARD_RATIO` when idle; `FlyCapability` cruises at `cruise × FLY_IDLE_RATIO` instead of damping to 0. NPC dialogue auto-triggers on zone overlap (`seenNpcs` Set; explicit E still works for follow/locked). `level-01` → `loop: true`, drops `level-exit`, adds `boss-trigger` at x=2950, checkpoints thinned to `start` + `pre-boss`; `level-02.scroll.speed 110 → 240`. `SCROLL_TUNING.DEFAULT_SPEED 90 → 200`; `PLAYER_TUNING` adds `BASE_FORWARD_RATIO=0.8` + `FLY_IDLE_RATIO=1.0`. §13.1 / §13.4 / §13.7 / §13.8 updated; §13.10 +4 decisions.
- **2026-04-26;14:00** — Comprehensive demo on top of Phase A2. New entities `NpcEntity` + `BossEntity` (dir `entities/npc/` + `entities/boss/`); new `DialogueRunner` system + Vue `components/dialogue-overlay.vue`; `phase-controller.ts` split — `systems/phases/dialogue-phase.ts` + `systems/phases/boss-phase.ts`. `BulletPool` generalized (textureKey + maxSize + lifetimeMs params) so enemy bullets reuse it. New level `data/levels/level-02.ts` (space biome, Boss "影之使徒" at end, loops back to level-01). `level-01.ts` gains Sage NPC + `nextLevelId: 'level-02'`. Dialogue registry `data/dialogues/{npc-sage,npc-warrior,index}.ts`; boss registry `data/bosses/{boss-shadow,index}.ts`. All previously-reserved `DIALOGUE_*` / `BOSS_*` / `LEVEL_COMPLETED` / `PICKUP_COLLECTED` events now live; `components/game-hud.vue` renders boss HP bar. §13.1 / §13.4 / §13.5 updated; §13.10 +4 decisions.
- **2026-04-26;13:10** — Phase A2 architecture refactor: auto-scroll + 3-layer parallax + screen-bound clamp + double-jump + flight capability/skill. New systems `ParallaxSystem` / `ScreenBoundsSystem`; `CameraDirector` gained `auto-right` mode; `JumpCapability` gained `MAX_AIR_JUMPS`; `Player.isFlying` flag; `FlyCapability` manages gravity + 4-dir input. `LevelDef` extended with `biome` / `scroll` / `background` / `foreground`; new segment types `pickup` / `npc` / `boss-trigger` / `level-exit` (runtime for NPC/boss arrives in demo commit). New EVENT_KEYS: `LEVEL_COMPLETED`, `PICKUP_COLLECTED`, `DIALOGUE_{START,NODE,CHOICE_SELECTED,ADVANCE,END}`, `BOSS_{SPAWNED,HP_CHANGED,DEFEATED}`. New ACTION_IDS: `MOVE_UP`, `MOVE_DOWN`, `ADVANCE`, `CHOICE_1`, `CHOICE_2`. New SKILL `flight`; new CAPABILITY `fly`; new BIOME_IDS / PICKUP_IDS. Many new asset keys (biome tiles, parallax layers, NPC/pickup/boss/enemy-bullet variants). 7 new §13.10 decisions.
- **2026-04-26;12:40** — Phase A runner skeleton shipped. `SCENE_KEYS.GAME` → `SCENE_KEYS.GAMEPLAY`; `game-scene.ts` deleted, replaced by `gameplay-scene.ts`. New subtrees: `contents/{entities,systems,data}/**`. New `EVENT_KEYS`: PLAYER_{HP_CHANGED,DAMAGED,DIED,RESPAWNED}, CHECKPOINT_REACHED, PHASE_CHANGED, SKILL_{UNLOCKED,EQUIPPED,REVOKED}; dropped SCORE_UPDATE. New asset keys: bullet / hazard / checkpoint; dropped star. New HUD: `components/game-hud.vue`. `constants.ts` split into GAME_CONFIG / PLAYER_TUNING / CAMERA_TUNING / POOL_SIZES / PHASE_IDS / ACTION_IDS / SKILL_IDS / CAPABILITY_IDS. 7 new §13.10 decisions documented.
- **2026-04-26;01:35** — 修正 `contents/` 分层描述（"UI 无关 + 与 Phaser 耦合"，不是"引擎无关"）；确认 scenes 留在 `contents/scenes/` 不外拎；新增"runtime → contents 必须走深路径"规则到 §11；同步 §13.10 决策日志（三条新决策）。
- **2026-04-26;01:20** — 分层重构：`core` → `engine`；新增 `contents` 作为游戏内容层（场景/常量/类型的唯一源）；`composables/runtime` → `runtime`（提升到顶级）；`game-demo` 只保留 Vue 挂载示范。同步 §11 / §13.1 / §13.3 / §13.10；engine 不再依赖 `GAME_CONFIG`，改用内部 `SHELL_DEFAULTS`。
- **2026-04-25;00:01** — Initial AGENTS.md rewrite: removed Nuxt / PrimeVue / portal sections irrelevant to this project; added §13 Codebase State registries (routes, scenes, entities, events, assets, types, stores, WIP, decisions) and §0 multi-agent protocol.
