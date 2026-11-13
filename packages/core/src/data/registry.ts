import { request as builtinDefault, type RequestInstance } from "../request";
import type { DataBinding, BindingContext, DataProvider, ProviderConfig } from "./types";
import { createProvider } from "./resolve";

/**
 * 数据调控中心的注册表。
 *
 * 职责：
 * 1. 维护「可替换的默认请求实例」——宿主可在启动时注入一个已配置好 baseURL /
 *    鉴权拦截器的实例，全站取数统一走它（对应 rg4KCt「外部数据源」的统一能力）；
 * 2. 维护「命名 provider 注册表」——不同数据源可用不同请求实例 / 缓存策略，
 *    缺省 'default' 绑定默认请求实例。
 */

let _defaultRequest: RequestInstance = builtinDefault;

const configs = new Map<string, ProviderConfig>();
configs.set("default", { request: _defaultRequest });

const providerInstances = new Map<string, DataProvider>();

/* ----------------------------- 默认请求实例 ----------------------------- */

export function getDefaultRequest(): RequestInstance {
  return _defaultRequest;
}

/**
 * 替换 core 默认请求实例。
 * 调用后，'default' provider 与后续新建的 provider（未显式传 request）都会改用新实例。
 */
export function setDefaultRequest(client: RequestInstance): void {
  _defaultRequest = client;
  const prev = configs.get("default");
  configs.set("default", { request: client, cache: prev?.cache });
  // 已缓存的 default provider 失效，下次 getProvider 重建以绑定新实例
  providerInstances.delete("default");
}

/* ----------------------------- 命名 provider ----------------------------- */

export function registerProvider(
  name: string,
  opts: { request?: RequestInstance; cache?: ProviderConfig["cache"] } = {},
): void {
  configs.set(name, {
    request: opts.request ?? _defaultRequest,
    cache: opts.cache,
  });
  // 覆盖既有实例缓存，使其立即生效
  providerInstances.delete(name);
}

export function getProviderConfig(name = "default"): ProviderConfig {
  return configs.get(name) ?? configs.get("default")!;
}

/** 取（或惰性创建）一个 provider；provider 维度独立维护缓存 */
export function getProvider(name = "default"): DataProvider {
  const existing = providerInstances.get(name);
  if (existing) return existing;
  const provider = createProvider(getProviderConfig(name));
  providerInstances.set(name, provider);
  return provider;
}

/** 便捷方法：用默认 provider 直接加载一次（最常用入口） */
export function loadData(
  binding: DataBinding,
  ctx: BindingContext,
  providerName = "default",
): Promise<unknown> {
  return getProvider(providerName).load(binding, ctx);
}
