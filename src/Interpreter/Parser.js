import { failPositionCodePreview, log, last, concat } from './utils';
import { Token } from './Token';
import { Lexer } from './Lexer';

import {
  INTEGER_CONST,
  REAL_CONST,
  STRING_LITERAL,
  PLUS,
  MINUS,
  MULTIPLY,
  INTEGER_DIVISION,
  FLOAT_DIVISION,
  EOF,
  OPENBRACE,
  CLOSEBRACE,
  OPEN_CURLY_BRACE,
  CLOSE_CURLY_BRACE,
  ID,
  ASSIGN,
  CREATE,
  COMMA,
  FUNCTION,
  TAKES,
  RETURN,
  IF,
  OTHERWISE,
  EQUALS,
  NOT,
  NOT_EQUALS,
  AND,
  OR,
  LESS,
  LESS_THAN,
  GREATER,
  GREATER_THAN,
  THAN,
  EQUAL,
  LESS_THAN_OR_EQUAL,
  GREATER_THAN_OR_EQUAL,
  THEN,
  COLON,
  OF,
} from './constants';

import {
  Program,
  Block,
  ScopedBlock,
  BinOp,
  UnaryOp,
  Num,
  NoOp,
  Var,
  Assign,
  VariableDeclaration,
  FunctionDecl,
  FunctionInvocation,
  Return,
  Str,
  If,
  Condition,
  ObjectLiteral,
} from './ASTNodes/*';

const TOKENS_IN_ADVANCE = 3;

export class Parser {
  constructor(code) {
    this.lexer = new Lexer(code);
    this.tokens = [];

    this.currentToken = this.lexer.getNextToken();

    for (let i = 0; i < TOKENS_IN_ADVANCE; i++) {
      this.tokens.push(this.lexer.getNextToken());
    }
  }

  fail(err) {
    const row = this.currentToken.rowIndex;
    const col = this.currentToken.colIndex;
    const codePreview = failPositionCodePreview(row, col, this.lexer.text);

    throw new Error(`${codePreview}Invalid syntax: ` + (err || 'unexpected token'));
  }

  eat(...types) {
    this.validateCurrentToken(types);
  }

  eatOptional(...types) {
    if (this.currentToken.is(...types)) {
      this.eat(...types);
    }
  }

  validateCurrentToken(types, message) {
    if (types.indexOf(this.currentToken.type) !== -1) {
      this.currentToken = this.tokens.shift();
      this.tokens.push(this.lexer.getNextToken());
    } else {
      this.fail(`Expected ${types.join('|')} but found ${this.currentToken.type}`);
    }
  }

  insert(type) {
    this.tokens.unshift(this.currentToken); // bring current token back
    this.currentToken = new Token(type);
  }

  nextToken(n = 1) {
    if (n < 1 || n > this.tokens.length) {
      throw new Error(`Parser: next token number range [1, ${this.tokens.length}]`);
    }

    return this.tokens[n - 1];
  }

  program() {
    log('program');
    // program : statement_list

    return new Program(this.statement_list());
  }

  // this is just a block, it does't open a new scope
  // it's useful as `function`, `while`, or `for` body
  block() {
    log('block');
    // block : OPEN_CURLY_BRACE block CLOSE_CURLY_BRACE

    this.eat(OPEN_CURLY_BRACE);
    const blockNode = new Block(this.statement_list());
    this.eat(CLOSE_CURLY_BRACE);
    return blockNode;
  }

  scoped_block() {
    // scoped_block : OPEN_CURLY_BRACE block CLOSE_CURLY_BRACE
    log('scoped_block');

    this.eat(OPEN_CURLY_BRACE);
    const scopedBlockNode = new ScopedBlock(this.statement_list());
    this.eat(CLOSE_CURLY_BRACE);
    return scopedBlockNode;
  }

  variables_declaration() {
    log('variables_declaration');
    // variable_declaration : CREATE variables_list

    this.eat(CREATE);

    return this.variables_list();
  }

  params_list() {
    log('variables_list');
    // variables_list: variable (COMMA variable)*

    const nodes = [this.variable()];

    while (this.currentToken.is(COMMA)) {
      this.eat(COMMA);
      nodes.push(this.variable());
    }

    return nodes;
  }

