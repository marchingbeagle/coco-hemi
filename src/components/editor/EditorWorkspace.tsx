import React from "react";
import { ImagePlus, Wand2 } from "lucide-react";
import { getAutoMaskLabel, getRecognitionStepMessage } from "../../lib/masks";
import { getCanvasBoardStyle, getStageWidth } from "../../lib/image-processing";
import { Button } from "../ui/button";

export function EditorWorkspace({
  loadState,
  errorMessage,
  isDragging,
  isPanningCanvas,
  isShowingOriginal,
  recognitionStepOpen,
  isAiMode,
  isPainting,
  autoMaskStatus,
  canvasSize,
  previewBox,
  zoom,
  scrollRef,
  photoCanvasRef,
  maskCanvasRef,
  fileInputRef,
  onDragOver,
  onDragLeave,
  onDrop,
  onStartCanvasPan,
  onBlockMiddleMousePan,
  onMoveCanvasPan,
  onStopCanvasPan,
  onStageCompareDown,
  onHideOriginal,
  onPointerDown,
  onPointerMove,
  onStopPainting,
  onRecalculateMask,
  onCompleteRecognitionStep,
}) {
  const stageWidth = canvasSize.width && canvasSize.height ? getStageWidth(canvasSize, previewBox, zoom) : 0;
  const stageHeight = stageWidth ? stageWidth * (canvasSize.height / canvasSize.width) : 0;
  const boardStyle = getCanvasBoardStyle(previewBox, stageWidth, stageHeight);

  const stageStyle =
    canvasSize.width && canvasSize.height
      ? {
          aspectRatio: `${canvasSize.width} / ${canvasSize.height}`,
          width: `${stageWidth}px`,
        }
      : undefined;

  return (
    <section className="workspace">
      <div
        className={isDragging ? "dropzone dragging" : "dropzone"}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {loadState === "ready" ? (
          <div
            className={isPanningCanvas ? "canvas-scroll panning" : "canvas-scroll"}
            ref={scrollRef}
            onPointerDownCapture={onStartCanvasPan}
            onPointerDown={onStartCanvasPan}
            onMouseDownCapture={onBlockMiddleMousePan}
            onPointerMove={onMoveCanvasPan}
            onPointerUp={onStopCanvasPan}
            onPointerCancel={onStopCanvasPan}
            onPointerLeave={onStopCanvasPan}
            onAuxClick={(event) => event.preventDefault()}
          >
            <div className="canvas-board" style={boardStyle}>
              <div
                className={`${isShowingOriginal ? "canvas-stage comparing" : "canvas-stage"} ${
                  recognitionStepOpen ? "recognition-active" : ""
                }`}
                style={stageStyle}
                onPointerDownCapture={onStageCompareDown}
                onPointerUp={onHideOriginal}
                onPointerLeave={onHideOriginal}
                onPointerCancel={onHideOriginal}
                onBlur={onHideOriginal}
                tabIndex={0}
                aria-label="Preview da foto. Pressione para comparar com a original."
              >
                <canvas ref={photoCanvasRef} className="photo-canvas" aria-label="Foto com filtro" />
                <canvas
                  ref={maskCanvasRef}
                  className={`${isPainting ? "mask-canvas painting" : "mask-canvas"} ${
                    isAiMode || recognitionStepOpen ? "disabled" : ""
                  }`}
                  aria-label="Pintar objeto principal"
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onStopPainting}
                  onPointerCancel={onStopPainting}
                  onPointerLeave={onStopPainting}
                />
                {recognitionStepOpen ? (
                  <div className="recognition-modal" role="dialog" aria-modal="true" aria-labelledby="recognition-title">
                    <div className="recognition-icon">
                      <Wand2 size={20} />
                    </div>
                    <div>
                      <h2 id="recognition-title">Reconhecimento da imagem</h2>
                      <p>{getRecognitionStepMessage(autoMaskStatus)}</p>
                    </div>
                    <div className="recognition-status">
                      <strong>{getAutoMaskLabel(autoMaskStatus)}</strong>
                      <span>
                        {autoMaskStatus === "loading" ? "Analisando pessoa e assunto" : "Mascara pronta para revisar"}
                      </span>
                    </div>
                    <div className="recognition-actions">
                      <Button
                        className="ghost-button"
                        variant="ghost"
                        type="button"
                        onClick={onRecalculateMask}
                        disabled={autoMaskStatus === "loading"}
                      >
                        Recalcular
                      </Button>
                      <Button
                        className="primary-button"
                        type="button"
                        onClick={onCompleteRecognitionStep}
                        disabled={autoMaskStatus === "loading"}
                      >
                        Proximo
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <ImagePlus size={42} />
            <h2>{loadState === "loading" ? "Carregando imagem..." : "Arraste uma foto aqui"}</h2>
            <p>
              {errorMessage || "Envie uma foto, deixe a IA reconhecer o assunto e refine a mascara com o pincel."}
            </p>
            <button className="primary-button" onClick={() => fileInputRef.current?.click()}>
              Selecionar imagem
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
