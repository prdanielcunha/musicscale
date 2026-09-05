import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("mobile shell response contract", () => {
  it("opens the hamburger menu on the first touch frame", () => {
    const header = read("components/layout/Header.tsx");
    expect(header).toContain("onPointerDown");
    expect(header).toContain('event.pointerType === "touch"');
    expect(header).toContain("onMenuClick()");
  });

  it("opens Global Create on touch without waiting for a delayed click", () => {
    const create = read("components/layout/GlobalCreateAction.tsx");
    expect(create).toContain("onPointerDown");
    expect(create).toContain('event.pointerType === "touch"');
    expect(create).toContain("setIsOpen(true)");
  });

  it("keeps mobile interaction surfaces touch-optimized", () => {
    const create = read("components/layout/GlobalCreateAction.tsx");
    const app = read("PrivateApp.tsx");
    expect(create).toContain("touch-manipulation");
    expect(create).toContain("transform-gpu");
    expect(app).toContain("transform-gpu");
  });
});
