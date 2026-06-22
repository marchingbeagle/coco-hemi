import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(),
}));

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: {
    forVisionTasks: vi.fn(),
  },
  ImageSegmenter: {
    createFromOptions: vi.fn(),
  },
}));

describe("App", () => {
  it("renders the editor shell instead of a blank screen", async () => {
    render(<App />);

    expect(await screen.findByText("Coco Hemi")).toBeInTheDocument();
    expect(screen.getByText("Enviar foto")).toBeInTheDocument();
    expect(screen.getByText("Tipo de filtro")).toBeInTheDocument();
  });
});
