import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";
import { MEDIAPIPE_WASM_URL, SELFIE_SEGMENTER_MODEL_URL } from "../config/constants";
import { buildHeuristicMask, enhanceHairMask, extractMediaPipeMask } from "./masks";

let segmenterPromise = null;

export async function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
      return ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: SELFIE_SEGMENTER_MODEL_URL,
          delegate: "CPU",
        },
        runningMode: "IMAGE",
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
    })();
  }
  return segmenterPromise;
}

export async function applyMediaPipeMask(runId, source, fallbackMask, isStale) {
  const segmenter = await getSegmenter();
  if (isStale(runId)) return null;

  const result = segmenter.segment(source.canvas);
  const mediaPipeMask = extractMediaPipeMask(result, source.imageData.width, source.imageData.height);
  result.close?.();

  if (isStale(runId)) return null;

  return enhanceHairMask(mediaPipeMask || fallbackMask, source.imageData);
}

export function buildFallbackMask(source) {
  return enhanceHairMask(buildHeuristicMask(source.imageData), source.imageData);
}
