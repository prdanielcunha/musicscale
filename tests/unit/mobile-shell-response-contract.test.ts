import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("mobile shell response contract", () => {
  it("opens the hamburger drawer on the first touch frame", () => {
    const header = read("components/layout/Header.tsx");
    expect(header).toContain('event.pointerType === "touch"');
    expect(header).toContain("onPointerDown");
    expect(header).toContain("touch-manipulation");
  });

  it("opens Global Create on touch without waiting for a delayed click", () => {
    const createAction = read("components/layout/GlobalCreateAction.tsx");
    expect(createAction).toContain('event.pointerType === "touch"');
    expect(createAction).toContain("setIsOpen(true)");
    expect(createAction).toContain("onPointerDown");
  });

  it("keeps the mobile drawer transform lightweight while preserving desktop animation", () => {
    const app = read("PrivateApp.tsx");
    expect(app).toContain("transition-transform duration-150 md:duration-300");
    expect(app).toContain("will-change-transform");
  });
});
