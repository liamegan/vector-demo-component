import { Instruction } from "./Instruction"

export class InstructionParser {
  commands = [];
  log = [];
  script = '';

  // Variable Method Call: f.rotateBy(10, 5)
  #rMethod = /^([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)\((.*)\)$/;
  // Property Modification: f.length = 10
  #rProperty = /^([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)\s*=\s*(.*)$/;
  // sAssignment: a = Vec2(1,2), interactive, #CC3344
  #rAssignment = /^([a-zA-Z_]\w*)\s*=\s*(.*)$/;

  // Function Call: Vec2(1,2)
  #rExprFunction = /^([a-zA-Z_]\w*)\((.*)\)$/;
  // Arithmetic Operation: a + b, b - a
  #rExprOp = /^\s*(.+?)\s*([+\-*/])\s*(.+?)\s*$/;
  // Variable Method Call in an Expression: e.clone()
  #rExprMethod = /^([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)\((.*)\)$/;
  // Variable Property Access in an Expression: e.length
  #rExprPropAccess = /^([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)$/;

  constructor() {}

  /**
   * Parses and returns the entire script as a structured command array.
   * @param {string} script The input script string.
   */
  parse(script) {
    this.script = script;
    this.commands = [];
    this.log = [];
    const lines = script
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('//'));

    lines.forEach((line, i) => {
      try {
        const command = this.parseLine(line);
        if(command) this.commands.push(command);
      } catch (e) {
        this.log.push(`Line ${i+1}: \`${line}\` failed. Error: ${e.message}`);
      }
    })
    return { commands: this.commands, log: this.log };
  }


  /**
   * Processes a single instruction line and returns a structured command object.
   * @param {string} line
   * @returns {object} Structured command object.
   */
  parseLine(line) {
    // Method call - must be checked before property modification
    let match = line.match(this.#rMethod);
    if(match) {
      const type = Instruction.TYPE.METHOD
      const [ _, variable, method, argStr ] = match.map(v => v.trim());

      const args = argStr.split(/,\s*/).map(a => this.parseValue(a.trim())).filter(a => a);

      return new Instruction({
        type, variable, method, args, line
      });
    }
    // Property Modification - eg f.length = 10
    match = line.match(this.#rProperty);
    if(match) {
      const type = Instruction.TYPE.PROPERTY;
      const [_, variable, property, valueStr] = match.map(v => v.trim());
      const value = this.parseValue(valueStr);

      return new Instruction({
        type, variable, property, value, line
      })
    }
    // Assignment - eg a = Vec2(1,2), interactive, #CC3344
    match = line.match(this.#rAssignment);
    if(match) {
      const type = Instruction.TYPE.ASSIGNMENT;
      const [_, variable, definitionStr] = match;

      const { mainExpression, modifiersStr } = this.splitExpression(definitionStr)

      const value = this.parseExpression(mainExpression);
      const modifiers = this.parseModifiers(modifiersStr)

      return new Instruction({
        type, variable, value, modifiers, line
      });
    }
  }

  /**
   * Separates the main expression from modifiers, respecting parentheses depth.
   */
  splitExpression(definitionStr) {
    let bracketDepth = 0;
    let mainExpressionEndIndex = definitionStr.length;

    for (let i = 0; i < definitionStr.length; i++) {
      const char = definitionStr[i];
      if (char === '(') {
        bracketDepth++;
      } else if (char === ')') {
        bracketDepth--;
      } else if (char === ',' && bracketDepth === 0) {
        mainExpressionEndIndex = i;
        break; // Found the separation comma
      }
    }

    const mainExpression = definitionStr.substring(0, mainExpressionEndIndex).trim();
    const modifiersStr = (mainExpressionEndIndex < definitionStr.length)
      ? definitionStr.substring(mainExpressionEndIndex + 1).trim()
      : '';

    return { mainExpression, modifiersStr };
  }

  /**
   * Parses comma-separated modifiers, checking for key: val and function() syntax.
   */
  parseModifiers(modifiersStr) {
    if (!modifiersStr) return [];

    // Use the same splitting logic as the main assignment line for safety
    const modifierTokens = modifiersStr.split(/,\s*/).filter(m => m.length > 0);

    return modifierTokens.map(token => {
      token = token.trim();

      // 1. Check for key: value syntax (e.g., origin: 5 5)
      const colonMatch = token.match(/^([a-zA-Z_]\w*)\s*:\s*(.*)$/);
      if (colonMatch) {
        const key = colonMatch[1];
        const valuesStr = colonMatch[2].trim();

        // Split space-separated values (e.g., "5 5")
        const args = valuesStr.split(/\s+/).map(v => this.parseValue(v));

        return {
          type: 'PropertyFunction',
          name: key,
          args: args
        };
      }

      // 2. Function Modifier (e.g., origin(5,5)) - Existing functional modifier support
      const funcMatch = token.match(/^([a-zA-Z_]\w*)\((.*)\)$/);
      if (funcMatch) {
        // Re-use parseExpression to generate the Function object structure
        const funcNode = this.parseExpression(token);
        // Convert the Function type to PropertyFunction, as it's used as a modifier
        if (funcNode.type === 'Function') {
          funcNode.type = 'PropertyFunction';
        }
        return funcNode;
      }

      // 3. Simple tag or color (e.g., interactive, #CC3344)
      return { type: 'Property', value: token };
    });
  }

  /**
   * Parses the core expression (FunctionCall, Operation, or VariableReference).
   */
  parseExpression(expression) {
    expression = expression.trim();

    // 1. Function Call: Vec2(1,2) or origin(5,5)
    let match = expression.match(this.#rExprFunction);
    if (match) {
      let [_, name, argsStr] = match;
      // Arguments are split by comma, respecting spaces
      argsStr = argsStr.split(/,\s*/).map(a => a.trim()).filter(a => a.length > 0);

      return {
        type: 'Function',
        name: name,
        args: argsStr.map(arg => this.parseValue(arg))
      };
    }

    // 2. Arithmetic Operation: a + b, b - a
    match = expression.match(this.#rExprOp);
    if (match) {
      const [ _, leftStr, operator, rightStr ] = match.map(v => v.trim());
      return {
        type: 'Operation',
        operator,
        left: this.parseExpression(leftStr),
        right: this.parseExpression(rightStr)
      };
    }

    // Variable Method Call (e.g., g = e.clone())
    match = expression.match(this.#rExprMethod);
    if (match) {
      const [_, variable, method, argsStr] = match;
      const args = argsStr.split(/,\s*/).map(a => this.parseValue(a.trim())).filter(a => a);

      return {
        type: 'VariableMethodCall',
        variable: variable,
        method: method,
        args: args
      };
    }

    // Variable Property Access (e.g., h = e.length)
    match = expression.match(this.#rExprPropAccess);
    if (match) {
      const [_, variable, property] = match;
      return {
        type: 'VariablePropertyAccess',
        variable: variable,
        property: property
      };
    }

    // 3. Simple Value (Variable Reference, Number, or String)
    return this.parseValue(expression);
  }
  /**
   * Parses a single token (VariableReference, Number, or String).
   */
  parseValue(valueStr, returnRefs = true) {
    // Check if it's a number
    const num = parseFloat(valueStr);
    // check if it's a variable reference
    if(valueStr.match(/^[a-zA-Z_]\w*$/)) {
      // check if it's a number string that was parsed as a variabvle name
      if(!isNaN(num) && String(num) === valueStr) return num;
      else if(returnRefs) return { type: "VariableReference", name: valueStr };
    }
    if(!isNaN(num)) return num;
    return valueStr;
  }
}