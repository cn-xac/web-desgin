import type { Fulfilled, InterceptorManager, Rejected } from "./types";

interface Handler<V, R> {
  fulfilled: Fulfilled<V, R>;
  rejected?: Rejected;
}

/**
 * 拦截器管理器（与 axios 同名 API 对齐）：
 * - use(fulfilled, rejected?) 返回 id，可用于 eject 移除；
 * - clear() 清空全部。
 *
 * 与 axios 的差异：本实现遍历顺序即「注册顺序」。请求拦截器在 client 里按注册顺序
 * 串入链（FIFO），更符合直觉；axios 的请求拦截器是逆序执行，容易踩坑。
 */
export class InterceptorManagerImpl<V, R = V> implements InterceptorManager<V, R> {
  private handlers: Array<Handler<V, R> | null> = [];

  use(fulfilled: Fulfilled<V, R>, rejected?: Rejected): number {
    this.handlers.push({ fulfilled, rejected });
    return this.handlers.length - 1;
  }

  eject(id: number): void {
    if (this.handlers[id]) this.handlers[id] = null;
  }

  clear(): void {
    this.handlers = [];
  }

  forEach(fn: (handler: Handler<V, R>) => void): void {
    this.handlers.forEach((h) => {
      if (h !== null) fn(h);
    });
  }
}
