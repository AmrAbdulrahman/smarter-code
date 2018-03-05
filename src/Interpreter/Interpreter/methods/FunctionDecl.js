import { VarSymbol, FunctionSymbol } from '../../Common/Symbols/*';

export async function visitFunctionDecl(node) {
  if (this.stepByStep) await this.wait('function declaration');

  const functionName = node.id.value;
  const functionSymbol = new FunctionSymbol(functionName, node.block);

  this.currentScope.insert(functionSymbol);

  this.openNewScope(functionName);

  functionSymbol.setScope(this.currentScope);

  // declare params
  node.params.forEach(param => {
    const paramName = param.value;
    const paramSymbol = new VarSymbol(paramName, null);

    this.currentScope.insert(paramSymbol);
    functionSymbol.params.push(paramSymbol);
  });

  // visit all declaration nodes inside the function
  await this.visitFunctionLocalDeclarations(node.block);

  this.closeCurrentScope();

  return Promise.resolve();
}
