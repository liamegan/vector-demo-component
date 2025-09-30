import { useEffect, useMemo, useRef, useCallback, useState } from "preact/hooks";
import { Vec2 } from "wtc-math";
import { Canvas } from "./Canvas";
import { InstructionRunner } from "../utilities/InstructionRunner";

// Utility: convert world (cartesian) to screen pixels with origin at center
function makeWorldToScreen(dims, unit, offsetPx = new Vec2(0,0)) {
  const c = dims.scaleNew(.5).add(offsetPx);
  return (v) => c.addNew(v.multiplyNew(new Vec2(1,-1)).scaleNew(unit));
}

function drawGrid(ctx, dims, unit, { gridColor, axesColor, bg, axisLineWidth = 2, gridLineWidth = 1 }) {
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

function drawArrow(ctx, fromPx, toPx, {
  color = "#333",
  lineWidth = 2,
  headSize = 8,
  headAngle = Math.PI / 7
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

  ctx.beginPath();
  ctx.moveTo(toPx.x, toPx.y);
  ctx.lineTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}


function pickColor(properties, fallback = "#333") {
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

export function VectorCanvas({
  commands,
  // Visual options
  unit = 40,                   // pixels per unit
  bg = "#ffffff",
  gridColor = "#e5e7eb",       // light grid
  axesColor = "#9ca3af",       // slightly darker axes
  vectorDefaultColor = "#111827",
  showLabels = true,
  labelFont = "12px system-ui",
  // Arrow options
  arrowHeadSize = 8,
  arrowLineWidth = 2,
  debugging = false,
  // Interaction options
  enableInteraction = true,    // master switch for interaction
}) {
  const canvasRef = useRef(null);
  // Track dragging state
  const [dragInfo, setDragInfo] = useState(null);

  // Parse instructions when commands change
  const runner = useMemo(() => {
    try {
      if(debugging) console.log(InstructionRunner.parse({ commands: commands ?? "" }))
      return InstructionRunner.parse({ commands: commands ?? "" });
    } catch (e) {
      console.error("Instruction parse error:", e);
      return null;
    }
  }, [commands]);

  // Create a stable draw callback that renders grid + vectors
  const draw = useCallback((ctx, dims) => {
    if (!dims || dims.x <= 0 || dims.y <= 0) return;

    // Grid and axes
    drawGrid(ctx, dims, unit, { gridColor, axesColor, bg });

    // Prepare transform
    const toScreen = makeWorldToScreen(dims, unit);

    // Draw vectors from runner
    if (runner && runner.variables) {
      for (const [name, entry] of Object.entries(runner.variables)) {
        if (!entry || !entry.value) continue;

        const vec = entry.value;

        const properties = entry.properties ?? {};
        const color = pickColor(properties, vectorDefaultColor);

        // Origin in world units, defaults to (0,0)
        const origin = properties?.origin ?? new Vec2(0, 0);

        const startWorld = origin.clone();
        const endWorld = origin.addNew(vec);

        const startPx = toScreen(startWorld);
        const endPx = toScreen(endWorld);
        const midPx = startPx.addNew(
          endPx.subtractNew(startPx).scaleNew(.5)
        )

        drawArrow(ctx, startPx, endPx, {
          color,
          lineWidth: arrowLineWidth,
          headSize: arrowHeadSize
        });

        // Optional label
        if (showLabels && name) {
          ctx.save();

          ctx.strokeStyle = bg;
          ctx.lineWidth = 4;
          ctx.font = labelFont;
          ctx.fillStyle = color;
          ctx.textBaseline = "middle";
          ctx.textAlign = "center";
          ctx.strokeText(String(name), ...midPx);
          ctx.fillText(String(name), ...midPx);

          ctx.restore();
        }

        // dot at the origin point of the vector
        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(...startPx, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Visual feedback for interactive vectors
        if (properties.interactive) {
          // Highlight the endpoint/handle
          ctx.save();
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(endPx.x, endPx.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = bg;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }, [runner, unit, bg, gridColor, axesColor, vectorDefaultColor, showLabels, labelFont, arrowHeadSize, arrowLineWidth]);

  // Mouse event handlers for interactive vectors
  const handleMouseDown = useCallback((e) => {
    if (!enableInteraction || !runner) return;

    const canvas = canvasRef.current?.getContext()?.canvas;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    // Use the actual dimensions of the canvas context
    const dims = canvasRef.current?.getDimensions() || { x: canvas.clientWidth, y: canvas.clientHeight };

    // Convert mouse position to world coordinates
    const toScreen = makeWorldToScreen(dims, unit);
    const screenToWorld = (px) => {
      const cx = dims.x / 2;
      const cy = dims.y / 2;
      return new Vec2((px.x - cx) / unit, -(px.y - cy) / unit);
    };

    const mousePx = { x: mouseX, y: mouseY };
    const mouseWorld = screenToWorld(mousePx);

    // Check if we're near any interactive vector
    for (const [name, entry] of Object.entries(runner.variables)) {
      if (!entry || !entry.value || !entry.properties?.interactive) continue;

      const vec = entry.value;
      const origin = entry.properties?.origin ?? new Vec2(0, 0);
      const startWorld = origin instanceof Vec2 ? origin : new Vec2(origin.x, origin.y);
      const endWorld = new Vec2(startWorld.x + vec.x, startWorld.y + vec.y);

      const startPx = toScreen(startWorld);
      const endPx = toScreen(endWorld);

      // Check if mouse is near tip of vector
      const distToTip = Math.hypot(endPx.x - mouseX, endPx.y - mouseY);
      if (distToTip < 15) { // 15px radius for interaction
        setDragInfo({
          vectorName: name,
          origin: startWorld,
          originalValue: new Vec2(vec.x, vec.y),
          startMouse: mouseWorld
        });
        break;
      }
    }
  }, [runner, enableInteraction, unit]);

  const handleMouseMove = useCallback((e) => {
    if (!dragInfo || !runner) return;

    const canvas = canvasRef.current?.getContext()?.canvas;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    // Use the actual dimensions of the canvas context
    const dims = canvasRef.current?.getDimensions() || { x: canvas.clientWidth, y: canvas.clientHeight };

    // Convert to world coordinates
    const screenToWorld = (px) => {
      const cx = dims.x / 2;
      const cy = dims.y / 2;
      return new Vec2((px.x - cx) / unit, -(px.y - cy) / unit);
    };

    const mouseWorld = screenToWorld({ x: mouseX, y: mouseY });

    // Calculate new vector value based on mouse position
    const newValue = mouseWorld.subtractNew(dragInfo.origin);

    // Update vector value directly
    const vectorEntry = runner.variables[dragInfo.vectorName];
    if (vectorEntry && vectorEntry.value instanceof Vec2) {
      vectorEntry.value.x = newValue.x;
      vectorEntry.value.y = newValue.y;
      canvasRef.current?.redraw?.();
    }
  }, [dragInfo, runner, unit]);

  const handleMouseUp = useCallback(() => {
    if (dragInfo) {
      setDragInfo(null);
    }
  }, [dragInfo]);

  // Setup event listeners
  useEffect(() => {
    // We need to target the canvas element directly
    const canvasElement = canvasRef.current?.getContext()?.canvas;
    if (!canvasElement) return;

    canvasElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvasElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, canvasRef.current]);

  // Redraw when relevant inputs change
  useEffect(() => {
    canvasRef.current?.redraw?.();
  }, [draw, dragInfo]);

  const canvasStyle = useMemo(() => ({
    cursor: dragInfo ? 'grabbing' : 'default'
  }), [dragInfo]);

  return (
    <Canvas ref={canvasRef} draw={draw} style={canvasStyle} />
  );
}
