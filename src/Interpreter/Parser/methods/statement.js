import { IF, ID, OPENBRACE, RETURN, CREATE, FUNCTION } from '../../constants';

// statement : assignment_statement
//           | function_invocation
//           | return_statement
//           | if_block
//           | var_declaration
//           | function_declaration
//           | empty

export function eatStatement() {
  if (this.currentToken.is(IF)) {
    return this.eatIfBlock();
  }

  if (this.currentToken.is(ID) && this.nextToken().is(OPENBRACE)) {
    return this.eatFunctionInvocation();
  }

  if (this.currentToken.is(ID)) {
    return this.eatAssignmentStatement();
  }

  if (this.currentToken.is(RETURN)) {
    return this.eatReturnStatement();
  }

  if (this.currentToken.is(CREATE)) {
    return this.eatVariablesDeclaration();
  }

  if (this.currentToken.is(FUNCTION)) {
    return this.eatFunctionDeclaration();
  }

  return this.eatEmpty();
}