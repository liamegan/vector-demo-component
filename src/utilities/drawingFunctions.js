
// Utility: convert world (cartesian) to screen pixels with origin at center
import {Vec2} from "wtc-math";

export function makeWorldToScreen(dims, unit, offsetPx = new Vec2(0,0)) {
  const c = dims.scaleNew(.5).add(offsetPx);
  return (v) => c.addNew(v.multiplyNew(new Vec2(1,-1)).scaleNew(unit));
}

export function screenToWorld(dims, unit, px) {
  const c = dims.scaleNew(.5);
  return px.subtractNew(c).multiply(new Vec2(1,-1)).scaleNew(1/unit)
};

export function drawGrid(ctx, dims, unit, { gridColor, axesColor, bg, axisLineWidth = 2, gridLineWidth = 1 }) {
  // Background
  if (bg) {
    ctx.save();
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, dims.x, dims.y);
    ctx.restore();
  } else {
    ctx.clearRect(0, 0, dims.x, dims.y);
  }

  const toScreen = makeWorldToScreen(dims, unit);
  const halfWidthUnits = dims.x / (2 * unit);
  const halfHeightUnits = dims.y / (2 * unit);

  ctx.save();
  ctx.lineWidth = gridLineWidth;
  ctx.strokeStyle = gridColor;

  // Vertical grid lines (x = k)
  for (let k = Math.ceil(-halfWidthUnits); k <= Math.floor(halfWidthUnits); k++) {
    const p1 = toScreen(new Vec2(k, -halfHeightUnits));
    const p2 = toScreen(new Vec2(k, +halfHeightUnits));
    ctx.beginPath();
    ctx.moveTo(Math.round(p1.x) + 0.5, p1.y);
    ctx.lineTo(Math.round(p2.x) + 0.5, p2.y);
    ctx.stroke();
  }

  // Horizontal grid lines (y = k)
  for (let k = Math.ceil(-halfHeightUnits); k <= Math.floor(halfHeightUnits); k++) {
    const p1 = toScreen(new Vec2(-halfWidthUnits, k));
    const p2 = toScreen(new Vec2(+halfWidthUnits, k));
    ctx.beginPath();
    ctx.moveTo(p1.x, Math.round(p1.y) + 0.5);
    ctx.lineTo(p2.x, Math.round(p2.y) + 0.5);
    ctx.stroke();
  }

  // Axes
  ctx.lineWidth = axisLineWidth;
  ctx.strokeStyle = axesColor;

  // x-axis (y = 0)
  {
    const p1 = toScreen(new Vec2(-halfWidthUnits, 0));
    const p2 = toScreen(new Vec2(+halfWidthUnits, 0));
    ctx.beginPath();
    ctx.moveTo(p1.x, Math.round(p1.y) + 0.5);
    ctx.lineTo(p2.x, Math.round(p2.y) + 0.5);
    ctx.stroke();
  }
  // y-axis (x = 0)
  {
    const p1 = toScreen(new Vec2(0, -halfHeightUnits));
    const p2 = toScreen(new Vec2(0, +halfHeightUnits));
    ctx.beginPath();
    ctx.moveTo(Math.round(p1.x) + 0.5, p1.y);
    ctx.lineTo(Math.round(p2.x) + 0.5, p2.y);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawArrow(ctx, fromPx, toPx, {
  color = "#333",
  lineWidth = 2,
  headSize = 8,
  headAngle = Math.PI / 7,
  interactive = false,
  bg = "#ffffff"
} = {}) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;

  // Shaft
  ctx.beginPath();
  ctx.moveTo(fromPx.x, fromPx.y);
  ctx.lineTo(toPx.x, toPx.y);
  ctx.stroke();

  // Arrow head
  const dx = toPx.x - fromPx.x;
  const dy = toPx.y - fromPx.y;
  const ang = Math.atan2(dy, dx);

  const left = {
    x: toPx.x - headSize * Math.cos(ang - headAngle),
    y: toPx.y - headSize * Math.sin(ang - headAngle)
  };
  const right = {
    x: toPx.x - headSize * Math.cos(ang + headAngle),
    y: toPx.y - headSize * Math.sin(ang + headAngle)
  };

  // Draw interactive handle behind arrowhead if enabled
  if (interactive) {
    ctx.beginPath();
    ctx.arc(toPx.x, toPx.y, 8, 0, Math.PI * 2);

    // Semi-transparent fill
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Stroke with background color
    ctx.strokeStyle = bg;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(toPx.x, toPx.y);
  ctx.lineTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  ctx.restore();
}


export function pickColor(properties, fallback = "#333") {
  if (!properties) return fallback;
  if (typeof properties.color === "string") return properties.color;
  if (typeof properties.colour === "string") return properties.colour;

  // Any hex-like string in properties
  for (const v of Object.values(properties)) {
    if (typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) {
      return v;
    }
  }
  return fallback;
}