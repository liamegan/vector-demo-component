import { useEffect, useMemo, useRef, useCallback, useState } from "preact/hooks";
import { Vec2 } from "wtc-math";

import { Canvas } from "./Canvas.jsx";

import { InstructionRunner } from "../utilities/InstructionRunner";
import { drawGrid, drawArrow, pickColor, makeWorldToScreen, screenToWorld } from "../utilities/drawingFunctions";


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
  snapToGrid = false,
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
          headSize: arrowHeadSize,
          interactive: properties.interactive,
          bg
        });

        // Display reference information if this is a reference vector
        if (properties.reference && vec._sourceOperation) {
          const { operator, operands } = vec._sourceOperation;

          // Find variable names for the operands
          const operandVars = [];
          for (const [varName, varEntry] of Object.entries(runner.variables)) {
            if (!varEntry || !varEntry.value) continue;
            if (operands.includes(varEntry.value)) {
              operandVars.push(varName);
            }
          }

          // Draw reference info if we found at least one operand variable name
          if (operandVars.length > 0) {
            ctx.save();

            // Map operators to display symbols
            const opSymbols = {
              '+': '+',
              '-': '-',
              '*': '×',
              '/': '÷'
            };
            const opSymbol = opSymbols[operator] || operator;

            // Create reference text
            const refText = operandVars.join(` ${opSymbol} `);

            // Draw reference info above the vector
            ctx.font = labelFont;
            ctx.fillStyle = color;
            ctx.textBaseline = "bottom";
            ctx.textAlign = "center";
            ctx.fillText(refText, midPx.x, midPx.y - 15);

            ctx.restore();
          }
        }

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
      }
    }
  }, [runner, unit, bg, gridColor, axesColor, vectorDefaultColor, showLabels, labelFont, arrowHeadSize, arrowLineWidth, snapToGrid, dragInfo]);

  // Mouse event handlers for interactive vectors
  const handleMouseDown = useCallback((e) => {
    if (!enableInteraction || !runner) return;

    const canvas = canvasRef.current?.getContext()?.canvas;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouse = new Vec2(e.clientX - rect.left, e.clientY - rect.top)
    // Use the actual dimensions of the canvas context
    const dims = canvasRef.current?.getDimensions() || { x: canvas.clientWidth, y: canvas.clientHeight };

    // Convert mouse position to world coordinates
    const toScreen = makeWorldToScreen(dims, unit);

    const mouseWorld = screenToWorld(dims, unit, mouse);

    // Check if we're near any interactive vector
    for (const [name, entry] of Object.entries(runner.variables)) {
      if (!entry || !entry.value || !entry.properties?.interactive) continue;

      const vec = entry.value;
      const origin = entry.properties?.origin ?? new Vec2(0, 0);
      const end = origin.addNew(vec);

      const endPx = toScreen(end);

      // Check if mouse is near tip of vector
      const distToTip = endPx.subtractNew(mouse).lengthSquared;
      if (distToTip < 40) {
        setDragInfo({
          vectorName: name,
          origin,
          originalValue: vec,
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
    const mouse = new Vec2(e.clientX - rect.left, e.clientY - rect.top)
    // Use the actual dimensions of the canvas context
    const dims = canvasRef.current?.getDimensions() || { x: canvas.clientWidth, y: canvas.clientHeight };


    const mouseWorld = screenToWorld(dims, unit, mouse);

    // Calculate new vector value based on mouse position
    let newValue = mouseWorld.subtractNew(dragInfo.origin);

    // Apply grid snapping if enabled
    if (snapToGrid)
      newValue.resetToVector(newValue.roundNew())

    // Update vector value directly
    const vectorEntry = runner.variables[dragInfo.vectorName];
    if (vectorEntry && vectorEntry.value instanceof Vec2) {
      const vector = vectorEntry.value;
      vector.x = newValue.x;
      vector.y = newValue.y;

      // Update only derived vectors marked as references
      if (runner.derivedVectors && runner.derivedVectors.has(vector)) {
        const dependentVectors = runner.derivedVectors.get(vector);
        for (const dependent of dependentVectors) {
          // Find the variable entry for this dependent vector
          let isReference = false;
          for (const [varName, varEntry] of Object.entries(runner.variables)) {
            if (varEntry.value === dependent && varEntry.properties?.reference) {
              isReference = true;
              break;
            }
          }

          // Only update if it's marked as a reference
          if (isReference && dependent._sourceOperation && typeof dependent._sourceOperation.recompute === 'function') {
            dependent._sourceOperation.recompute();
          }
        }
      }

      canvasRef.current?.redraw?.();
    }
  }, [dragInfo, runner, unit, snapToGrid]);

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
