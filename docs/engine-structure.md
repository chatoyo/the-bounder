# 游戏引擎架构说明 (Engine Structure)

> 面向后续 vibe coding 的开发者（人 + AI agent）。本文档解释 `src/engine/`、`src/contents/`、以及 `src/pages/game-demo/index.vue` 三者之间的职责划分、依赖方向、以及"再写一个新游戏"时你应该在哪里动刀。
>
> 配套阅读：`AGENTS.md`（硬规约 + 活注册表），`docs/game-demo.md`（demo 玩法说明），`docs/phaser-study.md`（Phaser × Vue 集成的背景调研）。

---

## 0. TL;DR

- **四层架构**，单向依赖：`pages → runtime → contents → engine`。
- **`engine/`** = 框架无关、游戏无关的 Phaser 薄封装（`GameShell` + `GameEventBus`）。换一个游戏不改这一层。
- **`contents/`** = 具体游戏世界（场景类、常量、实体、数值）。**不关心** Vue / DOM / 路由。
- **`runtime/`** = Vue 侧模块级单例胶水（`useGame()` / `useEventBus()`）。把 engine 的类包装成"应用生命周期内的全局服务"。
- **`pages/game-demo/index.vue`** = 给你抄的参考范例：**Vue 侧如何把一个 Phaser 游戏挂到 DOM 上**。它不是游戏本身。
- **Vue ↔ Phaser 唯一通道** 是 `GameEventBus`，通过 `useEventBus()` 取到同一个单例。

如果你只想抄代码往前冲，跳到 §6 "Vibe coding 手册"。

---

## 1. 分层全景

```
┌──────────────────────────── Vue SPA ───────────────────────────┐
│ pages/                                                         │
│   home-page.vue / how-to-play.vue / about-us.vue               │
│   game.vue ──► game-demo/index.vue  (挂载 Phaser 的宿主组件)    │
│                       │                                        │
│                       │ useGame() / useEventBus()              │
│                       ▼                                        │
│ runtime/                                                       │
│   game.ts       ── 模块级单例：GameShell + 场景遥控器            │
│   event-bus.ts  ── 模块级单例：GameEventBus                     │
│                       │                                        │
│                       │ new GameShell / new GameEventBus       │
│                       ▼                                        │
│ engine/                                                        │
│   game-shell/   ── Phaser.Game 生命周期薄封装                   │
│   event-bus/    ── Map<string, Set<cb>> 事件总线                │
│   types.ts                                                     │
│                       ▲                                        │
│                       │ extends Phaser.Scene / uses bus        │
│                       │                                        │
│ contents/    (游戏内容层，与 Phaser 耦合，与 UI 解耦)             │
│   constants.ts  ── ★ SCENE_KEYS / EVENT_KEYS / GAME_CONFIG      │
│   types.ts      ── IGameSceneData 等                           │
│   scenes/       ── BootScene / GameScene / ...                 │
│   (未来) entities/ systems/ data/                              │
└────────────────────────────────────────────────────────────────┘
```

### 1.1 依赖方向的硬规矩

| 允许 | 禁止 |
|---|---|
| `pages → runtime` | `engine → contents` |
| `pages → contents`（读常量、import 场景类） | `engine → runtime` |
| `runtime → engine` | `engine → pages` |
| `runtime → contents/constants`（深路径） | `contents → pages` |
| `contents → engine`（场景继承 `Phaser.Scene`） | `contents → @/contents` 桶导出（由 runtime 去 import 时） |
| `contents → runtime`（场景内用 `useEventBus()` / `useGame()`） | — |

> **为什么 runtime 只能走 `@/contents/constants` 深路径？**
> 因为 `contents/scenes/*.ts` 顶层写了 `const eventBus = useEventBus()` / `const game = useGame()`，副作用会在 import 时触发。如果 runtime 经 `@/contents` 桶去取常量，会顺带把 scenes 拉起来；而 scenes 又反向 import `@/runtime`，于是 runtime 模块还没初始化完就被 scene 回调，形成 ESM 循环启动。现用示范：`src/runtime/game.ts:5`。

### 1.2 怎么判断"这段代码该放哪一层"

问自己两个问题：

