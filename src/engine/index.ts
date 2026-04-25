// 引擎统一出口：只暴露框架无关的基建
// 注意：engine 不持有任何游戏业务常量（场景 key / 事件 key / 画幅等）。
//      那些请在各自的 game / demo 的 constants.ts 里定义并 import。
export * from "./game-shell";
export * from "./event-bus";
export * from "./types";
