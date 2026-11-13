/**
 * 数据调控中心（core 内置，框架无关）。
 *
 * 位于 request 传输层之上，负责：数据源绑定描述（DataBinding）、provider 注册表、
 * 参数 {{}} 绑定解析、并发去重 + 页面级缓存、响应形态归一化（选项 label/value 或自由对象）。
 *
 * 主要入口：
 * - getDefaultRequest / setDefaultRequest：可替换的默认请求实例；
 * - registerProvider / getProvider：命名 provider（不同请求实例 / 缓存策略）；
 * - loadData(binding, ctx)：最常用的一行取数入口。
 */
export * from "./types";
export * from "./normalize";
export * from "./resolve";
export * from "./registry";
