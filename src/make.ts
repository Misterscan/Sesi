import {
  type Expression,
  type FunctionStatement,
  type Identifier,
  type Literal,
  type MakeStatement,
  type Statement,
} from './types';

/** Lower an object template to operations shared by both execution engines. */
export function desugarMakeStatement(stmt: MakeStatement): FunctionStatement {
  const { line, name, fields, methods } = stmt;
  const starter = methods.find(method => method.name === 'start');
  const constructorParameters = starter
    ? starter.parameters.slice(1).map(parameter => ({ ...parameter }))
    : [];

  const selfIdentifier = (): Identifier => ({ type: 'Identifier', name: 'self', line });
  const identifier = (identifierName: string, identifierLine: number = line): Identifier => ({
    type: 'Identifier', name: identifierName, line: identifierLine,
  });
  const nullLiteral = (literalLine: number): Literal => ({
    type: 'Literal', value: null, rawType: 'null', line: literalLine,
  });

  const bodyStatements: Statement[] = [{
    type: 'LetStatement',
    name: 'self',
    value: { type: 'ObjectLiteral', properties: [], line },
    line,
  }];

  for (const field of fields) {
    bodyStatements.push({
      type: 'ExpressionStatement',
      expression: {
        type: 'Assignment',
        left: {
          type: 'MemberExpression',
          object: selfIdentifier(),
          property: field.name,
          line: field.line,
        },
        right: field.value ?? nullLiteral(field.line),
        line: field.line,
      },
      line: field.line,
    });
  }

  bodyStatements.push(...methods);

  for (const method of methods) {
    const boundName = `__make_${name}_${method.name}`;
    const boundParameters = method.parameters.slice(1).map(parameter => ({ ...parameter }));
    const callArguments: Expression[] = [
      selfIdentifier(),
      ...boundParameters.map(parameter => identifier(parameter.name, method.line)),
    ];
    const boundMethod: FunctionStatement = {
      type: 'FunctionStatement',
      name: boundName,
      parameters: boundParameters,
      body: {
        type: 'BlockStatement',
        statements: [{
          type: 'ReturnStatement',
          value: {
            type: 'CallExpression',
            callee: identifier(method.name, method.line),
            arguments: callArguments,
            line: method.line,
          },
          line: method.line,
        }],
        line: method.line,
      },
      line: method.line,
      isAsync: method.isAsync,
    };

    bodyStatements.push(boundMethod, {
      type: 'ExpressionStatement',
      expression: {
        type: 'Assignment',
        left: {
          type: 'MemberExpression',
          object: selfIdentifier(),
          property: method.name,
          line: method.line,
        },
        right: identifier(boundName, method.line),
        line: method.line,
      },
      line: method.line,
    });
  }

  if (starter) {
    bodyStatements.push({
      type: 'ExpressionStatement',
      expression: {
        type: 'CallExpression',
        callee: identifier(starter.name, starter.line),
        arguments: [
          selfIdentifier(),
          ...constructorParameters.map(parameter => identifier(parameter.name, starter.line)),
        ],
        line: starter.line,
      },
      line: starter.line,
    });
  }

  bodyStatements.push({ type: 'ReturnStatement', value: selfIdentifier(), line });

  return {
    type: 'FunctionStatement',
    name,
    parameters: constructorParameters,
    body: { type: 'BlockStatement', statements: bodyStatements, line },
    line,
    ...(stmt.leadingComments?.length ? { leadingComments: stmt.leadingComments } : {}),
  };
}