1. **换一个完全不同的 jam 游戏，它还用得上吗？** 用得上 → `engine/`；用不上 → `contents/`。
2. **它 import 过 `vue` / `ref` / DOM / `RouterLink` 吗？** 是 → `pages/` 或 `components/`；否 → `engine/` 或 `contents/`。

注意："有没有 import Phaser" 不是分层依据。`engine/` 和 `contents/` 都会 import Phaser，只是抽象层级不同。

---

## 2. `src/engine/` —— 引擎层

**宗旨：把 Phaser 的生命周期和跨世界通信封装成两颗稳定的"零件"，任何 jam 游戏都能直接拿来用。**

### 2.1 目录

```
engine/
├── game-shell/
│   ├── game-shell.ts    # GameShell 类
│   ├── defaults.ts      # SHELL_DEFAULTS (引擎内部兜底，不是游戏常量)
│   └── index.ts
├── event-bus/
│   ├── event-bus.ts     # GameEventBus 类
│   └── index.ts
├── types.ts             # EventCallback
└── index.ts             # 桶导出
```

**engine 不 import 任何项目内模块**。它连 `@/contents` 都不能 import。这是 "engine 换游戏不改" 的硬保证。

### 2.2 `GameShell`

位置：`src/engine/game-shell/game-shell.ts:12`。

一个薄到极致的 `Phaser.Game` 包装：

```ts
const shell = GameShell.createGameShell(container, BootScene)
shell.addScene(GameScene)
shell.switchToScene('GameScene', { startScore: 0 })
shell.pause()    // 不传 key 就暂停所有 active 场景
shell.resume()
shell.restart('GameScene')
shell.destroy(true)
```

**设计约束（如果你想改 `GameShell`，先读这三条）：**

1. **签名拒绝 config 对象。** `createGameShell(container, initialScene)` 只接两个参数；画幅、物理、输入想变？在初始场景的 `init()` / `create()` 里用 Phaser 原生 API（`this.scale.resize(...)`、`this.physics.world.setBounds(...)`）。见 `defaults.ts` 的注释，以及 `boot-scene.ts:22` 的用法示范。
2. **不读任何游戏常量。** `SHELL_DEFAULTS = { width: 800, height: 600 }` 只是 Phaser 初始化时必须给个数的兜底。换成别的游戏不会改这个文件。
3. **`addScene(sceneClass, autoStart)` 的 key 参数传空串。** 这样 Phaser 会用 scene 在 `super({ key })` 里声明的 key，保证 "key 的唯一来源在 contents/"，engine 不去二次命名。

Arcade 物理是默认引擎（`AGENTS.md §13.10` 决策记录）。想换 Matter → 先在决策表里加一行再动手。

### 2.3 `GameEventBus`

位置：`src/engine/event-bus/event-bus.ts:3`。

一个 `Map<string, Set<EventCallback>>` 实现的迷你 pub/sub：

```ts
const bus = GameEventBus.createEventBus()
bus.on('score:update', (n) => console.log(n))
bus.emit('score:update', 10)
bus.off('score:update', fn)
bus.clear()                   // 粗暴清光（场景销毁用）
```

**设计注意：**

- 回调签名是 `(...args: unknown[]) => void`。**非 `any`**（项目禁止 `any`）。调用端自己在接收时做 narrowing（`newScore as number`）或在 §13.7 登记强类型 payload。
- `clear()` 会清光所有 listener。页面卸载时**不要**无脑 clear，因为 `runtime/event-bus.ts` 的 bus 是全局单例，其他组件可能也挂了监听。参考 `game-demo/index.vue:50` 的精确 `off`。
- 不使用 `EventTarget` / mitt / EventEmitter，因为我们要的就是"零依赖 + 类型自由度"。

### 2.4 你什么时候需要改 engine？

- 需要加一个**跨游戏都用得到**的生命周期 hook（例如"全局截屏"）。
- 需要在 shell 里加**调度开关**（例如统一的 FPS 限速）。
- 发现 shell 的 API 让所有游戏都得写同样的 5 行样板 → 下沉到 engine。

一般游戏迭代不碰这一层。

---

## 3. `src/contents/` —— 游戏内容层

**宗旨：游戏世界的一切——场景、实体、数值、事件字符串、类型——的唯一事实源。**

### 3.1 目录