  variables_list() {
    log('variables_list');
    // variables_list: variable_declaration (COMMA variable_declaration)*

    const nodes = this.variable_declaration_and_assignment();

    while (this.currentToken.is(COMMA)) {
      this.eat(COMMA);
      concat(nodes, this.variable_declaration_and_assignment());
    }

    return nodes;
  }

  variable_declaration_and_assignment() {
    log('variable_declaration');
    // variable_declaration_and_possible_assignment : ID (= expr)?
    const varNode = this.variable();
    const variableDeclarationNode = new VariableDeclaration(varNode, null);
    const nodes = [variableDeclarationNode];

    if (this.currentToken.is(ASSIGN)) {
      this.eat(ASSIGN);

      const expr = this.expr();
      const assignNode = new Assign(varNode, expr);
      nodes.push(assignNode);
    }

    return nodes;
  }

  function_declaration() {
    log('function_declaration');
    // function_declaration : FUNCTION ID (TAKES params_list)? block

    this.eat(FUNCTION);
    const id = this.variable();
    let params = [];

    if (this.currentToken.is(TAKES)) {
      this.eat(TAKES);

      let withBraces = false;
      if (this.currentToken.is(OPENBRACE)) {
        withBraces = true;
        this.eat(OPENBRACE);
      }

      params = this.params_list();

      if (withBraces) {
        this.eat(CLOSEBRACE);
      }
    }

    const block = this.block();

    return new FunctionDecl(id, params, block);
  }

  statement_list() {
    log('statement_list');
    // statement_list : statement*

    const nodes = [];

    do {
      nodes.push(this.statement());
    } while (this.currentToken.is(EOF) === false &&
             last(nodes) instanceof NoOp === false);

    return nodes;
  }

  statement() {
    log('statement');
    // statement : assignment_statement
    //           | function_invocation
    //           | return_statement
    //           | if_block
    //           | var_declaration
    //           | function_declaration
    //           | empty

    if (this.currentToken.is(IF)) {
      return this.if_block();
    }

    if (this.currentToken.is(ID) && this.nextToken().is(OPENBRACE)) {
      return this.function_invocation();
    }

    if (this.currentToken.is(ID)) {
      return this.assignment_statement();
    }

    if (this.currentToken.is(RETURN)) {
      return this.return_statement();
    }

    if (this.currentToken.is(CREATE)) {
      return this.variables_declaration();
    }

    if (this.currentToken.is(FUNCTION)) {
      return this.function_declaration();
    }

    return this.empty();
  }

  if_block() {
    log('if_block');
    // if_block: if OPENBRACE condition CLOSEBRACE statement_or_block (ELSE IF condition statement_or_block)* (OTHERWISE statement_or_block)?

    const ifs = [];
    let condition = null;
    let body = null;
    let otherwise = null;

    this.eat(IF);
    condition = this.condition();
    this.eat(THEN);
    body = this.statement_or_scoped_block();

    ifs.push({
      condition,
      body,
    });

    // else if*
    while (this.currentToken.is(AND) && this.nextToken().is(IF)) {
      this.eat(AND);
      this.eat(IF);
      condition = this.condition();
      this.eat(THEN);
      body = this.statement_or_scoped_block();

      ifs.push({
        condition,
        body,
      });
    }

    if (this.currentToken.is(OTHERWISE)) {
      this.eat(OTHERWISE);
      otherwise = this.statement_or_scoped_block();
    }

    return new If(ifs, otherwise);
  }

  statement_or_scoped_block() {
    log('statement_or_block');
    // statement_or_block : (statement SEMI?) | scoped_block

    if (this.currentToken.is(OPEN_CURLY_BRACE)) {
      return this.scoped_block();
    } else {
      return this.statement();
    }
  }

  condition() {
    log('condition');
    // condition: expr

    return new Condition(this.expr());
  }

  return_statement() {
    log('return_statement');
    // return_statement : RETURN expr

    this.eat(RETURN);
    return new Return(this.expr());
  }

  assignment_statement() {
    log('assignment_statement');
    // assignment_statement : variable ASSIGN expr

    const leftNode = this.variable();
    this.eat(ASSIGN);
    const rightNode = this.expr();

    return new Assign(leftNode, rightNode);
  }

