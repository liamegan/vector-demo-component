import { useState } from 'preact/hooks'

import {Canvas} from "./components/Canvas.js";
import { VectorCanvas } from "./components/VectorCanvasRenderer.js";

export function App() {
  const [count, setCount] = useState(0)


  const commands = `
a = Vec2(1,2), interactive, #CC3344
b = Vec2(1, 1)
c = a + b, origin: 5 5
d = b - a, origin: 1 2
e = b * 2, origin: 1 0
`;


  return (      <VectorCanvas
      commands={commands}
      unit={30}             // pixels per unit
      bg="#ffffff"
      gridColor="#eaecef"
      axesColor="#94a3b8"
      vectorDefaultColor="#111827"
    />
  )
}
