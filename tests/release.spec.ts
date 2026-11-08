/**
 * 版本治理脚本用例。
 * 只覆盖纯函数与只读路径；写文件一律走 --dry-run，避免测试污染工作区。
 */
import { describe, expect, it } from "vitest";

interface PackageInfo {
  name: string;
  version: string;
  file: string;
}

interface ReleaseApi {
  discoverPackages: (dir?: string) => PackageInfo[];
  assertAligned: (packages: Array<{ name: string; version: string }>) => {
    ok: boolean;
    version: string;
    mismatches: Array<{ name: string; version: string }>;
  };
  compareVersions: (a: string, b: string) => number;
  bumpVersion: (current: string, kind: string) => string;
  replaceVersionInText: (text: string, version: string) => string;
  writeVersions: (
    packages: PackageInfo[],
    version: string,
    options?: { dryRun?: boolean },
  ) => Array<{ name: string; file: string }>;
  publishPlan: (version: string) => string[];
}

const release = (await import("../scripts/release.mjs")) as unknown as ReleaseApi;

const sample = (name: string, version: string) => ({ name, version });

describe("可发布包发现与版本一致性", () => {
  it("发现 3 个可发布包，且不含私有应用", () => {
    const packages = release.discoverPackages();
    expect(packages.map((pkg) => pkg.name)).toEqual([
      "@x-ac/design-core",
      "@x-ac/design-react",
      "@x-ac/design-vue",
    ]);
    expect(packages.every((pkg) => pkg.version === "0.4.0")).toBe(true);
  });

  it("全部同版本时判定对齐", () => {
    const result = release.assertAligned([sample("a", "0.3.0"), sample("b", "0.3.0")]);
    expect(result).toEqual({ ok: true, version: "0.3.0", mismatches: [] });
  });

  it("任一包版本不同就报出完整差异清单", () => {
    const result = release.assertAligned([sample("a", "0.3.0"), sample("b", "0.4.0"), sample("c", "0.5.0")]);
    expect(result.ok).toBe(false);
    expect(result.mismatches.map((item) => item.name)).toEqual(["b", "c"]);
  });

  it("空清单视为未对齐，不允许误判为通过", () => {
    expect(release.assertAligned([]).ok).toBe(false);
  });
});

describe("版本递增", () => {
  it("patch / minor / major", () => {
    expect(release.bumpVersion("0.3.0", "patch")).toBe("0.3.1");
    expect(release.bumpVersion("0.3.4", "minor")).toBe("0.4.0");
    expect(release.bumpVersion("0.9.9", "major")).toBe("1.0.0");
  });

  it("显式版本与预发布版本", () => {
    expect(release.bumpVersion("0.3.0", "0.4.0")).toBe("0.4.0");
    expect(release.bumpVersion("0.3.0", "0.4.0-beta.1")).toBe("0.4.0-beta.1");
  });

  it("拒绝降级与非法参数", () => {
    expect(() => release.bumpVersion("0.4.0", "0.3.0")).toThrow(/降级/);
    expect(() => release.bumpVersion("0.3.0", "next")).toThrow(/无法识别/);
  });

  it("版本比较用于阻止误降级", () => {
    expect(release.compareVersions("0.4.0", "0.3.9")).toBeGreaterThan(0);
    expect(release.compareVersions("1.0.0", "0.99.99")).toBeGreaterThan(0);
    expect(release.compareVersions("0.3.0", "0.3.0")).toBe(0);
    expect(release.compareVersions("0.3.0-beta", "0.3.0")).toBeLessThan(0);
  });
});

describe("改写 package.json", () => {
  it("只改第一个 version，保留其余字段、缩进与结尾换行", () => {
    const text = '{\n  "name": "@x-ac/demo",\n  "version": "0.3.0",\n  "private": true\n}\n';
    expect(release.replaceVersionInText(text, "0.4.0")).toBe(
      '{\n  "name": "@x-ac/demo",\n  "version": "0.4.0",\n  "private": true\n}\n',
    );
  });

  it("找不到 version 字段时明确报错", () => {
    expect(() => release.replaceVersionInText('{ "name": "x" }', "0.4.0")).toThrow(/version/);
  });

  it("dry-run 不写文件，只返回将要修改的包", () => {
    const packages = release.discoverPackages();
    const changed = release.writeVersions(packages, "0.9.9", { dryRun: true });
    expect(changed).toHaveLength(3);
    expect(release.assertAligned(release.discoverPackages()).version).toBe("0.4.0");
  });
});

describe("发布计划", () => {
  it("包含 workspace 过滤、public 权限与 tag 提示（脚本本身不建 tag）", () => {
    const plan = release.publishPlan("0.4.0");
    expect(plan[0]).toContain('--filter "./packages/*"');
    expect(plan[0]).toContain("--access public");
    expect(plan[1]).toContain("v0.4.0");
  });
});
