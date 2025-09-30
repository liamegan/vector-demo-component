import { useState } from 'preact/hooks'

import {Canvas} from "./components/Canvas.jsx";
import { VectorCanvas } from "./components/VectorCanvasRenderer.jsx";
import classes from './App.module.scss';

export function App() {
  const defaultCommands = `b = Vec2(10,8), interactive, #0067C7
a = Vec2(-2, 10), interactive, #67AA00
// d = a + b, reference, origin: 4 4
d = a - b, reference, origin: b
// e = b * 2, origin: 1 0
`;

  const [commands, setCommands] = useState(defaultCommands);

  const handleCommandsChange = (e) => {
    setCommands(e.target.value);
  };

  return (
    <div className={classes.appContainer}>
      <div className={classes.mainRow}>
        <div className={classes.canvasCol}>
          <VectorCanvas
            commands={commands}
            unit={15}             // pixels per unit
            bg="#ffffff"
            gridColor="#eaecef"
            axesColor="#94a3b8"
            vectorDefaultColor="#111827"
            snapToGrid={true}      // enable grid snapping
            debugging={true}
          />
        </div>
        <div className={classes.sidebar}>
          <textarea
            className={classes.editor}
            value={commands}
            onInput={handleCommandsChange}
          />
          <div className={classes.helperText}>
            <p>Syntax: <code>variableName = Vec2(x,y), [options]</code></p>
            <p>Options: interactive, reference, origin: point</p>
          </div>
        </div>
      </div>
    </div>
  )
}