```
contents/
├── constants.ts       # ★ SCENE_KEYS / EVENT_KEYS / GAME_CONFIG 唯一源
├── types.ts           # IGameSceneData 等
├── scenes/
│   ├── boot-scene.ts
│   ├── game-scene.ts
│   └── index.ts
├── assets/            # (占位，未来放非代码资产的元数据)
└── index.ts
```

未来按需扩：`entities/`（可复用游戏对象，比如 `PlayerEntity`、`BulletEntity`）、`systems/`（跨场景的逻辑系统）、`data/`（关卡数据、配置表）。小到"一个函数能搞定"就先写在场景内，出现第二次再抽。

### 3.2 `constants.ts`——所有字符串的坟场

位置：`src/contents/constants.ts`。

```ts
export const SCENE_KEYS = {
  BOOT: 'BootScene',
  GAME: 'GameScene',
} as const

export const EVENT_KEYS = {
  SCORE_UPDATE: 'score:update',
  GAME_OVER:    'game:over',
  GAME_RESTART: 'game:restart',
  GAME_PAUSE:   'game:pause',
  GAME_RESUME:  'game:resume',
} as const

export const GAME_CONFIG = {
  WIDTH: 800,
  HEIGHT: 600,
  STAR_COUNT: 12,
  STAR_RESPAWN_DELAY: 1500,
  PLAYER_SPEED: 300,
  PLAYER_JUMP: -600,
  GRAVITY: 800,
} as const
```

**硬规矩：**

- 任何 scene key / event key / asset key / 数值常量，**字面量只能出现在这里**。其它文件只能 `import { X }`。
- 命名：scene key = `PascalCase` 字符串，event key = `namespace:verb`，数值 = `UPPER_SNAKE_CASE`。
- 新增项必须**同步更新 `AGENTS.md §13.3 / §13.5 / §13.6`**。Registry 不同步 = 其他 agent 看不见 = 必撞车。

### 3.3 Scenes 约定

场景类都继承 `Phaser.Scene`。参考 `src/contents/scenes/game-scene.ts`：

```ts
export class GameScene extends Phaser.Scene {
  // 1. 所有字段显式类型；! 仅用于 create() 里初始化的字段
  private player!: Phaser.Physics.Arcade.Sprite
  private score = 0

  // 2. debug 开关，每个场景必备
  private debug = false

  // 3. key 从 SCENE_KEYS 取
  constructor() { super({ key: SCENE_KEYS.GAME }) }

  // 4. 有初始化参数 → 声明 IGameSceneData 接口
  init(data: IGameSceneData): void { this.score = data.startScore ?? 0 }

  create(): void {
    /* ...游戏世界搭建... */

    // 5. 监听 EventBus 的注册放 create
    eventBus.on(EVENT_KEYS.GAME_PAUSE, this.handlePause)

    // 6. 一定要在 shutdown 里 off，别靠 GC
    this.events.on('shutdown', () => {
      eventBus.off(EVENT_KEYS.GAME_PAUSE, this.handlePause)
    })

    // 7. debug 可视化
    if (this.debug) this.physics.world.createDebugGraphic()
  }

  // 8. update 只做入口调度，真实逻辑丢给 entity.update(time, delta)
  update(): void { /* ... */ }
}
```

**handler 用箭头函数 field**（`private handlePause = (): void => { ... }`），这样 `this` 不会在 `bus.on` 时丢失，也能被 `bus.off` 精确摘除。参考 `game-scene.ts:151`。

### 3.4 资产 key 与占位纹理

当前 demo 没有任何真实图片/音频文件。`BootScene.create()`（`src/contents/scenes/boot-scene.ts:43`）用 `Phaser.GameObjects.Graphics.generateTexture()` 生成占位纹理：

```ts
const g = this.make.graphics({ x: 0, y: 0 })
g.fillStyle(0x4488ff, 1)
g.fillRect(0, 0, 32, 48)
g.generateTexture('player', 32, 48)
g.destroy()
```

**这是 feature，不是 stopgap。** 占位纹理让游戏逻辑先跑起来；美术到位后把对应 `generateTexture` 换成 `this.load.image('player', '/assets/player.png')`，key 保持不变，所有 `GameScene` 里的 `...create(..., 'player')` 零修改。

---

## 4. `src/runtime/` —— Vue 侧单例胶水层

