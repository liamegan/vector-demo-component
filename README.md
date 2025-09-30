# vector-demo-component
A Preact component that accepts plain-text commands to render vector demonstrations. The application includes an interactive editor to modify the commands in real-time with a clean side-by-side layout.

## Features

- Interactive vector visualization with canvas rendering
- Live command editing with real-time updates
- Grid snapping for interactive vectors
- Support for vector operations (addition, subtraction, multiplication)
- Clean side-by-side layout with responsive design

## Commands Syntax

```
variableName = Vec2(x, y), [options]
```

Options include:
- `interactive`: Makes the vector draggable
- `reference`: Shows this vector as dependent on others
- `origin: point`: Sets the origin point for the vector
- Color hex codes (e.g., `#CC3344`)

## Examples

```
a = Vec2(5,8), interactive, #CC3344
b = Vec2(1, 10), interactive, #33CC44
d = a - b, reference, origin: b
```
