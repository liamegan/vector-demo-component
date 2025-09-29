
export class Instruction {
  type;
  variable;
  method;
  args;
  property;
  value;
  modifiers;

  static TYPE = {
    METHOD: 0,
    PROPERTY: 1,
    ASSIGNMENT: 2
  }

  constructor({
                type,
                variable,
                method,
                args,
                property,
                value,
                modifiers,
                line
              }) {
    if(this.types.indexOf(type) === -1) throw new Error(`Type must be one of ${this.types}`);

    this.type = type;
    this.variable = variable;
    this.method = method;
    this.args = args;
    this.property = property;
    this.value = value;
    this.modifiers = modifiers;
    this.string = line;
  }

  get TYPE() {
    return Instruction.TYPE;
  }
  get types() {
    return Object.values(Instruction.TYPE);
  }
  get typenames() {
    return Object.keys(Instruction.TYPE);
  }
}