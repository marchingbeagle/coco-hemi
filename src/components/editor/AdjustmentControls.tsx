import React from "react";
import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Adjustments } from "../../types/editor";

type AdjustmentControlsProps = {
  values: Adjustments;
  onChange: Dispatch<SetStateAction<Adjustments>>;
};

type SliderRangeProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  liveUpdate?: boolean;
  formatValue?: (value: number) => React.ReactNode;
};

export function AdjustmentControls({ values, onChange }: AdjustmentControlsProps) {
  const update = (key: keyof Adjustments) => (value: number) => onChange((current) => ({ ...current, [key]: value }));
  const formatSignedPercent = (neutral = 0) => (value: number) => `${formatSignedNumber(Math.round((value - neutral) * 100))}%`;
  const formatSignedValue = (value: number) => formatSignedNumber(value);

  return (
    <>
      <SliderRange
        label="Exposicao"
        value={values.exposure}
        min={-0.7}
        max={0.7}
        step={0.01}
        onChange={update("exposure")}
        formatValue={formatSignedValue}
      />
      <SliderRange
        label="Brilho"
        value={values.brightness}
        min={0.62}
        max={1.38}
        step={0.01}
        onChange={update("brightness")}
        formatValue={formatSignedPercent(1)}
      />
      <SliderRange
        label="Contraste"
        value={values.contrast}
        min={0.58}
        max={1.42}
        step={0.01}
        onChange={update("contrast")}
        formatValue={formatSignedPercent(1)}
      />
      <SliderRange
        label="Saturacao"
        value={values.saturation}
        min={0.2}
        max={1.8}
        step={0.01}
        onChange={update("saturation")}
        formatValue={formatSignedPercent(1)}
      />
      <SliderRange
        label="Temperatura"
        value={values.warmth}
        min={-35}
        max={35}
        step={1}
        onChange={update("warmth")}
        formatValue={formatSignedValue}
      />
      <SliderRange
        label="Realces"
        value={values.highlights}
        min={-45}
        max={45}
        step={1}
        onChange={update("highlights")}
        formatValue={formatSignedValue}
      />
      <SliderRange
        label="Sombras"
        value={values.shadows}
        min={-45}
        max={45}
        step={1}
        onChange={update("shadows")}
        formatValue={formatSignedValue}
      />
      <SliderRange label="Nitidez" value={values.sharpness} min={0} max={70} step={1} onChange={update("sharpness")} />
      <SliderRange label="Granulacao" value={values.grain} min={0} max={36} step={1} onChange={update("grain")} />
      <SliderRange label="Vinheta" value={values.vignette} min={0} max={42} step={1} onChange={update("vignette")} />
      <SliderRange label="Fade" value={values.fade} min={0} max={38} step={1} onChange={update("fade")} />
    </>
  );
}

function formatSignedNumber(value: number) {
  if (Object.is(value, -0) || value === 0) return "0";
  return value > 0 ? `+${value}` : `${value}`;
}

export function SliderRange({ label, value, min, max, step, onChange, liveUpdate = false, formatValue = (nextValue) => nextValue }: SliderRangeProps) {
  const [draftValue, setDraftValue] = useState(value);
  const percent = ((draftValue - min) / (max - min)) * 100;
  const displayValue = formatValue(draftValue);
  const rangeStyle = { "--range-progress": `${percent}%` } as React.CSSProperties;

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  function commit(nextValue: number | string = draftValue) {
    const numericValue = Number(nextValue);
    if (Number.isNaN(numericValue) || numericValue === value) return;
    onChange(numericValue);
  }

  return (
    <label className="range-row">
      <span className="range-label">
        <span>{label}</span>
        <strong className="range-value">{displayValue}</strong>
      </span>
      <input
        type="range"
        value={draftValue}
        min={min}
        max={max}
        step={step}
        style={rangeStyle}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          setDraftValue(nextValue);
          if (liveUpdate) onChange(nextValue);
        }}
        onPointerUp={(event) => commit(event.currentTarget.value)}
        onTouchEnd={(event) => commit(event.currentTarget.value)}
        onMouseUp={(event) => commit(event.currentTarget.value)}
        onKeyUp={(event) => commit(event.currentTarget.value)}
        onBlur={(event) => commit(event.currentTarget.value)}
      />
    </label>
  );
}

