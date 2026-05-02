import type { EventCallback } from "@/engine";
import { GameShell } from "@/engine";
// 深路径 import：避开 @/contents 桶导出，防止 runtime ↔ contents/scenes 在
// 模块初始化时绕成循环（scenes 顶层 import 了 @/runtime）。
import { EVENT_KEYS, GAME_CONFIG } from "@/contents/constants";
import { useEventBus } from "./event-bus";

const eventBus = useEventBus();

// ---- GameShell 单例：模块级闭包，外部拿不到引用 ----
let gameShell: GameShell | null = null;

const ensureShell = (): GameShell => {
  if (!gameShell) {
    throw new Error("Game 尚未初始化，请先调用 initGame(container, initialScene)");
  }
  return gameShell;
};

// ---- 画布尺寸决策 ----

/**
 * 根据容器实际尺寸计算画布初始大小。
 * 优先使用容器的 clientWidth/clientHeight（= 屏幕大小，因为容器是全屏的）；
 * 容器尚未布局完成（宽高为 0）时 fallback 到 GAME_CONFIG 的设计基准值。
 */
const resolveCanvasSize = (container: HTMLElement): { width: number; height: number } => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  return {
    width: w > 0 ? w : GAME_CONFIG.WIDTH,
    height: h > 0 ? h : GAME_CONFIG.HEIGHT,
  };
};

// ---- GameShell 生命周期 ----

const initGame = (
  container: HTMLElement,
  initialScene: typeof Phaser.Scene
) => {
  if (gameShell) return;
  const size = resolveCanvasSize(container);
  gameShell = GameShell.createGameShell(container, initialScene, size);
};

const destroyGame = (removeCanvas = true) => {
  gameShell?.destroy(removeCanvas);
  gameShell = null;
};

// ---- 场景管理（薄包装，转发到 shell） ----

const addScene = (sceneClass: typeof Phaser.Scene, autoStart = false) =>
  ensureShell().addScene(sceneClass, autoStart);

const addScenes = (
  sceneClasses: (typeof Phaser.Scene)[],
  autoStartKey?: string
) => ensureShell().addScenes(sceneClasses, autoStartKey);

const switchToScene = (sceneKey: string, data?: object) =>
  ensureShell().switchToScene(sceneKey, data);

const restartScene = (sceneKey: string, data?: object) =>
  ensureShell().restart(sceneKey, data);

const pauseGame = (sceneKey?: string) => ensureShell().pause(sceneKey);

const resumeGame = (sceneKey?: string) => ensureShell().resume(sceneKey);

// ---- 事件 / 音量 ----
// quitGame 复用 contents 的 EVENT_KEYS.GAME_OVER，避免平行事件字符串。
// 下面 onScoreChange / setVolume 仍使用 runtime 自有的 "score:change" /
// change:volume（Proxy 触发）约定，等真正游戏需要再决定是否并入 EVENT_KEYS。

const quitGame = () => {
  eventBus.emit(EVENT_KEYS.GAME_OVER);
};

const setVolume = (value: number) => {
  rawState.volume = value;
};

const onScoreChange = (cb: EventCallback) => {
  eventBus.on("score:change", cb);
};

const onGameOver = (cb: EventCallback) => {
  eventBus.on("game:over", cb);
};

const rawState = {
  volume: 0,
};

const state = new Proxy(rawState, {
  set(target, prop, value) {
    const ok = Reflect.set(target, prop, value);
    if (ok) {
      // 根据属性分发事件
      eventBus.emit(`change:${String(prop)}`, value);
    }
    return ok;
  },
});

// ---- 对外暴露：freeze 后的只读 API ----

const gameApi = Object.freeze({
  // lifecycle
  initGame,
  destroyGame,
  // scene
  addScene,
  addScenes,
  switchToScene,
  restartScene,
  // playback
  pauseGame,
  resumeGame,
  // misc
  quitGame,
  setVolume,
  onScoreChange,
  onGameOver,
  get volume() {
    return state.volume;
  },
});

export const useGame = () => gameApi;
