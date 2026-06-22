import { describe, expect, it } from "vitest";
import { buildAiPrompt, dataUrlToInlineData, getGeminiErrorMessage } from "./gemini";
import { aiPresets } from "../data/editor-presets";

describe("gemini helpers", () => {
  it("converts data URLs to Gemini inline data", () => {
    expect(dataUrlToInlineData("data:image/png;base64,abc123")).toEqual({
      mimeType: "image/png",
      data: "abc123",
    });
  });

  it("adds prompt guardrails once", () => {
    const prompt = buildAiPrompt(aiPresets[0], { prompt: "Improve the photo", caption: "", date: "" });

    expect(prompt).toContain("Improve the photo");
    expect(prompt.match(/Quality & Realism:/g)).toHaveLength(1);
    expect(buildAiPrompt(aiPresets[0], { prompt, caption: "", date: "" }).match(/Quality & Realism:/g)).toHaveLength(1);
  });

  it("maps common Gemini failures to clear user messages", () => {
    expect(getGeminiErrorMessage(new Error("RESOURCE_EXHAUSTED Please retry in 2.4s"))).toContain("cota");
    expect(getGeminiErrorMessage(new Error("API_KEY_INVALID"))).toContain("invalida");
  });
});