（本文档的重点在 engine / contents / game-demo，这里只点到为止，详细接口看文件注释。）

### 4.1 它在做什么

engine 暴露的是**类**（`GameShell`、`GameEventBus`），直接在多个 Vue 组件里各自 `new` 会得到不同实例——HUD 监听的 bus 和场景 emit 的 bus 不是同一个，通信失效。

所以 runtime 做一件事：**把类包成模块级闭包单例**。

- `runtime/event-bus.ts` → `useEventBus()`：懒创建全局唯一的 `GameEventBus`。
- `runtime/game.ts` → `useGame()`：懒创建全局唯一的 `GameShell`，并把常用场景操作（`addScene` / `switchToScene` / `pauseGame` / ...）包装为 `Object.freeze` 的只读 API。

### 4.2 使用约定

```ts
import { useGame, useEventBus } from '@/runtime'

const game = useGame()
const eventBus = useEventBus()

game.initGame(containerEl, BootScene)  // 只调一次
game.addScene(GameScene)
// ... 游戏运行中 ...
game.destroyGame(true)                  // 组件卸载时
```

`useGame()` / `useEventBus()` **不是 Vue composable**（不依赖组件生命周期，不返回 `Ref`）。它们是模块级单例服务。真正的 composable（返回 `Ref` 的那种）应放 `src/composables/`。

---

## 5. `src/pages/game-demo/index.vue` —— Vue 挂载范例

这个文件**不是游戏**，它是一段模板：告诉你在 Vue 组件里怎么把 Phaser 游戏挂进来、怎么和 HUD 通信、怎么干净地卸载。新游戏拿它改一改就能跑。

### 5.1 三段结构

**template** —— 一个可挂载的 `div` + 叠在上方的 HUD：

```vue
<div ref="gameContainer" class="game-demo__canvas">
  <div class="game-demo__hud">            <!-- pointer-events-none -->
    <span>⭐ 分数: {{ score }}</span>
    <button @click="restartGame" class="pointer-events-auto">重新开始</button>
  </div>
</div>
```

关键点：HUD 容器 `pointer-events-none`，需要交互的按钮单独加 `pointer-events-auto`。否则 HUD 会吞掉 Phaser 的鼠标事件。

**script setup** —— 订阅 / 挂载 / 清理：

```ts
const gameContainer = ref<HTMLDivElement>()
const score = ref(0)
const eventBus = useEventBus()
const game = useGame()

const onScoreUpdate = (newScore: unknown) => {
  score.value = newScore as number
}

const restartGame = () => {
  score.value = 0
  eventBus.emit(EVENT_KEYS.GAME_RESTART)
}

onMounted(() => {
  if (!gameContainer.value) return
  eventBus.on(EVENT_KEYS.SCORE_UPDATE, onScoreUpdate)
  game.initGame(gameContainer.value, BootScene)
  game.addScene(GameScene)
})

onUnmounted(() => {
  eventBus.off(EVENT_KEYS.SCORE_UPDATE, onScoreUpdate)  // 精确 off
  game.destroyGame(true)
})
```

**style scoped** —— 顶部 `@reference "@/style.css";` 让 v4 能解析 `@apply` 里的 theme token。

### 5.2 三条必须记住的纪律

1. **`eventBus.off`，不要 `eventBus.clear()`。** bus 是全局单例；`clear()` 会把 `pages/game.vue` 注册的 pause/resume 监听一起干掉。参考 `game-demo/index.vue:49` 的注释。
2. **`initGame` / `destroyGame` 必须成对**，且放在 `onMounted` / `onUnmounted`。模板里 `gameContainer` ref 直到挂载后才有值，`runtime/game.ts` 的单例也假设你一进一出。
3. **HUD 只读不写游戏状态。** HUD 里显示的 `score` 来自 `SCORE_UPDATE` 事件；HUD 里想让游戏做什么（重启、暂停），emit 对应 event，场景里接。**不要**在 Vue 里直接摸 `this.player.setVelocity`。

### 5.3 `pages/game.vue` 如何复用这个范例

`src/pages/game.vue` 是真正的 `/game` 路由页，它把 `game-demo/index.vue` 作为子组件 mount（`<GameDemo />`），自己只负责「暂停遮罩」+「ESC 切暂停」+「退回主页」。Vue → Phaser 也是走 EventBus：

