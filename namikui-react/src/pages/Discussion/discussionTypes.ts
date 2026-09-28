export interface ChatMessage {
  user: string;
  role: string;
  text: string;
  timestamp: string;
}

export interface PollOption {
  text: string;
  votes: string[];
}

export interface Poll {
  id: number;
  question: string;
  options: PollOption[];
  expiresAt: number;
  createdBy?: string;
}

export interface OfficialNotice {
  id: number;
  title: string;
  content: string;
  date: string;
  author?: string;
}

export interface PollFields {
  question: string;
  options: PollOption[];
  timerSecs: number;
}
