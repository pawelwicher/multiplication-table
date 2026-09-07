/** Drzewo wyrażenia arytmetycznego. Czysty TypeScript — bez Angulara i bez I/O. */

export type Op = '+' | '-' | '*' | '/';

export type Expr =
  | { readonly kind: 'num'; readonly value: number }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'bin'; readonly op: Op; readonly left: Expr; readonly right: Expr };

export const OP_SYMBOL: Readonly<Record<Op, string>> = {
  '+': '+',
  '-': '\u2212',
  '*': '\u00d7',
  '/': '\u00f7',
};

const PRECEDENCE: Readonly<Record<Op, number>> = { '+': 1, '-': 1, '*': 2, '/': 2 };

export function num(value: number): Expr {
  return { kind: 'num', value };
}

export function bin(op: Op, left: Expr, right: Expr): Expr {
  return { kind: 'bin', op, left, right };
}

export const UNKNOWN: Expr = { kind: 'unknown' };

/** Rzuca, gdy dzielenie nie jest całkowite, gdy dzielimy przez zero albo gdy brakuje wartości x. */
export function evaluate(expr: Expr, unknownValue?: number): number {
  switch (expr.kind) {
    case 'num':
      return expr.value;
    case 'unknown':
      if (unknownValue === undefined) throw new Error('Brak wartości niewiadomej');
      return unknownValue;
    case 'bin': {
      const a = evaluate(expr.left, unknownValue);
      const b = evaluate(expr.right, unknownValue);
      switch (expr.op) {
        case '+':
          return a + b;
        case '-':
          return a - b;
        case '*':
          return a * b;
        case '/':
          if (b === 0) throw new Error('Dzielenie przez zero');
          if (a % b !== 0) throw new Error('Dzielenie niecałkowite');
          return a / b;
      }
    }
  }
}

/** Bezpieczna ewaluacja — zamiast rzucać zwraca null. */
export function tryEvaluate(expr: Expr, unknownValue?: number): number | null {
  try {
    return evaluate(expr, unknownValue);
  } catch {
    return null;
  }
}

function needsParens(child: Expr, parentOp: Op, isRight: boolean): boolean {
  if (child.kind !== 'bin') return false;
  const p = PRECEDENCE[child.op];
  const parent = PRECEDENCE[parentOp];
  if (p < parent) return true;
  // a − (b + c) oraz a ÷ (b × c) wymagają nawiasu mimo równego priorytetu.
  return p === parent && isRight && (parentOp === '-' || parentOp === '/');
}

export function format(expr: Expr): string {
  switch (expr.kind) {
    case 'num':
      return String(expr.value);
    case 'unknown':
      return 'x';
    case 'bin': {
      const left = needsParens(expr.left, expr.op, false)
        ? `(${format(expr.left)})`
        : format(expr.left);
      const right = needsParens(expr.right, expr.op, true)
        ? `(${format(expr.right)})`
        : format(expr.right);
      return `${left} ${OP_SYMBOL[expr.op]} ${right}`;
    }
  }
}

export function hasParens(expr: Expr): boolean {
  if (expr.kind !== 'bin') return false;
  return (
    needsParens(expr.left, expr.op, false) ||
    needsParens(expr.right, expr.op, true) ||
    hasParens(expr.left) ||
    hasParens(expr.right)
  );
}

export function hasUnknown(expr: Expr): boolean {
  if (expr.kind === 'unknown') return true;
  if (expr.kind !== 'bin') return false;
  return hasUnknown(expr.left) || hasUnknown(expr.right);
}

/** Wszystkie wystąpienia operatorów, z powtórzeniami. */
export function operatorList(expr: Expr): Op[] {
  if (expr.kind !== 'bin') return [];
  return [expr.op, ...operatorList(expr.left), ...operatorList(expr.right)];
}

export function countLeaves(expr: Expr): number {
  if (expr.kind !== 'bin') return 1;
  return countLeaves(expr.left) + countLeaves(expr.right);
}

/** Wartości wszystkich liczb, w kolejności od lewej. */
export function numbers(expr: Expr): number[] {
  if (expr.kind === 'num') return [expr.value];
  if (expr.kind !== 'bin') return [];
  return [...numbers(expr.left), ...numbers(expr.right)];
}

/** Zamienia n-tą liczbę (licząc od lewej, od zera) na niewiadomą x. */
export function replaceNumberWithUnknown(expr: Expr, index: number): Expr {
  let seen = 0;
  const walk = (node: Expr): Expr => {
    if (node.kind === 'num') {
      return seen++ === index ? UNKNOWN : node;
    }
    if (node.kind !== 'bin') return node;
    const left = walk(node.left);
    const right = walk(node.right);
    return left === node.left && right === node.right ? node : bin(node.op, left, right);
  };
  return walk(expr);
}
