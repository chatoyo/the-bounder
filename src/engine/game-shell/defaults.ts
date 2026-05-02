/**
 * 引擎级缺省值 —— 仅当调用方未提供画布尺寸时的最终兜底。
 *
 * 正常流程中 runtime 层的 resolveCanvasSize() 会根据容器实际大小 / GAME_CONFIG
 * 计算出最终尺寸传给 createGameShell，这里的值几乎不会被用到。
 */
export const SHELL_DEFAULTS = {
  width: 800,
  height: 600,
} as const
