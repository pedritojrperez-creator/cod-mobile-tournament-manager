
export interface Player {
  id: string;
  name: string;
  uid: string;
  image: string; // Base64 or URL
  score: number;
  active: boolean; // For tournament availability
}

export interface Team {
  id: string;
  name: string;
  color: string; // Tailwind color class e.g. 'bg-red-600'
  members: Player[];
}

export interface ChartData {
  name: string;
  score: number;
  image: string;
}

export enum PageView {
  HOME = 'HOME',
  REGISTER = 'REGISTER',
  REMOVE = 'REMOVE',
  RANKING = 'RANKING',
  TOURNAMENT = 'TOURNAMENT',
  BRACKET = 'BRACKET'
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export enum ImageSize {
  SIZE_1K = '1K',
  SIZE_2K = '2K',
  SIZE_4K = '4K'
}

export interface VsMatch {
  id: string;
  roundIndex: number;
  matchIndex: number;
  p1: Player | null; // Null implies TBD (waiting for previous round)
  p2: Player | null; // Null implies TBD or Bye
  winner: Player | null;
}

export interface ScannedMatchData {
  tempId: string;
  extractedName: string; // Name found in image
  matchedPlayerId: string | null; // ID from your DB (or null if not found)
  teamResult: 'WIN' | 'LOSS';
  kills: number;
  isMvp: boolean;
  // Calculated locally for verification
  pointsKills: number;
  pointsTeam: number;
  pointsMvp: number;
  totalPoints: number;
}

export interface RankingHistoryEntry {
  id: string;
  date: string;
  label: string; // e.g., "Week 1 - Oct 24"
  snapshot: Player[]; // Copy of players at that moment
}
