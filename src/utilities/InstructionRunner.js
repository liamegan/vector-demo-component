import { Vec2 } from "wtc-math";
import { InstructionParser } from "./InstructionParser";
import { Instruction } from "./Instruction";

export class InstructionRunner {
  commands;
  variables = {};
  errors = [];

  static parse({ commands }) {
    const p = new InstructionParser();
    const i = p.parse(commands);
    const r = new InstructionRunner();
    r.run({ commands: i.commands });
    return r;
  }

  constructor() {}

  run({ commands }) {
    this.commands = commands;
    this.variables = {};
    this.errors = [];

    this.commands.forEach(instruction => {
      try {
        switch (instruction.type) {
          case Instruction.TYPE.ASSIGNMENT: { // Used curly braces for block-scoping
            const value = this.evaluateExpression(instruction.value);
            const properties = this.parseProperties(instruction.modifiers);
            this.variables[instruction.variable] = {
              value,
              properties
            };
            break;
          }
          case Instruction.TYPE.PROPERTY:
            this.executePropertyModification(instruction);
            break;
          case Instruction.TYPE.METHOD:
            this.executeMethodCall(instruction);
            break;
          default:
            throw new Error('Unrecognised instruction type.');
        }
      } catch (e) {
        this.errors.push(`Error: ${instruction.string} - ${e.message}`);
      }
    });
    if (this.errors.length > 0) {
      console.warn("Errors occurred during script execution:", this.errors);
    }
  }

  /**
   * Parses the raw properties array from an instruction into a structured object.
   * @param {Array<object>} propertiesArray - The array of property nodes.
   * @returns {object} A key-value map of the parsed properties.
   * @private
   */
  parseProperties(propertiesArray = []) {
    if (!propertiesArray) return {};

    return propertiesArray.reduce((acc, prop) => {
      switch (prop.type) {
        case "PropertyFunction":
          // Handle specific function-like properties
          if (prop.name === 'origin') {
            const resolvedArgs = prop.args.map(arg => this.evaluateExpression(arg));
            acc.origin = new Vec2(...resolvedArgs);
          } else {
            throw new Error(`Unrecognised property function: ${prop.name}`);
          }
          break;

        case "Property":
          // Handle hex color codes
          if (prop.value.startsWith('#')) {
            acc.color = prop.value;
          }
          // Handle boolean-like flags
          else if (prop.value === 'interactive') {
            acc.interactive = true;
          } else {
            // You could add more property types or throw an error
            console.warn(`Unrecognised property value: ${prop.value}`);
          }
          break;
        default:
          throw new Error(`Unrecognised property type: ${prop.type}`);
      }
      return acc;
    }, {});
  }


  executeMethodCall(instruction) {
    const { variable, method, args } = instruction;
    const targetObject = this.variables[variable].value;
    if (!targetObject) {
      throw new Error(`Variable '${variable}' is not defined.`);
    }
    if (typeof targetObject[method] !== 'function') {
      throw new Error(`Method '${method}' not found on variable '${variable}'`);
    }

    const resolvedArgs = args.map(arg => this.evaluateExpression(arg));
    targetObject[method](...resolvedArgs);
  }

  executePropertyModification(instruction) {
    const { variable, property, value } = instruction;
    const targetObject = this.variables[variable].value;
    if (!targetObject) {
      throw new Error(`Variable '${variable}' is not defined.`);
    }
    const resolvedValue = this.evaluateExpression(value);
    targetObject[property] = resolvedValue;
  }

  /**
   * Recursively evaluates a parsed expression node to its runtime value.
   * @param {object} node - The expression node from the parser.
   * @returns The computed value (e.g., a Vec2 instance, a number).
   */
  evaluateExpression(node) {
    // It's a primitive value (e.g., a number, or a simple string)
    if (typeof node !== 'object' || node === null) {
      return node;
    }

    switch (node.type) {
      case "Function": {
        const { name, args } = node;
        const resolvedArgs = args.map(arg => this.evaluateExpression(arg));
        switch (name) {
          case "Vec2":
            return new Vec2(...resolvedArgs);
          default:
            throw new Error(`Unrecognised function call: ${name}`);
        }
      }
      case "Operation": {
        const { operator, left, right } = node;
        const a = this.evaluateExpression(left);
        const b = this.evaluateExpression(right);
        const isVecLeft = a instanceof Vec2;
        const isVecRight = b instanceof Vec2;

        switch (operator) {
          case "+":
            if (isVecLeft && isVecRight) return a.addNew(b);
            if (isVecLeft) return a.addScalarNew(b);
            if (isVecRight) return b.addScalarNew(a);
            return a + b;
          case "-":
            if (isVecLeft && isVecRight) return a.subtractNew(b);
            if (isVecLeft) return a.subtractScalarNew(b);
            if (isVecRight) return new Vec2(a, a).scale(-1).addNew(b); // Correct scalar-vector logic
            return a - b;
          case "*":
            if (isVecLeft && isVecRight) return a.multiplyNew(b);
            if (isVecLeft) return a.scaleNew(b);
            if (isVecRight) return b.scaleNew(a);
            return a * b;
          default:
            throw new Error(`Unrecognised operator: ${operator}`);
        }
      }
      case "VariableMethodCall": {
        const { variable, method, args } = node;
        const targetObject = this.evaluateExpression({ type: "VariableReference", name: variable });
        if (typeof targetObject[method] !== 'function') {
          throw new Error(`Method '${method}' not found on variable '${variable}'`);
        }
        const resolvedArgs = args.map(arg => this.evaluateExpression(arg));
        return targetObject[method](...resolvedArgs);
      }
      case "VariablePropertyAccess": {
        const { variable, property } = node;
        const targetObject = this.evaluateExpression({ type: "VariableReference", name: variable });
        if (targetObject?.[property] === undefined) {
          throw new Error(`Property '${property}' not found on variable '${variable}'`);
        }
        return targetObject[property];
      }
      case "VariableReference": {
        if (!this.variables.hasOwnProperty(node.name)) {
          throw new Error(`Variable '${node.name}' is not defined.`);
        }
        return this.variables[node.name].value;
      }
      default:
        throw new Error(`Cannot evaluate node of type: ${node.type || typeof node}`);
    }
  }
}