export const MEDIAPIPE_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
export const SELFIE_SEGMENTER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";
export const PREVIEW_MAX_WIDTH = 920;
export const EXPORT_MAX_WIDTH = 1920;
export const THUMB_WIDTH = 210;
export const AI_HISTORY_DB = "coco-hemi-ai-results";
export const AI_HISTORY_STORE = "images";
export const AI_HISTORY_LIMIT = 12;
export const SECTION_STORAGE_KEY = "coco-hemi-collapsed-sections";
export const PANEL_ORDER_STORAGE_KEY = "coco-hemi-sidebar-panel-order";
export const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
export const AI_PROMPT_GUARDRAILS = `Quality & Realism: Maintain realistic skin texture, facial details, and natural imperfections. No plastic skin or over-smoothing. Preserve sharpness and depth of field.

Do NOT change the subject's face, body, or expression.
Do NOT alter the pose, camera angle, framing, or crop.
Do NOT modify the outfit or accessories.
Do NOT change the background composition or content unless the selected filter explicitly requires cleanup, relighting, or a Polaroid frame treatment.
Do NOT change the aspect ratio.`;

