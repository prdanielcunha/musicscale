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
    i18n: { language: "pt-BR" },
  }),
}));

import { HomeFocusCard } from "../../components/dashboard/HomeFocusCard";

describe("HomeFocusCard repertoire completeness", () => {
  it("shows all resolved songs, total count, and does not silently truncate at three", () => {
    const songs = Array.from({ length: 5 }, (_, index) => ({
      id: `song-${index + 1}`,
      title: `Música ${index + 1}`,
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
            songCount: 5,
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
      expect(screen.getByText(`Música ${index}`)).toBeInTheDocument();
    }

    expect(
      screen.getByLabelText("Repertório • 5 músicas"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\+ 2 músicas adicionais/)).not.toBeInTheDocument();
  });

  it("prefers canonical key over stale legacy selectedKey in the card", () => {
    render(
      <HomeFocusCard
        experience={{
          mode: "assigned-event",
          event: {
            id: "scale-key",
            type: "music",
            title: "Culto",
            date: "2099-12-31",
            songCount: 1,
            teamCount: 1,
            status: "published",
            userFunctionNames: [],
            isUserAssigned: true,
            songs: [
              {
                id: "song-key",
                title: "Canção com tom editado",
                order: 1,
                key: "D",
                selectedKey: "C",
                originalKey: "C",
              },
            ],
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

    expect(screen.getByText("D")).toBeInTheDocument();
    expect(screen.queryByText("C")).not.toBeInTheDocument();
  });

  it("explicitly indicates songs that exist by ID but are not yet enriched", () => {
    const songs = [
      { id: "song-1", title: "Música 1", order: 1, key: "C" },
      { id: "song-2", title: "Música 2", order: 2, key: "D" },
      { id: "song-3", title: "Música 3", order: 3, key: "E" },
    ];

    render(
      <HomeFocusCard
        experience={{
          mode: "assigned-event",
          event: {
            id: "scale-2",
            type: "music",
            title: "Culto",
            date: "2099-12-31",
            songCount: 5,
            teamCount: 1,
            status: "published",
            userFunctionNames: [],
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

    expect(screen.getByText(/\+ 2 músicas adicionais na escala/)).toBeInTheDocument();
  });
});
