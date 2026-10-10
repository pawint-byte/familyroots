export interface TreeBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Fit actual card bounds, allowing a small margin for focus rings and shadows. */
export function calculateTreeFit(width: number, height: number, bounds: TreeBounds) {
  const padding = 16;
  const bboxWidth = bounds.right - bounds.left;
  const bboxHeight = bounds.bottom - bounds.top;
  if (width <= padding * 2 || height <= padding * 2 || bboxWidth <= 0 || bboxHeight <= 0) return null;
  const zoom = Math.min((width - padding * 2) / bboxWidth, (height - padding * 2) / bboxHeight, 1);
  return {
    zoom,
    offset: {
      x: width / 2 - (bounds.left + bounds.right) / 2 * zoom,
      y: height / 2 - (bounds.top + bounds.bottom) / 2 * zoom,
    },
  };
}