```ts
// game.vue
eventBus.emit(EVENT_KEYS.GAME_PAUSE)     // ◄── GameScene.handlePause 响应
eventBus.emit(EVENT_KEYS.GAME_RESUME)
```

这样 `game.vue` 不需要知道 Phaser 的任何内部细节。

### 5.4 真正开做游戏时怎么办

`game-demo/` 会被整个删掉，换成 `pages/game/index.vue`（或类似命名）。步骤：

1. 复制 `game-demo/index.vue` 为新起点。
2. 在 `contents/scenes/` 写你自己的场景类，注册到 `SCENE_KEYS`。
3. 把 `BootScene` 里的 `generateTexture` 改成 `this.load.image(...)` 真实资源。
4. 在新 `index.vue` 里把 `import { BootScene, GameScene } from '@/contents'` 换成你新场景的名字。
5. 删 `pages/game-demo/`，更新 `AGENTS.md §13.1 / §13.3 / §14`。

---

## 6. Vibe coding 手册

### 6.1 调手感（最常见的任务）

人说"跳跃太飘" / "重力太重" / "玩家太慢" → **只改 `src/contents/constants.ts` 里的 `GAME_CONFIG`**，不要去改场景代码。

```ts
PLAYER_JUMP: -600,   // 更飘 → -700，更沉 → -450
GRAVITY: 800,        // 更沉 → 1200
PLAYER_SPEED: 300,
```

改完立刻看效果，**不要顺手重构**（除非明确被要求）。Vibe coding 的核心是"小改 → 立即跑 → 再改"。

### 6.2 加一个新场景

1. `contents/constants.ts`：`SCENE_KEYS.GAME_OVER = 'GameOverScene'`。
2. `contents/scenes/game-over-scene.ts`：继承 `Phaser.Scene`，`super({ key: SCENE_KEYS.GAME_OVER })`，写 `init` / `create`。
3. `contents/scenes/index.ts`：加一行 `export * from './game-over-scene'`。
4. Vue 侧 `index.vue`：`game.addScene(GameOverScene)`。
5. 要切过去：在 `GameScene` 里 `this.scene.start(SCENE_KEYS.GAME_OVER, { score: this.score })`，或从 Vue 侧 `game.switchToScene('GameOverScene', {...})`。
6. **同步更新 `AGENTS.md §13.3`**。

### 6.3 加一个新事件

1. `EVENT_KEYS.BOSS_DEFEATED = 'boss:defeated'`。
2. 如果 payload 非平凡，在 `contents/types.ts` 里加接口。
3. 场景里 `eventBus.emit(EVENT_KEYS.BOSS_DEFEATED, payload)`。
4. Vue 里 `eventBus.on(EVENT_KEYS.BOSS_DEFEATED, cb)` + `onUnmounted` 里精确 `off`。
5. **同步更新 `AGENTS.md §13.5`**。

### 6.4 加一个新实体（例如 Enemy）

**小规模：** 直接在 `GameScene.create()` 里 `this.physics.add.group()`，spawn 逻辑写在场景内。像现在的 `stars`。

**要复用 / 多场景 / 行为复杂：** 建 `contents/entities/enemy-entity.ts`，导出一个类或工厂函数，场景里 `new EnemyEntity(this, x, y)`。首次抽象不要过度设计；第二次出现再往上提。

### 6.5 加一个新资产

- 代码画得出来：`BootScene.create()` 里 `generateTexture('key', w, h)`。
- 需要真实图片：把图片丢 `public/assets/`，在 `BootScene.preload()` 里 `this.load.image('key', '/assets/xxx.png')`。
- 不管哪种，key 都登记进 `AGENTS.md §13.6`。

### 6.6 暂停 / 恢复 / 重启

已经有现成 event，不要重新发明：

- Vue → Phaser：emit `EVENT_KEYS.GAME_PAUSE` / `GAME_RESUME` / `GAME_RESTART`。
- `GameScene` 已经在 `handlePause` / `handleResume` / `handleRestart` 里响应。

新场景若想支持暂停，复制 `game-scene.ts` 里那三个 handler + `create()` 末尾的 `on` + `shutdown` 里的 `off`。

---

