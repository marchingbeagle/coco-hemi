import { THUMB_WIDTH } from "../config/constants";
import { presets } from "../data/editor-presets";
import { makeSourceImageData } from "./editor-canvas";
import { applyImageFilter, mergeFilter } from "./image-processing";
import { copyImageData, resampleMask } from "./masks";

export function buildFilterThumbnailUrls(image, ratio, combinedMask, adjustments, intensity) {
  const source = makeSourceImageData(image, ratio, THUMB_WIDTH);
  const thumbMask = combinedMask
    ? resampleMask(combinedMask, source.imageData.width, source.imageData.height)
    : null;
  const canvas = source.canvas;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const urls = {};

  for (const preset of presets) {
    const pixels = copyImageData(source.imageData);
    ctx.putImageData(
      applyImageFilter(pixels, mergeFilter(preset.filter, adjustments, intensity), thumbMask),
      0,
      0,
    );
    urls[preset.id] = canvas.toDataURL("image/jpeg", 0.72);
  }

  return urls;
}
