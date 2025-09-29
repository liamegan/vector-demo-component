import { useState, useEffect, useRef } from "preact/hooks";
import { forwardRef } from "preact/compat";
import { useImperativeHandle } from "preact/hooks";

import { Vec2 } from "wtc-math";
import { classList } from "../utilities/classList";

import classes from "./Canvas.module.scss";

export const Canvas = forwardRef(
  (
    {
      draw = (ctx, dims) => {
        ctx.fillRect(0, 0, dims.x, dims.y);
      },
      className,
      // 'auto' uses window.devicePixelRatio; provide a number to override (e.g., 1 for tests)
      pixelRatio = "auto",
      onResize,
      ...rest
    },
    ref
  ) => {
    const cRef = useRef(null);
    const ctxRef = useRef(null);
    const [dims, setDims] = useState(new Vec2(0, 0));

    // Expose a custom API to the parent component
    useImperativeHandle(
      ref,
      () => ({
        redraw: () => {
          const ctx = ctxRef.current;
          if (ctx && dims.x > 0 && dims.y > 0) {
            draw(ctx, dims);
          }
        },
        getContext: () => ctxRef.current,
        getDimensions: () => dims,
      }),
      [draw, dims]
    );

    // Initialize the 2D context once
    useEffect(() => {
      const c = cRef.current;
      if (!c) return;

      const ctx = c.getContext("2d");
      if (!ctx) {
        // Fail quietly; consumer can detect via getContext()
        console.warn("Canvas: 2D rendering context is not available.");
        return;
      }
      ctxRef.current = ctx;
    }, []);

    // Handle size changes (container resize, DPR changes)
    useEffect(() => {
      const c = cRef.current;
      const ctx = ctxRef.current;
      const container = c ? c.parentElement : null;
      if (!c || !ctx || !container) return;

      let t = null;

      const getPixelRatio = () => {
        if (typeof pixelRatio === "number" && pixelRatio > 0) return pixelRatio;
        return Math.max(window.devicePixelRatio || 1, 1);
      };

      const applySize = () => {
        // Measure in CSS pixels
        const rect = container.getBoundingClientRect();
        const width = Math.floor(rect.width);
        const height = Math.floor(rect.height);
        const newDims = new Vec2(width, height);

        // Avoid work for zero-sized containers
        if (width <= 0 || height <= 0) {
          setDims(new Vec2(0, 0));
          return;
        }

        const pr = getPixelRatio();

        // Style size in CSS pixels
        c.style.width = `${width}px`;
        c.style.height = `${height}px`;

        // Backing store in device pixels
        const bw = Math.max(1, Math.round(width * pr));
        const bh = Math.max(1, Math.round(height * pr));
        if (c.width !== bw || c.height !== bh) {
          c.width = bw;
          c.height = bh;
        }

        // Draw using CSS pixel coordinates; scale context to DPR
        ctx.setTransform(pr, 0, 0, pr, 0, 0);

        setDims(newDims);
        if (typeof onResize === "function") onResize(newDims, pr);

        // Immediate draw after resize
        draw(ctx, newDims);
      };

      const scheduleApplySize = () => {
        if (t) {
          clearTimeout(t);
          t = null;
        }
        // Debounce bursts of resize callbacks
        t = setTimeout(applySize, 100);
      };

      const resizeObserver = new ResizeObserver(() => {
        scheduleApplySize();
      });
      resizeObserver.observe(container);

      // Handle browser zoom (DPR) or viewport resize where container size stays the same
      const handleWindowResize = () => scheduleApplySize();
      window.addEventListener("resize", handleWindowResize);

      // Initial measure/draw
      applySize();

      return () => {
        if (t) {
          clearTimeout(t);
          t = null;
        }
        resizeObserver.disconnect();
        window.removeEventListener("resize", handleWindowResize);
      };
    }, [draw, pixelRatio, onResize]);

    // Redraw if the draw function identity changes (e.g., new props), even if size didn’t.
    useEffect(() => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      if (dims.x > 0 && dims.y > 0) {
        draw(ctx, dims);
      }
    }, [draw]);

    return (
      <div className={classList(classes.container, className)} {...rest}>
        <canvas ref={cRef} />
      </div>
    );
  }
);