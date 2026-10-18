/** True when this device can draw the island: a canvas gives a WebGL2 context. Never throws. */
export function supportsWebGL2(createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas')): boolean {
  try {
    return createCanvas().getContext('webgl2') !== null;
  } catch {
    return false;
  }
}