## 7. 常见坑与排错

| 现象 | 原因 | 对策 |
|---|---|---|
| "Game 尚未初始化" | `useGame().addScene(...)` 在 `initGame` 之前调用 | 所有 `game.xxx` 调用放 `onMounted`，且 `initGame` 在最前 |
| HUD 吞掉鼠标点击 | HUD 容器没写 `pointer-events-none` | 容器 none，交互元素单独 auto |
| Vue 重新进入 `/game` 页面后事件监听翻倍 | `onUnmounted` 忘了 `off` 或用了 `clear()` | 对每个 `on` 配一个精确 `off` |
| 改了 `GAME_CONFIG.WIDTH` 画布没变 | shell 用的是 `SHELL_DEFAULTS` 兜底，跟 `GAME_CONFIG` 不通 | 在 `BootScene.init/preload` 里 `this.scale.resize(GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT)` |
| `runtime` 里 import `@/contents` 时运行报错 | 桶导出触发 scenes 的顶层副作用，产生 ESM 循环 | runtime 里改用深路径：`import ... from '@/contents/constants'` |
| `@apply` 在 scoped style 里找不到 token | 缺少 `@reference` | 文件顶部加 `@reference "@/style.css";` |
| 场景切换后旧监听器还在跑 | `shutdown` 事件里没 off | 每个 `bus.on` 都要在 `this.events.on('shutdown', ...)` 里配对 off |

---

## 8. 一图流总结

```
           ┌─────────────────┐
           │  pages/game.vue │   ← 路由、暂停 UI、ESC
           └────────┬────────┘
                    │  <GameDemo />
                    ▼
      ┌──────────────────────────────┐
      │ pages/game-demo/index.vue    │   ← 挂 canvas、HUD、initGame/destroy
      └───────┬───────────┬──────────┘
              │           │
    useGame() │           │ useEventBus()
              ▼           ▼
      ┌─────────────┐  ┌──────────────┐
      │ runtime/    │  │ runtime/     │
      │ game.ts     │  │ event-bus.ts │
      └──────┬──────┘  └──────┬───────┘
             │                │
    new GameShell      new GameEventBus
             │                │
             ▼                ▼
      ┌─────────────────────────────┐
      │ engine/ (不 import 任何项目模块) │
      └─────────────────────────────┘
             ▲                ▲
             │  extends       │  emit/on
             │  Phaser.Scene  │
      ┌──────┴────────────────┴──────┐
      │ contents/scenes/*.ts          │   ← 游戏世界的一切
      │   ← 读 contents/constants.ts  │
      └──────────────────────────────┘
```

读这张图的口诀：**"UI 喊 runtime，runtime 转 engine，scenes 用 engine 和 contents 自治——engine 永远在最底，永远不知道上面在玩什么游戏。"**

---

## 9. 想做什么 → 去哪里改

| 想做什么 | 改哪里 | 不要改哪里 |
|---|---|---|
| 改数值手感 | `contents/constants.ts` | 场景代码 |
| 加新场景 | `contents/scenes/` + `SCENE_KEYS` | engine |
| 加 Vue ↔ Phaser 通信 | `EVENT_KEYS` + 两端 on/emit | `window.addEventListener` |
| 加 HUD / 菜单 / 遮罩 | `pages/*.vue` 或 `components/` | 场景里写 DOM |
| 加跨游戏通用能力 | `engine/`（先写 §13.10 决策） | contents |
| 加 Vue composable（`useXxx()` 返回 Ref） | `composables/` | runtime |
| 加全局单例服务 | `runtime/` | composables |
| 加新路由 | `router/index.ts` | 其它地方硬编码路径 |

---

## 10. 进一步阅读

- `AGENTS.md §0` —— 多 agent 协作协议（read-before-write 清单 + WIP 认领）。
- `AGENTS.md §13` —— 活注册表：所有 scene / event / asset / route / store。**写代码前先看，写完必须更新。**
- `docs/phaser-study.md` —— Phaser 与 Vue 集成的原始调研（中文，193 行）。
- `docs/game-demo.md` —— 当前 demo 的玩法和结构走读。
- Phaser 4 skill：项目根 `.skills/phaser-js/SKILL.md` 提供了常用 API / 物理 / 输入 / 场景生命周期速查。
