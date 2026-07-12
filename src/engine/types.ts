// ============================================================
// Hangzhou Mahjong (杭州麻将) - Core Type Definitions
// ============================================================

// === Tile System ===

export type Suit = 'wan' | 'tiao' | 'tong';
export type HonorName = 'east' | 'south' | 'west' | 'north' | 'zhong' | 'fa' | 'bai';

export interface SuitTile {
  suit: Suit;
  rank: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
}

export interface HonorTile {
  honor: HonorName;
}

export type TileType = SuitTile | HonorTile;

export interface Tile {
  id: string;
  type: TileType;
}

// === Meld System ===

export type MeldKind = 'chi' | 'pong' | 'mingkong' | 'ankong' | 'jiagang';

export interface Meld {
  kind: MeldKind;
  tiles: Tile[];
  discardFrom?: number; // Player index who discarded the claimed tile
}

// === Player State ===

export interface PlayerState {
  index: number; // 0-3, where 0 = human (bottom)
  hand: Tile[];
  melds: Meld[];
  discards: Tile[]; // River/discard history
  isDealer: boolean;
  isHuman: boolean;
  score: number; // Cumulative score across rounds
  name: string;
}

// === Reaction System ===

export type ReactionKind = 'chi' | 'pong' | 'kong' | 'hu' | 'pass';

export interface ChiOption {
  tiles: Tile[]; // The 2 tiles from hand that complete the chi
}

export interface Reaction {
  kind: ReactionKind;
  playerIndex: number;
  chiOptions?: ChiOption[];
  kongType?: 'mingkong' | 'ankong' | 'jiagang';
  kongTile?: Tile;
}

// === Win Detection ===

export type WinForm = 'standard' | 'sevenPairs';

export interface WinResult {
  winner: number;
  form: WinForm;
  fromWall: boolean; // Self-draw (true) vs discard win (false)
  isBaoTou: boolean; // 爆头: 1 fortune + 4 melds, any drawn tile completes pair
  isCaiPiao: boolean; // 财飘: won after discarding fortune tile(s) in previous turn
  piaoCount: number; // How many fortune tiles floated
  isGangKai: boolean; // 杠开: won from kong replacement draw
  gangCount: number; // Number of kongs before winning
  isGangBao: boolean; // 杠爆: kong + 爆头
  hasFortune: boolean; // Hand contains fortune tile
  isPure: boolean; // No fortune tile used in winning hand
  isLuxury: boolean; // 豪华: 4-of-a-kind used as 2 pairs in 七对
  luxuryCount: number; // How many luxury sets in 七对
  isQingYiSe: boolean; // 清一色: all tiles from same suit
  isHunYiSe: boolean; // 混一色: one suit + honors
  isZiYiSe: boolean; // 字一色: all honors
  melds: Meld[]; // Decomposed winning hand (4 melds)
  pair: [Tile, Tile]; // The winning pair
}

// === Game Phase ===

export type GamePhase =
  | 'idle'
  | 'dealing'
  | 'player_turn'
  | 'awaiting_discard'
  | 'awaiting_reactions'
  | 'processing_reaction'
  | 'replacement_draw'
  | 'declaring_win'
  | 'round_over'
  | 'game_over';

// === Game Event ===

export type GameEventKind =
  | 'deal'
  | 'draw'
  | 'discard'
  | 'chi'
  | 'pong'
  | 'kong'
  | 'hu'
  | 'pass'
  | 'round_start'
  | 'round_end';

export interface GameEvent {
  kind: GameEventKind;
  playerIndex: number;
  tile?: Tile;
  timestamp: number;
  description: string;
}

// === Settings ===

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export interface PlayerNames {
  human: string;
  ai1: string;
  ai2: string;
  ai3: string;
}

export interface GameSettings {
  humanPlayerIndex: number; // Always 0
  aiDifficulty: AIDifficulty;
  animationSpeed: 'slow' | 'normal' | 'fast';
  baseScore: number; // Default 10, range 1-20
  initialScore: number; // Default 1000
  soundEnabled: boolean;
  playerNames: PlayerNames;
}

// === Complete Game State ===

export interface GameState {
  wall: Tile[];
  deadWall: Tile[];
  players: [PlayerState, PlayerState, PlayerState, PlayerState];
  currentPlayerIndex: number;
  phase: GamePhase;
  fortuneTile: TileType | null; // The 财神 tile type (白板). Null before round starts.
  dealerIndex: number;
  laoCount: number; // 1, 2, 3+ (consecutive dealer wins)
  lastDiscard: { tile: Tile; playerIndex: number } | null;
  pendingReactions: Reaction[];
  responders: number[]; // Player indices that have passed
  turnCount: number;
  eventLog: GameEvent[];
  settings: GameSettings;
  // Track exposure counts for 三摊承包
  // Key: "fromPlayerIndex->toPlayerIndex", value: count
  exposureCounts: Record<string, number>;
  // Track discards this round for 漏胡/漏碰
  currentRoundDiscards: { tile: TileType; playerIndex: number }[];
  // Track tile types each player passed on (for 漏胡/漏碰)
  // Key: playerIndex, Value: set of tile type codes they passed on
  passedReactions: Record<number, Set<number>>;
  // 财飘 tracking
  piaoTracker: {
    active: boolean;
    playerIndex: number;
    count: number; // How many times fortune was floated consecutively
  };
  // Last win result for displaying on the win screen
  lastWinResult?: WinResult | null;
  lastWinnerIndex?: number | null;
  lastWinFromDiscard?: boolean;
  lastDiscarderIndex?: number | null;
  // Last drawn tile (for display on the right side)
  lastDrawnTile?: Tile | null;
  // Payout details for the win screen
  lastPayouts?: PayoutEntry[];
  // Win count statistics for each player
  winCounts: [number, number, number, number];
  // Whether the current awaiting_discard phase came from a wall draw (can self-hu)
  // vs from chi/pong (cannot self-hu). Kong replacement draw counts as wall draw.
  drewFromWall: boolean;
  // Whether the current draw was from a kong replacement (for 杠开/杠爆 detection)
  drewFromKong: boolean;
}

// === Scoring ===

export interface PayoutEntry {
  fromPlayer: number;
  toPlayer: number;
  amount: number;
  reason: string;
}

// === AI Types ===

export type AIActionKind =
  | 'discard'
  | 'chi'
  | 'pong'
  | 'kong'
  | 'hu'
  | 'pass'
  | 'caiPiao';

export interface AIActionDiscard {
  kind: 'discard';
  tileId: string;
}

export interface AIActionChi {
  kind: 'chi';
  chiOptionIndex: number;
}

export interface AIActionPong {
  kind: 'pong';
}

export interface AIActionKong {
  kind: 'kong';
  kongType: 'mingkong' | 'ankong' | 'jiagang';
  tileId?: string;
}

export interface AIActionHu {
  kind: 'hu';
}

export interface AIActionPass {
  kind: 'pass';
}

export interface AIActionCaiPiao {
  kind: 'caiPiao';
  tileId: string; // The fortune tile to discard
}

export type AIAction =
  | AIActionDiscard
  | AIActionChi
  | AIActionPong
  | AIActionKong
  | AIActionHu
  | AIActionPass
  | AIActionCaiPiao;
