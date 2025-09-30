import { useState } from 'preact/hooks'

import {Canvas} from "./components/Canvas.js";
import { VectorCanvas } from "./components/VectorCanvasRenderer.js";

export function App() {
  const [count, setCount] = useState(0)


  const commands = `
a = Vec2(5,8), interactive, #CC3344
b = Vec2(1, 10), interactive, #33CC44
// c = a + b, reference, origin: 4 4
d = a - b, reference, origin: b
// e = b * 2, origin: 1 0
`;


  return (      <VectorCanvas
      commands={commands}
      unit={15}             // pixels per unit
      bg="#ffffff"
      gridColor="#eaecef"
      axesColor="#94a3b8"
      vectorDefaultColor="#111827"
      snapToGrid={true}      // enable grid snapping
      debugging={true}
    />
  )
}