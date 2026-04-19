# Momakoding Game Jam Starter

Game Jam 快速原型项目，基于 Vue 3 + Phaser 4 + Tailwind CSS 4 构建。

## 技术栈

- Vue 3 (Composition API, `<script setup lang="ts">`)
- Phaser 4 (Arcade 物理引擎)
- Vue Router 4
- Tailwind CSS 4
- Pinia (预留)
- TypeScript 严格模式
- Vite 8

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build
```

## 项目结构

```
src/
├── main.ts                    # 应用入口
├── App.vue                    # 根组件
├── style.css                  # Tailwind 全局样式入口
│
├── pages/                     # 页面组件
│   ├── home-page.vue          # 首页：标题 + 菜单按钮
│   ├── how-to-play.vue        # 玩法介绍
│   ├── about-us.vue           # 关于我们
│   ├── game.vue               # 游戏容器（暂停/恢复/退出管理）
│   └── game-demo/             # ⭐ Phaser Demo（独立文件夹，可整体删除）
│       ├── index.vue           # Phaser 画布 + HUD
│       ├── constants.ts        # 常量定义
│       ├── event-bus.ts        # Phaser ↔ Vue 事件总线
│       └── scenes/
│           ├── boot-scene.ts   # 资源加载（占位图形）
│           └── game-scene.ts   # 主游戏逻辑
│
├── components/                # 可复用 UI 组件
│   └── game-button.vue
│
├── composables/               # 组合式函数
│   └── index.ts
│
├── core/                      # 游戏核心逻辑（预留）
│   └── index.ts
│
└── router/                    # 路由配置
    └── index.ts
```

## 路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | `home-page.vue` | 首页菜单 |
| `/how-to-play` | `how-to-play.vue` | 玩法介绍 |
| `/about-us` | `about-us.vue` | 关于我们 |
| `/game` | `game.vue` → `game-demo/` | 游戏页面 |

## 游戏 Demo

访问 `/#/game` 进入平台跳跃收集星星的 Demo。

操作方式：

- ← → 方向键移动
- ↑ 跳跃（仅地面可跳）
- ESC 暂停/恢复
- 收集黄色星星得分，全部收集后自动刷新

架构特点：

- `game.vue` 作为全局游戏管理容器，负责暂停/恢复/退出
- `game-demo/index.vue` 负责 Phaser 实例创建和 HUD 显示
- 全部使用 `generateTexture` 生成占位图形，零外部素材依赖
- EventBus 实现 Phaser 与 Vue 的双向通信

详细学习文档见 `docs/phaser-study.md`。

## 文档

- `docs/spec-framework.md` — UI 框架规格说明
- `docs/game-demo.md` — 游戏 Demo 说明
- `docs/phaser-study.md` — Phaser + Vue 集成学习拆解
