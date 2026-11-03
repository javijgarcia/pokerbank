export type GameType = 'cash' | 'tournament';
export type Venue = 'live' | 'online';

export interface Bank {
  id: string;
  name: string;
  initial_amount: number;
  archived: boolean;
  created_at: string;
}

export interface Movement {
  id: string;
  bank_id: string;
  amount: number; // >0 ingreso, <0 retirada
  note: string | null;
  occurred_at: string;
}

export interface Session {
  id: string;
  bank_id: string;
  game_type: GameType;
  venue: Venue;
  place: string | null;
  stake: number | null;
  buy_in: number;
  cash_out: number;
  entries: number;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  mood: number | null;
  play_quality: number | null;
  notes: string | null;
  tags: string[];
  players: number | null;
  position: number | null;
}

export interface LevelRule {
  id: string;
  bank_id: string;
  game_type: GameType;
  buyins: number;
  down_buyins: number;
  ladder: number[];
}

export type GoalKind = 'monthly_profit' | 'monthly_hours' | 'bank_target';

export interface Goal {
  id: string;
  bank_id: string | null;
  kind: GoalKind;
  target: number;
}

export interface Preset {
  id: string;
  bank_id: string;
  name: string;
  game_type: GameType;
  venue: Venue;
  place: string | null;
  stake: number | null;
  buy_in: number | null;
}

/** Sesión en curso (solo vive en este dispositivo hasta que se cierra). */
export interface ActiveSession {
  id: string;
  bank_id: string;
  game_type: GameType;
  venue: Venue;
  place: string;
  stake: number | null;
  buy_in: number; // total invertido hasta ahora
  entries: number;
  started_at: number; // ms epoch
  paused_total_ms: number;
  paused_at: number | null;
}

export const DEFAULT_LADDER: Record<GameType, number[]> = {
  cash: [2, 5, 10, 25, 50, 100, 200, 500],
  tournament: [1, 2, 5, 10, 20, 50, 100, 200, 500],
};

export const DEFAULT_BUYINS: Record<GameType, { buyins: number; down_buyins: number }> = {
  cash: { buyins: 100, down_buyins: 70 },
  tournament: { buyins: 100, down_buyins: 70 }, // ABI = 1% del bank
};
