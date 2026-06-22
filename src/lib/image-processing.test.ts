import { describe, expect, it } from "vitest";
import { applyImageFilter, getWheelZoom, mergeFilter } from "./image-processing";
import { defaultAdjustments, presets } from "../data/editor-presets";

describe("image processing", () => {
  it("merges preset strength with manual adjustments", () => {
    const filter = mergeFilter(presets[0].filter, { ...defaultAdjustments, brightness: 1.1, warmth: 5 }, 0.5);

    expect(filter.brightness).toBeGreaterThan(1);
    expect(filter.warmth).toBeCloseTo(presets[0].filter.warmth * 0.5 + 5);
    expect(filter.subjectAware).toBeCloseTo(presets[0].filter.subjectAware * 0.5);
  });

  it("keeps wheel zoom inside supported limits", () => {
    expect(getWheelZoom(1, 100)).toBe(1);
    expect(getWheelZoom(3, -100)).toBe(3);
    expect(getWheelZoom(1.5, -100)).toBe(1.62);
  });

  it("applies filters without changing image dimensions or alpha", () => {
    const imageData = new ImageData(new Uint8ClampedArray([100, 120, 140, 255]), 1, 1);
    const result = applyImageFilter(imageData, mergeFilter(presets[0].filter, defaultAdjustments, 1), null);

    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(result.data[3]).toBe(255);
  });
});
