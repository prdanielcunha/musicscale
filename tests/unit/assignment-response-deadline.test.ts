import { describe, expect, it } from "vitest";
import {
  getMusicScaleResponseDeadline,
  isMusicScaleResponseDeadlinePassed,
} from "../../utils/responseDeadline";

describe("MusicScale response deadline", () => {
  const eventStart = new Date(2026, 8, 6, 19, 0, 0, 0);

  it("allows a member to respond 6 minutes before the event", () => {
    expect(
      isMusicScaleResponseDeadlinePassed(
        eventStart,
        eventStart.getTime() - 6 * 60 * 1000,
      ),
    ).toBe(false);
  });

  it("closes responses exactly 5 minutes before the event", () => {
    const deadline = getMusicScaleResponseDeadline(eventStart);
    expect(deadline?.getTime()).toBe(eventStart.getTime() - 5 * 60 * 1000);
    expect(
      isMusicScaleResponseDeadlinePassed(
        eventStart,
        eventStart.getTime() - 5 * 60 * 1000,
      ),
    ).toBe(true);
  });

  it("does not invent a cutoff when the event start is unknown", () => {
    expect(isMusicScaleResponseDeadlinePassed(undefined)).toBe(false);
  });