  get expr_precedence() {
    return [
      'expr',
      'expr_logical_and_or',
      'expr_logical_equals',
      'expr_logical_less_or_geater_than',
      'expr_arithmetic_plus',
      'expr_arithmetic_multiply',
      'expr_factor',
    ];
  }

  nextExprMethodOf(name) {
    const currentMethodIndex = this.expr_precedence.indexOf(name);
    const nextExprMethodName = this.expr_precedence[currentMethodIndex + 1];
    return this[nextExprMethodName]();
  }

  expr() {
    return this.nextExprMethodOf('expr');
  }

  expr_logical_and_or() {
    // expr_logical_and_or: something ((AND | OR) something)*
    log('expr_logical_and_or');

    const MYSELF = 'expr_logical_and_or';
    let left = this.nextExprMethodOf(MYSELF);

    while (this.currentToken.is(AND, OR)) {
      let operator = this.operator(AND, OR);
      let right = this.nextExprMethodOf(MYSELF);

      left = new BinOp(left, operator, right);
    }

    return left;
  }

  expr_logical_equals() {
    // expr_logical_equals : ex (NOT? EQUALS expr1)*
    log('expr_logical_equals');

    const MYSELF = 'expr_logical_equals';
    let left = this.nextExprMethodOf(MYSELF);

    while (this.currentToken.is(EQUALS) || this.currentToken.is(NOT)) {
      let operator;

      if (this.currentToken.is(EQUALS)) {
        operator = this.operator(EQUALS);
      } else {
        this.eat(NOT);
        this.eat(EQUALS);
        operator = new Token(NOT_EQUALS);
      }

      let right = this.nextExprMethodOf(MYSELF);

      left = new BinOp(left, operator, right);
    }

    return left;
  }

  expr_logical_less_or_geater_than() {
    // expr_logical_less_or_geater_than: something ((LESS_THAN | GREETER_THAN | LESS_THAN_OR_EQUAL | GREATER_THAN_OR_EQUAL) something)*
    log('expr_logical_less_or_geater_than');

    const MYSELF = 'expr_logical_less_or_geater_than';
    let left = this.nextExprMethodOf(MYSELF);

    while (this.currentToken.is(LESS, GREATER)) {
      const isLess = this.currentToken.is(LESS);
      let operatorKey;

      this.eat(LESS, GREATER);
      this.eat(THAN);

      if (this.currentToken.is(OR)) {
        this.eat(OR);
        this.eat(EQUAL);

        operatorKey = isLess ? LESS_THAN_OR_EQUAL : GREATER_THAN_OR_EQUAL;
      } else {
        operatorKey = isLess ? LESS_THAN : GREATER_THAN;
      }

      let operator = new Token(operatorKey);
      let right = this.nextExprMethodOf(MYSELF);

      left = new BinOp(left, operator, right);
    }

    return left;
  }

  expr_arithmetic_plus() {
    // expr1 : expr2 ((PLUS | MINUS) expr2)*
    log('expr_arithmetic_plus');

    const MYSELF = 'expr_arithmetic_plus';
    let left = this.nextExprMethodOf(MYSELF);

    while (this.currentToken.is(PLUS, MINUS)) {
      let operator = this.operator(PLUS, MINUS);
      let right = this.nextExprMethodOf(MYSELF);

      left = new BinOp(left, operator, right);
    }

    return left;
  }

  expr_arithmetic_multiply() {
    // expr_arithmetic_multiply : expr3 ((MUL | DIV) expr3)*
    log('expr_arithmetic_multiply');

    const MYSELF = 'expr_arithmetic_multiply';
    let left = this.nextExprMethodOf(MYSELF);

    while (this.currentToken.is(MULTIPLY, INTEGER_DIVISION, FLOAT_DIVISION)) {
      let operator = this.operator(MULTIPLY, INTEGER_DIVISION, FLOAT_DIVISION);
      let right = this.nextExprMethodOf(MYSELF);

      left = new BinOp(left, operator, right);
    }

    return left;
  }

