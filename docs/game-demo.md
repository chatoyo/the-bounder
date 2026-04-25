# 游戏 DEMO

## 概述

一个「平台跳跃 + 收集星星」的 **Phaser 4 + Vue 3** 集成 Demo，作为 Game Jam 脚手架的参考实现。

- 路由：`/#/game`（由 `pages/game.vue` 加载，提供全局暂停/恢复/退出）
- Vue 挂载点：`src/pages/game-demo/index.vue`（示范"Vue 侧如何挂载一个 Phaser 游戏"，正式开做时整个 `game-demo/` 会被替换）
- 游戏内容：`src/contents/`（场景类、常量、类型——这是**真正的游戏**）
- 相关文档：
  - `docs/structure.md`（引擎架构总览 + vibe coding 手册）
  - `docs/spec-framework.md`（UI 框架规格）
  - `docs/phaser-study.md`（Phaser × Vue 集成调研）

## 玩法

- 方向键 ← → 移动
- 方向键 ↑ 跳跃（仅地面可跳）
- 碰到黄色星星得 +10 分，一波全部收集完后 1.5s 自动刷新一波
- 右上角「重新开始」按钮 → Vue emit `game:restart` → `GameScene.handleRestart` 重置分数并重启场景
- ESC 或「⏸ 暂停」按钮 → Vue emit `game:pause` / `game:resume` → `GameScene` 切换暂停

## 涉及的文件

Demo 并不是一个独立的自包含目录——它是"Vue 宿主 + 游戏内容 + 运行时胶水"三处文件协作的结果。

### Vue 宿主（page 层）

```text
src/pages/
├── game.vue                       # /game 路由：暂停遮罩、ESC、退出主页
└── game-demo/
    └── index.vue                  # 挂载 Phaser canvas + HUD，负责 initGame/destroy
```

`pages/game-demo/` 现在**只有** `index.vue`，场景/常量/事件总线都已上移到共用层。真正开做游戏时，复制这个文件起一个 `pages/game/index.vue`，然后删掉整个 `game-demo/`。

### 游戏内容（contents 层）

```text
src/contents/
├── constants.ts                   # SCENE_KEYS / EVENT_KEYS / GAME_CONFIG（全项目唯一源）
├── types.ts                       # IGameSceneData 等
└── scenes/
    ├── boot-scene.ts              # 用 generateTexture 生成占位纹理 → 切到 GameScene
    ├── game-scene.ts              # 平台跳跃 + 星星收集 + EventBus 双向通信
    └── index.ts
```

### 运行时胶水（runtime 层）+ 引擎基建（engine 层）

```text
src/runtime/
├── game.ts                        # useGame()：GameShell 单例 + 场景遥控器
├── event-bus.ts                   # useEventBus()：GameEventBus 单例
└── index.ts

src/engine/
├── game-shell/                    # Phaser.Game 生命周期薄封装（GameShell）
├── event-bus/                     # Map<string, Set<cb>> 事件总线（GameEventBus）
└── types.ts
```

依赖方向是单向的：`pages → runtime → engine`，`pages / runtime → contents`，`contents → engine`。engine 不 import 任何项目模块；contents 不 import Vue / 不 import pages。详见 `docs/structure.md §1`。

## 关键技术点

### 1. 占位纹理，零素材依赖

`BootScene.create()` 用 `Phaser.GameObjects.Graphics.generateTexture()` 生成三张占位图：`player`（32×48 蓝色矩形）、`star`（16×16 黄色圆）、`platform`（64×16 绿色矩形）。美术到位后把 `generateTexture` 换成 `this.load.image(...)`，key 保持不变，`GameScene` 零改动。

### 2. Vue ↔ Phaser 唯一通道：EventBus

所有跨世界通信走 `useEventBus()` 拿到的全局单例。当前 demo 使用的事件：

| Key | 方向 | Payload | 用途 |
|---|---|---|---|
| `score:update` | Phaser → Vue | `number` | 每次加分同步给 HUD |
| `game:restart` | Vue → Phaser | — | HUD 重启按钮 |
| `game:pause` | Vue → Phaser | — | ESC / 暂停按钮 |
| `game:resume` | Vue → Phaser | — | 继续游戏 |
| `game:over` | Phaser → Vue | — | 预留，demo 里尚未触发 |

字面量统一在 `contents/constants.ts` → `EVENT_KEYS`，两端都 `import { EVENT_KEYS }`。

### 3. 生命周期卫生

- `GameScene.create()` 里注册 3 个 EventBus 监听；`this.events.on('shutdown', ...)` 里配对 `off`——不靠 GC。
- `pages/game-demo/index.vue` 在 `onUnmounted` 里**精确 `off`**（而不是 `clear()`），避免误清 `pages/game.vue` 挂的 pause/resume 监听。
- `game.destroyGame(true)` 随页面卸载一起调，销毁 Phaser 实例和 canvas。

### 4. 职责切分

| 这件事 | 归谁 |
|---|---|
| 路由跳转、暂停遮罩、HUD 分数显示 | `pages/*.vue` |
| Phaser canvas 的 mount / destroy、EventBus 订阅清理 | `pages/game-demo/index.vue` |
| 玩家移动、碰撞、星星生成、分数逻辑 | `contents/scenes/game-scene.ts` |
| 重力、移动速度、跳跃力度等数值 | `contents/constants.ts` → `GAME_CONFIG` |
| Phaser.Game 生命周期、场景切换封装 | `engine/game-shell/` |
| Vue 侧模块级单例（避免多实例） | `runtime/` |

### 5. Debug 开关

`GameScene` 有 `private debug = false`。改成 `true` 会调用 `this.physics.world.createDebugGraphic()`，看到物理 body 的边界盒。每个新场景都应该复制这个习惯。

## 想调整 Demo 时

- **跳跃太飘 / 太重** → 只改 `contents/constants.ts` 里的 `GAME_CONFIG.PLAYER_JUMP` / `GRAVITY`。
- **星星数量 / 刷新速度** → `GAME_CONFIG.STAR_COUNT` / `STAR_RESPAWN_DELAY`。
- **换色、换形状** → `boot-scene.ts` 里的 `fillStyle` / `fillRect` / `fillCircle`。
- **加新事件 / 新场景 / 新实体** → 参考 `docs/structure.md §6 Vibe coding 手册`。

## 从 Demo 过渡到真实游戏

1. 复制 `pages/game-demo/index.vue` → `pages/game/index.vue`（或你想要的页面名）。
2. 在 `contents/scenes/` 写自己的场景类，`SCENE_KEYS` 里登记新 key。
3. 在新 `index.vue` 里把 `import { BootScene, GameScene } from '@/contents'` 换成你的新场景。
4. `BootScene` 里的 `generateTexture` 逐步替换为 `this.load.image(...)` 真实资源。
5. 删除整个 `pages/game-demo/`，更新 `pages/game.vue` 的子组件引用。
6. 同步更新 `AGENTS.md §13.1 / §13.3 / §14`（注册表 + 变更日志）。
