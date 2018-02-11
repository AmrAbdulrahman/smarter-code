const { span } = require('./utils');

module.exports = class Scope {
  constructor(scopeName, parent = null) {
    this.symbols = {};
    this.scopeName = scopeName;
    this.scopeLevel = parent ? parent.scopeLevel + 1 : 0;
    this.parent = parent;
  }

  toString() {
    return `SCOPE (name=${this.scopeName}) (level=${this.scopeLevel})\n${
      this.keys.map(key => span(key, 8) + ' : ' + this.symbols[key]).join('\n')
    }`;
  }

  insert(symbol) {
    //console.log('Define', symbol.toString());
    this.symbols[symbol.name] = symbol;
  }

  lookup(name) {
    //console.log('Lookup', name, `(${this.scopeName})`);

    if (this.symbols[name]) {
      return this.symbols[name];
    }

    if (this.parent) {
      return this.parent.lookup(name);
    }

    return null;
  }

  has(name) {
    return !!this.symbols[name];
  }

  get keys() {
    return Object.keys(this.symbols);
  }
};