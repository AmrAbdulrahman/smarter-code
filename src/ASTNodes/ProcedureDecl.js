const ASTNode = require('./ASTNode');

module.exports = class ProcedureDecl extends ASTNode {
  constructor(id, params, block) {
    super();

    this.id = id;
    this.params = params;
    this.block = block;
  }

  valueOf() {
    return `<${this.name} (name=${this.id.value})>`;
  }
}