  expr_factor() {
    // factor : (PLUS | MINUS) FACTOR
    //        | INTEGER_CONST
    //        | REAL_CONST
    //        | OPENBRACE EXPR CLOSEBRACE
    //        | function_invocation
    //        | Variable
    //        | String
    //        | Object_Literal
    log('expr_factor');

    const token = this.currentToken;

    // +factor
    if (this.currentToken.is(PLUS)) {
      this.eat(PLUS);
      return new UnaryOp(token, this.factor());
    }

    // -factor
    if (this.currentToken.is(MINUS)) {
      this.eat(MINUS);
      return new UnaryOp(token, this.factor());
    }

    // expr
    if (this.currentToken.is(OPENBRACE)) {
       this.eat(OPENBRACE);
       const exprNode = this.expr();
       this.eat(CLOSEBRACE);
       return exprNode;
    }

    // str
    if (this.currentToken.is(STRING_LITERAL)) {
      this.eat(STRING_LITERAL);
      return new Str(token);
    }

    // INTEGER
    if (this.currentToken.is(INTEGER_CONST, REAL_CONST)) {
      this.eat(INTEGER_CONST, REAL_CONST);
      return new Num(token);
    }

    // id()
    if (this.currentToken.is(ID) && this.nextToken().is(OPENBRACE)) {
      return this.function_invocation();
    }

    // var
    if (this.currentToken.is(ID) && this.nextToken().is(OF)) {
      return this.expr_chain();
    }

    // Var
    if (this.currentToken.is(ID)) {
      return this.variable();
    }

    // object literal
    if (this.currentToken.is(OPEN_CURLY_BRACE)) {
      return this.object_literal();
    }

    this.fail('Expected expression');
  }

/* a of b of c of d
c =>    a



c=>    B
      a b
r = c


c=>   B
     a  B <
       b  c
r = d


c=>   B
     a  B
       b  B
        c   d
r = d


*/
  expr_chain() {
    // expr_chain: ID (of ID)*

    log('expr_chain');

    let root = this.variable();
    let current = null;

    if (this.currentToken.is(OF)) {
      let operator = this.operator(OF);
      let right = this.variable();

      root = new BinOp(root, operator, right);
      current = root;
    }

    while (this.currentToken.is(OF)) {
      let operator = this.operator(OF);
      let right = this.variable();

      current.right = new BinOp(current.right, operator, right);
      current = current.right;
    }

    return root;
  }

  object_literal() {
    // object_literal: OPEN_CURLY_BRACE ()* CLOSE_CURLY_BRACE
    const nodes = [];

    this.eat(OPEN_CURLY_BRACE);

    while (this.currentToken.is(ID)) {
      const variable = this.variable();

      if (this.currentToken.is(COLON)) {
        this.eat(COLON);
      } else {
        this.eat(ASSIGN);
      }

      nodes.push({
        key: new VariableDeclaration(variable),
        value: this.expr(),
      });

      // if comma, continue, else close
      if (this.currentToken.is(COMMA)) {
        this.eat(COMMA);
      } else {
        break;
      }
    }

    this.eat(CLOSE_CURLY_BRACE);

    return new ObjectLiteral(nodes);
  }

  function_invocation() {
    // function_invocation: ID OPENBRACE args_list CLOSEBRACE
    log('function_invocation');

    const functionName = this.currentToken;
    const args = [];

    this.eat(ID);
    this.eat(OPENBRACE);

    // (arg (comma arg)*)
    if (!this.currentToken.is(CLOSEBRACE)) { // there's at least one param
      args.push(this.expr()); // first arg

      while (this.currentToken.is(COMMA)) { // then read pairs (COMMA ARG)
        this.eat(COMMA);
        args.push(this.expr());
      }
    }

    this.eat(CLOSEBRACE);

    return new FunctionInvocation(functionName, args);
  }

  variable() {
    // variable: ID
    log('variable');

    const variableNode = new Var(this.currentToken);
    this.eat(ID);
    return variableNode;
  }

  empty() {
    // empty: NoOp
    return new NoOp();
  }

  operator(...types) {
    const operatorToken = this.currentToken;
    this.eat(...types);
    return operatorToken;
  }

  parse() {
    const ast = this.program();

    if (this.lexer.getNextToken().is(EOF) === false) {
      this.fail();
    }

    return ast;
  }
}
