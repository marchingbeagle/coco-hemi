import { EXPORT_MAX_WIDTH, PREVIEW_MAX_WIDTH } from "../config/constants";
import { applyImageFilter } from "./image-processing";
import { copyImageData, resampleMask } from "./masks";

export function getRenderGeometry(image, ratio, maxWidth = PREVIEW_MAX_WIDTH) {
  const targetWidth = ratio.width || image.width;
  const targetHeight = ratio.height || image.height;
  const scale = Math.min(1, maxWidth / targetWidth);
  const width = Math.max(1, Math.round(targetWidth * scale));
  const height = Math.max(1, Math.round(targetHeight * scale));
  const targetRatio = targetWidth / targetHeight;
  const imageRatio = image.width / image.height;
  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;

  if (ratio.id !== "original") {
    if (imageRatio > targetRatio) {
      sw = image.height * targetRatio;
      sx = (image.width - sw) / 2;
    } else {
      sh = image.width / targetRatio;
      sy = (image.height - sh) / 2;
    }
  }

  return { width, height, sx, sy, sw, sh };
}

export function drawBaseImage(ctx, image, geometry) {
  ctx.clearRect(0, 0, geometry.width, geometry.height);
  ctx.drawImage(
    image,
    geometry.sx,
    geometry.sy,
    geometry.sw,
    geometry.sh,
    0,
    0,
    geometry.width,
    geometry.height,
  );
}

export function makeSourceImageData(image, ratio, maxWidth = PREVIEW_MAX_WIDTH) {
  const geometry = getRenderGeometry(image, ratio, maxWidth);
  const canvas = document.createElement("canvas");
  canvas.width = geometry.width;
  canvas.height = geometry.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  drawBaseImage(ctx, image, geometry);
  return { canvas, imageData: ctx.getImageData(0, 0, geometry.width, geometry.height), geometry };
}

export function renderOutputCanvas(image, filter, ratio, combinedMask, options: { useMask?: boolean } = {}) {
  const source = makeSourceImageData(image, ratio, EXPORT_MAX_WIDTH);
  const outputMask =
    options.useMask !== false && combinedMask
      ? resampleMask(combinedMask, source.imageData.width, source.imageData.height)
      : null;
  const pixels = copyImageData(source.imageData);
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = source.imageData.width;
  outputCanvas.height = source.imageData.height;
  const ctx = outputCanvas.getContext("2d");
  ctx.putImageData(applyImageFilter(pixels, filter, outputMask), 0, 0);
  return outputCanvas;
}

export function renderBaseOutputCanvas(image, ratio) {
  const source = makeSourceImageData(image, ratio, EXPORT_MAX_WIDTH);
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = source.imageData.width;
  outputCanvas.height = source.imageData.height;
  outputCanvas.getContext("2d").putImageData(source.imageData, 0, 0);
  return outputCanvas;
}
