export type Adjustments = {
  exposure: number;
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  highlights: number;
  shadows: number;
  sharpness: number;
  grain: number;
  vignette: number;
  fade: number;
};

export type RatioPreset = {
  id: string;
  name: string;
  width: number | null;
  height: number | null;
};

export type FilterPreset = {
  id: string;
  name: string;
  label: string;
  filter: Record<string, unknown>;
};

export type AiPreset = {
  id: string;
  name: string;
  label: string;
  prompt: string;
};

export type AiHistoryItem = {
  id: string;
  dataUrl: string;
  imageName: string;
  presetId: string;
  presetName: string;
  prompt: string;
  createdAt: number;
};

