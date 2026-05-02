import * as Phaser from "phaser";
import { SHELL_DEFAULTS } from "./defaults";

/**
 * GameShell —— Phaser.Game 生命周期的薄封装。
 *
 * 设计原则：
 *   - 不读取任何"游戏内容"常量（场景 key / 事件 key / 画幅等业务数值）。
 *   - 画布尺寸由调用方（runtime 层）计算好后传入；未传时 fallback 到 SHELL_DEFAULTS。
 *   - Scale.RESIZE 模式让画布在运行时持续跟随容器大小。
 */
export class GameShell {
  private phaserGameInstance: Phaser.Game | null = null;

  private constructor() {}

  /**
   * @param container   Phaser 画布挂载的 DOM 容器
   * @param initialScene 初始场景类，boot 完成后自动启动
   * @param size        画布初始尺寸；由 runtime 的 resolveCanvasSize() 计算。
   *                    未传时 fallback 到 SHELL_DEFAULTS。
   */
  public static createGameShell(
    container: HTMLElement,
    initialScene: typeof Phaser.Scene,
    size?: { width: number; height: number }
  ) {
    const newShell = new GameShell();
    const { width, height } = size ?? SHELL_DEFAULTS;

    newShell.phaserGameInstance = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      scale: {
        mode: Phaser.Scale.RESIZE,
        width,
        height,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: [initialScene],
      input: {
        keyboard: true,
      },
    });

    return newShell;
  }

  addScene(sceneClass: typeof Phaser.Scene, autoStart = false): string {
    // key 传 ""，Phaser 内部会优先使用 scene config 里 super({ key }) 定义的 key
    const scene = this.phaserGameInstance?.scene.add("", sceneClass, autoStart);
    return scene?.sys.settings.key ?? "";
  }

  addScenes(sceneClasses: (typeof Phaser.Scene)[], autoStartKey?: string): string[] {
    const keys = sceneClasses.map(
      (sceneClass) =>
        this.phaserGameInstance?.scene.add("", sceneClass, false)?.sys.settings
          .key ?? ""
    );

    if (autoStartKey && keys.includes(autoStartKey)) {
      this.phaserGameInstance?.scene.start(autoStartKey);
    }

    return keys;
  }

  switchToScene(sceneKey: string, data?: object) {
    this.phaserGameInstance?.scene.start(sceneKey, data);
  }

  pause(sceneKey?: string) {
    if (!this.phaserGameInstance) return;

    if (sceneKey) {
      this.phaserGameInstance.scene.pause(sceneKey);
      return;
    }

    this.phaserGameInstance.scene.getScenes(true).forEach((scene) => {
      scene.scene.pause();
    });
  }

  resume(sceneKey?: string) {
    if (!this.phaserGameInstance) return;

    if (sceneKey) {
      this.phaserGameInstance.scene.resume(sceneKey);
      return;
    }

    this.phaserGameInstance.scene.getScenes(false).forEach((scene) => {
      scene.scene.resume();
    });
  }

  restart(sceneKey: string, data?: object) {
    this.phaserGameInstance?.scene.stop(sceneKey);
    this.phaserGameInstance?.scene.start(sceneKey, data);
  }

  destroy(removeCanvas: boolean) {
    this.phaserGameInstance?.destroy(removeCanvas);
    this.phaserGameInstance = null;
  }
}
