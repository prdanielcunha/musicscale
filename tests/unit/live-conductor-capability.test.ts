import { describe, expect, it } from "vitest";
import {
  buildEffectiveAccessContext,
  hasMusicScaleCapability,
  resolveExplicitMusicScaleCapabilities,
} from "../../utils/rbac";

describe("explicit live conductor capability", () => {
  it("extracts only the supported explicit MusicScale capability", () => {
    expect(
      resolveExplicitMusicScaleCapabilities({
        permissions: {
          "musicscale.live.conduct": true,
          "musicscale.songs.edit": true,
          arbitrary: true,
        },
      }),
    ).toEqual(["musicscale.live.conduct"]);
  });

  it("lets a regular active member conduct without granting scale management", () => {
    const context = buildEffectiveAccessContext(
      "member-1",
      "org-1",
      "user",
      "member",
      "active",
      null,
      ["musicscale.live.conduct"],
    );

    expect(hasMusicScaleCapability(context, "musicscale.live.conduct")).toBe(true);
    expect(hasMusicScaleCapability(context, "scales.create")).toBe(false);
    expect(hasMusicScaleCapability(context, "scales.update")).toBe(false);
  });

  it("does not apply the explicit capability to an inactive membership", () => {
    const context = buildEffectiveAccessContext(
      "member-1",
      "org-1",
      "user",
      "member",
      "inactive",
      null,
      ["musicscale.live.conduct"],
    );

    expect(hasMusicScaleCapability(context, "musicscale.live.conduct")).toBe(false);
  });

  it("lets Hub manager/secretary roles resolve safely as base members", () => {
    for (const role of ["manager", "secretary"]) {
      const context = buildEffectiveAccessContext(
        `${role}-1`,
        "org-1",
        "user",
        role,
        "active",
        null,
        ["musicscale.live.conduct"],
      );
      expect(context.resolutionStatus).toBe("resolved");
      expect(hasMusicScaleCapability(context, "scales.read")).toBe(true);
      expect(hasMusicScaleCapability(context, "scales.update")).toBe(false);
      expect(hasMusicScaleCapability(context, "musicscale.live.conduct")).toBe(true);
    }
  });

  it("keeps leaders able to conduct through their existing role", () => {
    const context = buildEffectiveAccessContext(
      "leader-1",
      "org-1",
      "user",
      "leader",
      "active",
    );
    expect(hasMusicScaleCapability(context, "musicscale.live.conduct")).toBe(true);
    expect(hasMusicScaleCapability(context, "scales.update")).toBe(true);
  });
});
