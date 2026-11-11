/** Calculadora de ICM (modelo Malmuth-Harville). Sin red ni base de datos. */

export const ICM_MAX_PLAYERS = 10;

export interface IcmRow {
  /** Posición en la lista de entrada. */
  index: number;
  stack: number;
  /** % de fichas sobre el total. */
  chipPct: number;
  /** Valor en € de ese stack según ICM. */
  equity: number;
  /** % de la bolsa de premios que vale el stack. */
  equityPct: number;
  /** Lo que valdría si las fichas valieran lo mismo (fichas × bolsa / total). */
  chipValue: number;
  /** equity − chipValue: positivo = las fichas valen menos que su peso en premio (stack corto protegido). */
  diff: number;
}

/**
 * Equity ICM de cada jugador. `payouts[0]` es el premio del 1.º, etc.
 * Si hay menos premios que jugadores, el resto cobra 0. Programación dinámica sobre
 * subconjuntos de jugadores ya clasificados: O(2^n · n).
 */
export function icmEquity(stacks: number[], payouts: number[]): number[] {
  const n = stacks.length;
  if (n === 0) return [];
  if (n > ICM_MAX_PLAYERS) throw new Error(`Máximo ${ICM_MAX_PLAYERS} jugadores`);
  const total = stacks.reduce((a, b) => a + b, 0);
  const eq = new Array<number>(n).fill(0);
  if (total <= 0) return eq;
  const pay = (k: number) => payouts[k] ?? 0;
  const size = 1 << n;
  const prob = new Float64Array(size);
  const sum = new Float64Array(size);
  for (let m = 1; m < size; m++) {
    const low = m & -m;
    sum[m] = sum[m ^ low] + stacks[31 - Math.clz32(low)];
  }
  prob[0] = 1;
  for (let m = 0; m < size - 1; m++) {
    const p = prob[m];
    if (p === 0) continue;
    const rem = total - sum[m];
    if (rem <= 0) continue;
    let place = 0;
    for (let x = m; x; x &= x - 1) place++;
    const prize = pay(place);
    for (let j = 0; j < n; j++) {
      if (m & (1 << j) || stacks[j] <= 0) continue;
      const q = (p * stacks[j]) / rem;
      prob[m | (1 << j)] += q;
      eq[j] += q * prize;
    }
  }
  // Los jugadores sin fichas ocupan los últimos puestos (empate técnico entre ellos: reparto igual).
  const zeros = stacks.map((s, i) => (s <= 0 ? i : -1)).filter((i) => i >= 0);
  if (zeros.length) {
    const alive = n - zeros.length;
    const share = zeros.reduce((acc, _z, k) => acc + pay(alive + k), 0) / zeros.length;
    for (const z of zeros) eq[z] = share;
  }
  return eq;
}

export function icmTable(stacks: number[], payouts: number[]): IcmRow[] {
  const eq = icmEquity(stacks, payouts);
  const total = stacks.reduce((a, b) => a + b, 0);
  const pool = payouts.reduce((a, b) => a + b, 0);
  return stacks.map((stack, index) => {
    const chipValue = total > 0 ? (stack / total) * pool : 0;
    return {
      index,
      stack,
      chipPct: total > 0 ? (stack / total) * 100 : 0,
      equity: eq[index],
      equityPct: pool > 0 ? (eq[index] / pool) * 100 : 0,
      chipValue,
      diff: eq[index] - chipValue,
    };
  });
}

/** Repartos habituales como % de la bolsa, por número de puestos pagados. */
export const PAYOUT_PRESETS: { label: string; pct: number[] }[] = [
  { label: '2 puestos 65/35', pct: [65, 35] },
  { label: '3 puestos 50/30/20', pct: [50, 30, 20] },
  { label: '4 puestos 45/28/17/10', pct: [45, 28, 17, 10] },
  { label: '5 puestos 40/25/18/10/7', pct: [40, 25, 18, 10, 7] },
  { label: 'Ganador se lo lleva todo', pct: [100] },
];
