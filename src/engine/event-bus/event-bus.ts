import type { EventCallback } from "../types";

export class GameEventBus {
  private listeners = new Map<string, Set<EventCallback>>();

  private constructor() {}

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, ...args: unknown[]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((ccb) => ccb(...args));
    }
  }

  /** 清理所有监听器（场景销毁时必须调用） */
  clear(): void {
    this.listeners.clear();
  }

  /** 未来根据需要进行更新 */
  public static createEventBus() {
    return new GameEventBus();
  }
}
