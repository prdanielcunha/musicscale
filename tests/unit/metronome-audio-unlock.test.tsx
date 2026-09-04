import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

import Metronome from "../../components/common/Metronome";

type ResumeController = {
  resolve?: () => void;
  reject?: (error: Error) => void;
};

describe("Metronome Web Audio unlock", () => {
  const originalAudioContext = (window as any).AudioContext;
  const originalWebkitAudioContext = (window as any).webkitAudioContext;

  let resumeController: ResumeController;
  let resumeMock: ReturnType<typeof vi.fn>;
  let oscillatorStartMock: ReturnType<typeof vi.fn>;
  let closeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resumeController = {};
    oscillatorStartMock = vi.fn();
    closeMock = vi.fn(async () => undefined);

    class FakeAudioContext {
      state: "suspended" | "running" | "closed" = "suspended";
      currentTime = 1;
      destination = {};

      constructor() {
        resumeMock = vi.fn(
          () =>
            new Promise<void>((resolve, reject) => {
              resumeController.resolve = () => {
                this.state = "running";
                resolve();
              };
              resumeController.reject = reject;
            }),
        );
      }

      resume = () => resumeMock();
      close = closeMock;

      createBuffer() {
        return {};
      }

      createBufferSource() {
        return {
          buffer: null,
          connect: vi.fn(),
          start: vi.fn(),
        };
      }

      createGain() {
        return {
          gain: {
            value: 0,
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        };
      }

      createOscillator() {
        return {
          frequency: {
            setValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          start: oscillatorStartMock,
          stop: vi.fn(),
        };
      }
    }

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });
    Object.defineProperty(window, "webkitAudioContext", {
      configurable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: originalAudioContext,
    });
    Object.defineProperty(window, "webkitAudioContext", {
      configurable: true,
      value: originalWebkitAudioContext,
    });
    vi.restoreAllMocks();
  });

  it("waits for AudioContext.resume before reporting playback and scheduling audible clicks", async () => {
    render(<Metronome initialBpm={72} />);

    const playButton = screen.getByRole("button", {
      name: "Iniciar metrônomo",
    });
    fireEvent.click(playButton);

    expect(resumeMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Iniciar metrônomo" }),
    ).toBeInTheDocument();
    expect(oscillatorStartMock).not.toHaveBeenCalled();

    await act(async () => {
      resumeController.resolve?.();
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Parar metrônomo" }),
      ).toBeInTheDocument();
    });
    expect(oscillatorStartMock).toHaveBeenCalled();
  });

  it("fails visibly instead of pretending to play when the browser rejects audio unlock", async () => {
    render(<Metronome initialBpm={72} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Iniciar metrônomo" }),
    );

    await act(async () => {
      resumeController.reject?.(new Error("NotAllowedError"));
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          "O áudio não foi liberado pelo navegador. Toque em Play novamente.",
        ),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Iniciar metrônomo" }),
    ).toBeInTheDocument();
    expect(oscillatorStartMock).not.toHaveBeenCalled();
  });
});
