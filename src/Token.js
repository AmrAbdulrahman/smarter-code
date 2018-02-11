class Token {
  constructor(type, value, rowNumber, colNumber) {
    this.type = type;
    this.value = value;
    this.rowNumber = rowNumber;
    this.colNumber = colNumber;
  }

  toString() {
    return `Token(${this.type}, ${this.value})`;
  }

  setLocation(row, col) {
    this.rowNumber = row;
    this.colNumber = col;
  }

  getLocation() {
    return `(${this.rowNumber}:${this.colNumber})`;
  }

  repr() {
    return this.toString();
  }

  is(...types) {
    return types.indexOf(this.type) !== -1;
  }
}

module.exports = Token;
