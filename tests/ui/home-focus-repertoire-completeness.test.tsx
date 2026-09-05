import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string, options?: Record<string, unknown>) => {
      if (!fallback) return _key;
      return Object.entries(options || {}).reduce(
        (value, [key, replacement]) =>
          value.replaceAll(`{{${key}}}`, String(replacement)),
        fallback,
      );
    },
  }),
}));

import { HomeFocusCard } from "../../components/dashboard/HomeFocusCard";

describe("HomeFocusCard repertoire completeness", () => {
  it("shows every song in the next scale and exposes the total", () => {
    const songs = Array.from({ length: 5 }, (_, index) => ({
      id: `song-${index + 1}`,
      title: `Song ${index + 1}`,
      order: index + 1,
      key: "C",
    }));

    render(
      <HomeFocusCard
        experience={{
          mode: "assigned-event",
          event: {
            id: "scale-1",
            type: "music",
            title: "Santa Ceia",
            date: "2099-12-31",
            time: "09:30",
            locationName: "Industrial",
            songCount: songs.length,
            teamCount: 1,
            status: "published",
            userFunctionNames: ["Teclado"],
            isUserAssigned: true,
            songs,
          },
          draftEvent: null,
          attentionItems: [],
          canManageScales: false,
          isUserAssigned: true,
        }}
        canUsePerformance={true}
        onOpenEvent={vi.fn()}
        onOpenPerformance={vi.fn()}
        onCreateScale={vi.fn()}
        onChooseScaleToRepeat={vi.fn()}
      />,
    );

    for (let index = 1; index <= 5; index += 1) {
      expect(screen.getByText(`Song ${index}`)).toBeInTheDocument();
    }

    expect(
      screen.getByLabelText("5 músicas no repertório"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\+ 2 músicas/)).not.toBeInTheDocument();
  });
});
