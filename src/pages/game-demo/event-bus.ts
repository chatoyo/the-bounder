/**
 * 跨框架事件总线 (单例)
 *
 * 用于 Phaser 场景 <-> Vue 组件 之间的通信。
 * 底层使用浏览器原生 EventTarget，轻量无依赖。
 *
 * 用法:
 *   eventBus.emit('score:update', 10)
 *   eventBus.on('score:update', (score) => { ... })
 */

type EventCallback = (...args: unknown[]) => void

class GameEventBus {
  private target = new EventTarget()
  private listeners = new Map<string, Set<EventCallback>>()

  on(event: string, callback: EventCallback): void {
    const wrapper = ((e: CustomEvent) => {
      callback(...(e.detail as unknown[]))
    }) as EventListener

    // 保存映射关系，方便 off 时移除
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)

    // 把 wrapper 挂到 callback 上，off 时能找到
    ;(callback as unknown as Record<string, unknown>).__wrapper = wrapper
    this.target.addEventListener(event, wrapper)
  }

  off(event: string, callback: EventCallback): void {
    const wrapper = (callback as unknown as Record<string, unknown>).__wrapper as EventListener | undefined
    if (wrapper) {
      this.target.removeEventListener(event, wrapper)
    }
    this.listeners.get(event)?.delete(callback)
  }

  emit(event: string, ...args: unknown[]): void {
    this.target.dispatchEvent(new CustomEvent(event, { detail: args }))
  }

  /** 清理所有监听器（场景销毁时调用） */
  clear(): void {
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((cb) => this.off(event, cb))
    })
    this.listeners.clear()
  }
}

/** 全局单例 */
export const eventBus = new GameEventBus()
