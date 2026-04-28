/**
 * Level：world-strip 线性演示 —— 用 `public/pics/1.png` / `2.png` / `3.png` / `4.jpg`
 * 拼接；跑完 7 张图后把玩家扔进 boss 专用场景（world-strip-boss）。
 *
 * 数据模型：
 *   - `WorldStripLoopDef.images`：一串变宽定高的底图。
 *   - `WorldStripImageDef.overlapNext`：本图右边缘被下一张图覆盖的像素数（显示空间）；
 *     chunk 空间中 `image_{i+1}.leftX = image_i.leftX + image_i.width - image_i.overlapNext`。
 *   - `WorldStripImageDef.sections`：本图内的地面轮廓段（显示坐标系内的局部 x + 厚度）。
 *   - `WorldStripImageDef.url`：真实素材的相对 URL（有值时 BootScene 走 load.image）。
 *   - `WorldStripLoopDef.loop=false`（本关）：整条 strip 只跑一次，跑到底后相机被
 *     camera.bounds clamp 在 `chunkWidth - cam.width`，世界"停下来"。玩家继续向前漂
 *     （MoveCapability 的 BASE_FORWARD_RATIO × cruise 始终 > 0），被 screen-bounds
 *     夹到视口右缘 → 触碰下方那个 `to-boss` level-exit → 载入 world-strip-boss。
 *
 * 编译到 LevelDef：
 *   - `buildWorldStripLevel`（见 `world-strip-builder.ts`）把每段 section 翻译成一个
 *     `invisible: true` 的 `PlatformSegmentDef`，放在对应 chunk 位置。
 *   - 每张图的起点各放一个 checkpoint（loop=false 下不复制），玩家死后重生到最近触达的那一个。
 *
 * 本关卡数据（真实素材；总 chunkWidth = 8992 像素）：
 *   - img-0..6：1.png / 2.png / 3.png 各两轮 + 4.jpg 收尾
 *
 * Level-exit "to-boss"：放在 chunk x=10000（world-strip-final 境内，最右端附近）。
 * 相机 clamp 后玩家被 screen-bounds 夹到右缘附近，findLevelExitAt 命中 →
 * completeLevel('world-strip-boss') → scene.restart 进入 boss 场景。
 */

import { BIOME_IDS } from '@/contents/constants'
import type {
  BuiltWorldStripLevel,
  LevelDef,
  WorldStripLoopDef,
} from '@/contents/types'
import { buildWorldStripLevel } from './world-strip-builder'

// =============================================================================
// 演示数据
// =============================================================================

const WORLD_STRIP_DEMO: WorldStripLoopDef = {
  id: 'world-strip-demo',
  height: 672,
  biome: BIOME_IDS.GRASS,
  // 非循环：跑完 7 张图就让相机 clamp，level-exit 接管去 boss 场景。
  loop: false,
  scroll: { mode: 'auto-right', speed: 270 },
  images: [
    // 1.png：1569×672 原生；三段阶梯下降 209 → 190 → 165
    {
      textureKey: 'world-strip-1',
      url: '/pics/1.png',
      width: 1569,
      overlapNext: 460,
      sections: [
        { startX: 0, endX: 826, groundHeight: 180 },
        { startX: 826, endX: 1055, groundHeight: 160 },
        { startX: 1055, endX: 1569, groundHeight: 136 },
      ],
    },
    // 2.png：1569×672 原生；平地 h=165
    {
      textureKey: 'world-strip-2',
      url: '/pics/2.png',
      width: 1569,
      overlapNext: 0,
      sections: [
        { startX: 0, endX: 869, groundHeight: 136 },
        { startX: 589, endX: 1569, groundHeight: 150 },
      ],
    },
    // 3.png：3018×1280 原生，按 672 高度等比缩放到 1584 × 672 显示；平地 h=165
    {
      textureKey: 'world-strip-3',
      url: '/pics/3.png',
      width: 1570,
      overlapNext: 0,
      sections: [{ startX: 0, endX: 1570, groundHeight: 150 }],
    },
    // loop
    // 1.png：1569×672 原生；三段阶梯下降 209 → 190 → 165
    {
      textureKey: 'world-strip-4',
      url: '/pics/1.png',
      width: 1569,
      overlapNext: 460,
      sections: [
        { startX: 0, endX: 826, groundHeight: 180 },
        { startX: 826, endX: 1055, groundHeight: 160 },
        { startX: 1055, endX: 1569, groundHeight: 136 },
      ],
    },
    // 2.png：1569×672 原生；平地 h=165
    {
      textureKey: 'world-strip-5',
      url: '/pics/2.png',
      width: 1569,
      overlapNext: 0,
      sections: [
        { startX: 0, endX: 869, groundHeight: 136 },
        { startX: 589, endX: 1569, groundHeight: 150 },
      ],
    },
    // 3.jpg：3018×1280 原生，按 672 高度等比缩放到 1584 × 672 显示；平地 h=165
    {
      textureKey: 'world-strip-6',
      url: '/pics/3.png',
      width: 1570,
      overlapNext: 0,
      sections: [{ startX: 0, endX: 1570, groundHeight: 150 }],
    },
    // final:
    {
      textureKey: 'world-strip-final',
      url: '/pics/4.jpg',
      width: 1568,
      overlapNext: 0,
      sections: [{ startX: 0, endX: 1568, groundHeight: 150 }],
    },
  ],
  extraSegments: [
    // 终点：跑完最后一张图后由 level-exit 接管，跳到 boss 场景。
    {
      type: 'level-exit',
      id: 'to-boss',
      x: 10000,
      y: 500,
      nextLevelId: 'world-strip-boss',
    },
  ],
}

// =============================================================================
// Exports
// =============================================================================

/** 演示用的 world-strip loop（原始描述数据，builder 输入；BootScene preload 会迭代它的 images.url）。 */
export const WORLD_STRIP_DEMO_DEF: WorldStripLoopDef = WORLD_STRIP_DEMO

/** 编译后的演示关卡 + placement 元数据。GameplayScene 查询这个 */
export const WORLD_STRIP_DEMO_BUILD: BuiltWorldStripLevel = buildWorldStripLevel(WORLD_STRIP_DEMO)

/** LevelDef 别名，方便 import 进 LEVEL_REGISTRY。 */
export const LEVEL_WORLD_STRIP_DEMO: LevelDef = WORLD_STRIP_DEMO_BUILD.level
