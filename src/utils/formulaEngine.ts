/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// A small, safe arithmetic expression engine for admin-defined KPI formulas (e.g.
// "(PC-(NC1*2+NC2))/PC*100"). Deliberately NOT eval()/Function()-based: a formula string is
// admin-authored data that gets evaluated in every user's browser (Saisie KPIs live preview) and
// on the server — treating it as executable JS would let a compromised or careless admin account
// run arbitrary code in every other user's session. Instead this parses into a small AST over
// +, -, *, /, unary minus, parentheses, numbers and bare identifiers, and only ever evaluates
// that AST numerically.

type Token =
  | { type: 'num'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' }
  | { type: 'lparen' }
  | { type: 'rparen' };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
    if (c === ')') { tokens.push({ type: 'rparen' }); i++; continue; }
    if (c === '+' || c === '-' || c === '*' || c === '/') { tokens.push({ type: 'op', value: c }); i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      let sawDot = false;
      while (j < expr.length && (/[0-9]/.test(expr[j]) || (expr[j] === '.' && !sawDot))) {
        if (expr[j] === '.') sawDot = true;
        j++;
      }
      const raw = expr.slice(i, j);
      const value = Number(raw);
      if (Number.isNaN(value)) throw new Error(`Nombre invalide : "${raw}"`);
      tokens.push({ type: 'num', value });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < expr.length && /[A-Za-z0-9_]/.test(expr[j])) j++;
      tokens.push({ type: 'ident', value: expr.slice(i, j) });
      i = j;
      continue;
    }
    throw new Error(`Caractère non reconnu : "${c}"`);
  }
  return tokens;
}

type AstNode =
  | { kind: 'num'; value: number }
  | { kind: 'ident'; name: string }
  | { kind: 'binop'; op: '+' | '-' | '*' | '/'; left: AstNode; right: AstNode }
  | { kind: 'neg'; value: AstNode };

// Recursive-descent parser: expr := term (('+'|'-') term)* ; term := factor (('*'|'/') factor)* ;
// factor := '-' factor | NUM | IDENT | '(' expr ')'
function parse(tokens: Token[]): AstNode {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpr(): AstNode {
    let node = parseTerm();
    while (peek() && peek().type === 'op' && (peek() as any).value !== '*' && (peek() as any).value !== '/') {
      const op = (next() as { type: 'op'; value: '+' | '-' }).value;
      const right = parseTerm();
      node = { kind: 'binop', op, left: node, right };
    }
    return node;
  }

  function parseTerm(): AstNode {
    let node = parseFactor();
    while (peek() && peek().type === 'op' && ((peek() as any).value === '*' || (peek() as any).value === '/')) {
      const op = (next() as { type: 'op'; value: '*' | '/' }).value;
      const right = parseFactor();
      node = { kind: 'binop', op, left: node, right };
    }
    return node;
  }

  function parseFactor(): AstNode {
    const tok = peek();
    if (!tok) throw new Error('Expression incomplète.');
    if (tok.type === 'op' && tok.value === '-') {
      next();
      return { kind: 'neg', value: parseFactor() };
    }
    if (tok.type === 'op' && tok.value === '+') {
      next();
      return parseFactor();
    }
    if (tok.type === 'num') { next(); return { kind: 'num', value: tok.value }; }
    if (tok.type === 'ident') { next(); return { kind: 'ident', name: tok.value }; }
    if (tok.type === 'lparen') {
      next();
      const inner = parseExpr();
      const closing = next();
      if (!closing || closing.type !== 'rparen') throw new Error('Parenthèse fermante manquante.');
      return inner;
    }
    throw new Error('Expression invalide.');
  }

  const result = parseExpr();
  if (pos < tokens.length) throw new Error('Caractères inattendus en fin de formule.');
  return result;
}

function collectIdentifiers(node: AstNode, out: Set<string>): void {
  if (node.kind === 'ident') out.add(node.name);
  else if (node.kind === 'neg') collectIdentifiers(node.value, out);
  else if (node.kind === 'binop') { collectIdentifiers(node.left, out); collectIdentifiers(node.right, out); }
}

export interface FormulaValidation {
  valid: boolean;
  error?: string;
  identifiers: string[];
}

// Parses the formula and reports every identifier it references, without evaluating it — used
// by the admin UI to build/validate the alias-to-KPI mapping as the formula is typed.
export function validateFormula(expr: string): FormulaValidation {
  if (!expr || !expr.trim()) return { valid: false, error: 'La formule est vide.', identifiers: [] };
  try {
    const ast = parse(tokenize(expr));
    const idents = new Set<string>();
    collectIdentifiers(ast, idents);
    return { valid: true, identifiers: Array.from(idents) };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Formule invalide.', identifiers: [] };
  }
}

function evalNode(node: AstNode, variables: Record<string, number | null | undefined>): number | null {
  switch (node.kind) {
    case 'num':
      return node.value;
    case 'ident': {
      const v = variables[node.name];
      return v === null || v === undefined ? null : v;
    }
    case 'neg': {
      const v = evalNode(node.value, variables);
      return v === null ? null : -v;
    }
    case 'binop': {
      const l = evalNode(node.left, variables);
      const r = evalNode(node.right, variables);
      if (l === null || r === null) return null;
      switch (node.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return r === 0 ? null : l / r;
      }
    }
  }
}

// Evaluates a formula against a set of variable values. Returns null (rather than NaN/Infinity)
// whenever a referenced variable is missing/null or a division by zero occurs — "can't compute
// yet" is a first-class result throughout this app's KPI value logic, not an error.
export function evaluateFormula(expr: string, variables: Record<string, number | null | undefined>): number | null {
  try {
    const ast = parse(tokenize(expr));
    return evalNode(ast, variables);
  } catch {
    return null;
  }
}
