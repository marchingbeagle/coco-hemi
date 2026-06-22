import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const generateContent = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(function GoogleGenAI() {
    return {
      models: {
        generateContent,
      },
    };
  }),
}));

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/gemini-image", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("gemini image route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    generateContent.mockReset();
  });

  it("rejects requests without a server API key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");

    const response = await POST(makeRequest({ prompt: "test", imageDataUrl: "data:image/png;base64,abc" }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("GEMINI_API_KEY");
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("validates prompt and image payload", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");

    const response = await POST(makeRequest({ prompt: "test" }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("prompt e imagem");
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("returns the generated image data", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    generateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/webp", data: "generated" } }] } }],
    });

    const response = await POST(makeRequest({ prompt: "test", imageDataUrl: "data:image/png;base64,input" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ data: "generated", mimeType: "image/webp" });
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-2.5-flash-image",
      }),
    );
  });

  it("normalizes Gemini responses without image data", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    generateContent.mockResolvedValue({ candidates: [{ content: { parts: [{ text: "no image" }] } }] });

    const response = await POST(makeRequest({ prompt: "test", imageDataUrl: "data:image/png;base64,input" }));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toContain("nao trouxe uma imagem");
  });
});
