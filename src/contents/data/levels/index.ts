/**
 * 关卡总目录 —— 所有运行时 registry 的唯一来源。
 *
 * 加新关卡的流程：
 *   1. 在本目录新建 `your-level.ts`，声明 `WorldStripLoopDef` 并跑一遍
 *      `buildWorldStripLevel(...)`，导出 `LEVEL_YOUR_LEVEL` + `*_BUILD` + `*_DEF`。
 *   2. 在下方 `LEVEL_DEFINITIONS` 数组里追加一行 `{ build, stripDef, bgmKey? }`。
 *   3. 完事 —— `LEVEL_REGISTRY` / `WORLD_STRIP_LEVELS` / `LEVEL_BGM` /
 *      `ALL_WORLD_STRIP_DEFS` 全部由本数组派生，不需要改 GameplayScene / BootScene。
 *
 * 字段含义：
 *   - `build`: `BuiltWorldStripLevel`（来自 buildWorldStripLevel）。其 `level` 字段
 *     喂给 LEVEL_REGISTRY；自身又收进 WORLD_STRIP_LEVELS 给 WorldStripSystem 查询。
 *   - `stripDef`: 原始 `WorldStripLoopDef`，BootScene 据此 preload 图片素材。
 *   - `bgmKey`: 该关卡播放的 audio key；缺省 → 静音。
 */

import { ASSET_KEYS } from '@/contents/constants'
import type {
  BuiltWorldStripLevel,
  LevelDef,
  WorldStripLoopDef,
} from '@/contents/types'
import {
  LEVEL_WORLD_STRIP_DEMO,
  WORLD_STRIP_DEMO_BUILD,
  WORLD_STRIP_DEMO_DEF,
} from './world-strip-demo'
import {
  LEVEL_WORLD_STRIP_BOSS,
  WORLD_STRIP_BOSS_BUILD,
  WORLD_STRIP_BOSS_DEF,
} from './world-strip-boss'

interface LevelEntry {
  /** 编译后的关卡（`level` 字段是 LevelDef） */
  readonly build: BuiltWorldStripLevel
  /** 原始 strip 描述；BootScene preload 走它的 images.url */
  readonly stripDef: WorldStripLoopDef
  /** 关卡 BGM 的 audio key；不填 → 静音 */
  readonly bgmKey?: string
}

/**
 * 单一来源：每条目 = 一关。GameplayScene / BootScene 只看下面四个 derived 常量。
 */
const LEVEL_DEFINITIONS: readonly LevelEntry[] = [
  {
    build: WORLD_STRIP_DEMO_BUILD,
    stripDef: WORLD_STRIP_DEMO_DEF,
    // Runner 关卡借用 "Rust City"
    bgmKey: ASSET_KEYS.AUDIO.BGM_LEVEL_01,
  },
  {
    build: WORLD_STRIP_BOSS_BUILD,
    stripDef: WORLD_STRIP_BOSS_DEF,
    bgmKey: ASSET_KEYS.AUDIO.BGM_BOSS,
  },
]

/** id → LevelDef。GameplayScene 用它解析 levelId。 */
export const LEVEL_REGISTRY: Readonly<Record<string, LevelDef>> = Object.fromEntries(
  LEVEL_DEFINITIONS.map((e) => [e.build.level.id, e.build.level]),
)

/** id → BuiltWorldStripLevel。GameplayScene 据此决定是否挂 WorldStripSystem。 */
export const WORLD_STRIP_LEVELS: Readonly<Record<string, BuiltWorldStripLevel>> =
  Object.fromEntries(LEVEL_DEFINITIONS.map((e) => [e.build.level.id, e.build]))

/** id → audio key（未声明的关卡 = 静音）。 */
export const LEVEL_BGM: Readonly<Record<string, string | undefined>> = Object.fromEntries(
  LEVEL_DEFINITIONS.map((e) => [e.build.level.id, e.bgmKey]),
)

/** BootScene.preload 用：所有 strip 关卡的原始 def，按顺序迭代 images.url 完成预加载。 */
export const ALL_WORLD_STRIP_DEFS: readonly WorldStripLoopDef[] = LEVEL_DEFINITIONS.map(
  (e) => e.stripDef,
)

// 关卡 LevelDef 别名 —— GameplayScene 选默认关卡 / 判定 boss 关卡专属逻辑时用
export { LEVEL_WORLD_STRIP_DEMO, LEVEL_WORLD_STRIP_BOSS }
