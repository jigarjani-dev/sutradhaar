export interface Agent {
  name: string;
  status: 'idle' | 'thinking' | 'error';
  tools: string[];
  card_url?: string;
  description?: string;
}

export interface LogEntry {
  agent: string;
  type: 'message' | 'tool_call' | 'handoff' | 'error' | 'a2a_task' | string;
  text: string;
  ts: number;
}

export interface WSMessage {
  type: string;
  data: Record<string, any>;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent?: string;
}
