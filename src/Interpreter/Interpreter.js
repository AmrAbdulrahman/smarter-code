import { NodeVisitor } from './NodeVisitor';
import { SemanticAnalyzer } from './SemanticAnalyzer';
import { Scope } from './Scope';
import { BuiltinsScope } from './BuiltinsScope';
import { BaseSymbol } from './Symbols/BaseSymbol';
import { VarSymbol } from './Symbols/VarSymbol';
import { ProcedureSymbol } from './Symbols/ProcedureSymbol';
import { Parser } from './Parser';

import {
  PLUS,
  MINUS,
  MULTIPLY,
  INTEGER_DIVISION,
  FLOAT_DIVISION,
  PRINT,
  EQUALS,
  NOT_EQUALS,
  AND,
  OR,
  LESS_THAN,
  GREATER_THAN,
  LESS_THAN_OR_EQUAL,
  GREATER_THAN_OR_EQUAL,
} from './constants';

class Return {
  constructor(value) {
    this.value = value;
  }
}

export class Interpreter extends NodeVisitor {
  constructor(code, {stdin, stdout, stderr}) {
    super();

    this.code = code;
    this.stdin = stdin;
    this.stdout = stdout;
    this.stderr = stderr;
    this.currentScope = new BuiltinsScope();
  }

  openNewScope(name) {
    this.currentScope = new Scope(name, this.currentScope);
  }

  closeCurrentScope() {
    this.currentScope = this.currentScope.parent;
  }

  visitProgram(node) {
    const appName = new BaseSymbol(node.id.value);
    this.currentScope.insert(appName);

    const returnValue = this.visit(node.block);
    return returnValue instanceof Return ? returnValue.value : returnValue;
  }

  visitScopedBlock(node) {
    this.openNewScope('block');

    const blockReturnValue = this.visitBlock(node);

    this.closeCurrentScope();

    return blockReturnValue;
  }

  visitBlock(node) {
    for (let index in node.children) {
      const statement = node.children[index];
      const statementValue = this.visit(statement);

      if (statementValue instanceof Return) {
        return statementValue;
      }
    }
  }

  visitVariableDeclaration(node) {
    const typeName = node.type.value;
    const typeSymbol = this.currentScope.lookup(typeName);
    const varName = node.variable.value;
    const varSymbol = new VarSymbol(varName, typeSymbol);

    this.currentScope.insert(varSymbol);
  }

  visitAssign(node) {
    const varName = node.left.value;
    const value = this.visit(node.right);

    this.currentScope
      .lookup(varName)
      .setValue(value);
  }

  visitNoOp(node) {
    // do nothing here, void, blackhole...
  }

  visitVar(node) {
    return this.currentScope
      .lookup(node.value)
      .getValue();
  }

  visitBinOp(node) {
    const left = this.visit(node.left);
    const right = this.visit(node.right);

    switch (node.op.type) {
      case PLUS:
        return left + right;
      case MINUS:
        return left - right;
      case MULTIPLY:
        return left * right;
      case FLOAT_DIVISION:
        return left / right;
      case INTEGER_DIVISION:
        return Math.floor(left / right);
      case EQUALS:
        return left === right;
      case NOT_EQUALS:
        return left !== right;
      case AND:
        return !!(left && right);
      case OR:
        return !!(left || right);
      case LESS_THAN:
        return left < right;
      case GREATER_THAN:
        return left > right;
      case LESS_THAN_OR_EQUAL:
        return left <= right;
      case GREATER_THAN_OR_EQUAL:
        return left >= right;

      default:
        throw new Error(`Unhandled operator type ${node.op.type}`);
    }
  }

  visitNum(node) {
    return node.value;
  }

  visitStr(node) {
    return node.value;
  }

  visitUnaryOp(node) {
    return (node.op.type === PLUS ? 1 : -1) * this.visit(node.expr);
  }

  visitReturn(node) {
    return new Return(this.visit(node.expr));
  }

  visitProcedureDecl(node) {
    // add parameters to procedure symbol
    const params = node.params.map(param => {
      const paramType = this.currentScope.lookup(param.type.value);
      const paramName = param.variable.value;
      return new VarSymbol(paramName, paramType);
    });

    const procedureName = node.id.value;
    const procedureBody = node.block;
    const procedureSymbol = new ProcedureSymbol(procedureName, procedureBody, params);

    this.currentScope.insert(procedureSymbol);
  }

  visitProcedureInvokation(node) {
    const procedureName = node.id.value;
    const procedureSymbol = this.currentScope.lookup(procedureName);

    if (procedureName === PRINT) {
      return this.print(node);
    }

    // open invokation scope
    this.openNewScope(procedureName);

    procedureSymbol.params.forEach((param, index) => {
      const paramType = this.currentScope.lookup(param.type.value);
      const paramName = param.name;
      const argSymbol = new VarSymbol(
        paramName,
        paramType,
        this.visit(node.args[index]) // evaluate arg
      );

      this.currentScope.insert(argSymbol);
    });

    const returnValue = this.visit(procedureSymbol.block);

    // close invokation scope
    this.closeCurrentScope();

    return returnValue instanceof Return ? returnValue.value : returnValue;
  }

  visitIf(node) {
    for (var i = 0; i < node.ifs.length; i++) {
      const { condition, body } = node.ifs[i];
      const conditionValue = this.visit(condition);

      if (conditionValue === true) {
        return this.visit(body);
      }
    }

    if (node.otherwise) {
      return this.visit(node.otherwise);
    }
  }

  visitCondition(node) {
    return !!this.visit(node.expr);
  }

  print(node) {
    //console.log.apply(console, );
    const output = node.args.map(arg => this.visit(arg)).join(' ');
    this.stdout.write(`${output}\n`);
  }

  // run semantic analysis
  validate({delegateEx} = {delegateEx: false}) {
    try {
      this.stdout.write('Parsing...');
      const ast = (new Parser(this.code)).parse();
      this.stdout.write('Parsing: Ok');

      this.stdout.write('Running semantic checks...');
      (new SemanticAnalyzer()).visit(ast);
      this.stdout.write('Semantic checks: Ok');

      return ast;
    } catch(ex) {
      if (delegateEx) throw ex;
      this.stderr.write('Code validation fails');
      this.stderr.write(ex);
    }
  }

  interpret() {
    try {
      const ast = this.validate({delegateEx: true});

      this.stdout.write('Executing code...');
      this.stdout.write('');
      return this.visit(ast);
    } catch (ex) {
      this.stderr.write(ex);
    }
  }
}