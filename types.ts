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