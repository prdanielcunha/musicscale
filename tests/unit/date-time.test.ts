import { describe, expect, it } from "vitest";
import {
  BRAZIL_TIME_ZONE,
  coerceDate,
  formatDateInBrazil,
  resolveDateLocale,
} from "../../utils/dateTime";

describe("dateTime", () => {
  it("formats Firestore Timestamp-like values using the Brazil timezone", () => {
    const timestamp = {
      toDate: () => new Date("2026-10-02T02:30:00.000Z"),
    };

    expect(formatDateInBrazil(timestamp, "pt-BR")).toBe(
      "1 de outubro de 2026",
    );
  });

  it("accepts serialized Firestore seconds without producing Invalid Date", () => {
    const timestamp = {
      seconds: Math.floor(Date.parse("2026-10-02T12:00:00.000Z") / 1000),
      nanoseconds: 0,
    };

    expect(formatDateInBrazil(timestamp, "pt-BR")).toBe(
      "2 de outubro de 2026",
    );
  });

  it("keeps date-only values on the intended Brazilian calendar day", () => {
    expect(formatDateInBrazil("2026-10-02", "pt-BR")).toBe(
      "2 de outubro de 2026",
    );
  });

  it("returns null for invalid or missing values instead of Invalid Date", () => {
    expect(coerceDate({ nope: true })).toBeNull();
    expect(formatDateInBrazil("not-a-date", "pt-BR")).toBeNull();
    expect(formatDateInBrazil(null, "pt-BR")).toBeNull();
  });

  it("uses the expected locale while preserving the Brazil timezone", () => {
    expect(BRAZIL_TIME_ZONE).toBe("America/Sao_Paulo");
    expect(resolveDateLocale("pt-BR")).toBe("pt-BR");
    expect(resolveDateLocale("en-US")).toBe("en-US");
    expect(resolveDateLocale("es")).toBe("es-ES");
  });
});
