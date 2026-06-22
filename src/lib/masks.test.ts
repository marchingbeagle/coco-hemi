import { describe, expect, it } from "vitest";
import { combineMasks, makeMask, resampleMask } from "./masks";

describe("masks", () => {
  it("creates a mask with optional fill", () => {
    const mask = makeMask(2, 2, 128);

    expect(mask.width).toBe(2);
    expect(mask.height).toBe(2);
    expect([...mask.data]).toEqual([128, 128, 128, 128]);
  });

  it("combines automatic and manual masks using the strongest value", () => {
    const autoMask = makeMask(2, 1);
    const manualMask = makeMask(2, 1);
    autoMask.data.set([50, 200]);
    manualMask.data.set([180, 20]);

    expect([...(combineMasks(autoMask, manualMask)?.data || [])]).toEqual([180, 200]);
  });

  it("resamples masks to the target dimensions", () => {
    const source = makeMask(2, 2);
    source.data.set([0, 64, 128, 255]);

    const result = resampleMask(source, 1, 1);

    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(result.data[0]).toBe(0);
  });
});
