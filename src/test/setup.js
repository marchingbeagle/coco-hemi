import "@testing-library/jest-dom/vitest";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = globalThis.ResizeObserver || ResizeObserverMock;

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value() {
    return {
      clearRect() {},
      drawImage() {},
      getImageData() {
        return new ImageData(1, 1);
      },
      putImageData() {},
      save() {},
      restore() {},
      scale() {},
      translate() {},
    };
  },
});
