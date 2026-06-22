import React from "react";
import { aiPresets, presets } from "../../data/editor-presets";

export function FilterSidebar({
  isAiMode,
  selectedPreset,
  setSelectedPreset,
  filterThumbs,
  selectedAiPreset,
  setSelectedAiPreset,
  setCustomAiPrompt,
  setAiError,
  setAiResultUrl,
}: {
  isAiMode: boolean;
  selectedPreset: (typeof presets)[number];
  setSelectedPreset: (preset: (typeof presets)[number]) => void;
  filterThumbs: Record<string, string>;
  selectedAiPreset: (typeof aiPresets)[number];
  setSelectedAiPreset: (preset: (typeof aiPresets)[number]) => void;
  setCustomAiPrompt: (prompt: string) => void;
  setAiError: (error: string) => void;
  setAiResultUrl: (url: string) => void;
}) {
  return (
    <aside className="filter-sidebar" aria-label="Selecao de filtros">
      <div className="workspace-filters">
        {!isAiMode ? (
          <section className="filter-section" aria-labelledby="normal-filters-title">
            <div className="section-heading">
              <h2 id="normal-filters-title">Filtros normais</h2>
              <span>Preview local</span>
            </div>
            <div className="filter-strip" aria-label="Filtros normais">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  className={preset.id === selectedPreset.id ? "filter-card active" : "filter-card"}
                  title={`${preset.name}: ${preset.label}`}
                  onClick={() => setSelectedPreset(preset)}
                >
                  <span className="filter-thumb">
                    {filterThumbs[preset.id] ? (
                      <img src={filterThumbs[preset.id]} alt="" />
                    ) : (
                      <span className={`filter-placeholder ${preset.id}`} />
                    )}
                  </span>
                  <strong>{preset.name}</strong>
                  <small>{preset.label}</small>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {isAiMode ? (
          <section className="filter-section ai-workspace-section" aria-labelledby="ai-filters-title">
            <div className="section-heading">
              <h2 id="ai-filters-title">Filtros com IA</h2>
              <span>Gemini</span>
            </div>
            <div className="ai-filter-strip" aria-label="Filtros com inteligencia artificial">
              {aiPresets.map((preset) => (
                <button
                  key={preset.id}
                  className={preset.id === selectedAiPreset.id ? "ai-filter-card active" : "ai-filter-card"}
                  onClick={() => {
                    setSelectedAiPreset(preset);
                    setCustomAiPrompt(preset.prompt);
                    setAiError("");
                    setAiResultUrl("");
                  }}
                >
                  <span className={`ai-filter-preview ${preset.id}`} />
                  <strong>{preset.name}</strong>
                  <small>{preset.label}</small>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
