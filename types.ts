
export enum NodeType {
  IDEA = 'IDEA',
  SCRIPT = 'SCRIPT',
  STORYBOARD = 'STORYBOARD',
}

export interface ImagePrompts {
  gemini: string; // Natural language, descriptive
  midjourney: string; // Keyword heavy, params like --ar 16:9
}

export interface Character {
  id: string;
  name: string;
  description: string; // 视觉描述
  imagePrompts?: ImagePrompts;
}

export interface StoryboardShot {
  id: string; // "1", "2"
  visual: string; // 画面描述
  audio: string; // 声音/对白
  camera: string; // 景别/运镜
  character: string; // 人物描述 (基于 Character 定义)
  background: string; // 背景描述 (保持上下文一致)
  startTime: string; // 开始时间
  duration: string; // 持续时长
  bgPrompts?: ImagePrompts; // 纯背景提示词
  compositePrompts?: ImagePrompts; // 人物+环境+动作合成提示词
}

// --- New Types for Keyframes & Video ---

export interface KeyframeData {
  shotId: string;
  frames: string[]; // 12 descriptions corresponding to the timeline of the shot
  videoGenPrompt?: string; // The final prompt for video generation (Veo/Sora)
}

// --- Timeline Editor Types ---

export type TrackType = 'VIDEO' | 'AUDIO' | 'SUBTITLE';

export interface TimelineItem {
  id: string;
  shotId?: string; // Linked storyboard shot
  content: string; // Could be prompt text, or eventually file URL
  startTime: number; // Absolute timeline start (seconds)
  duration: number; // Seconds
  color?: string;
}

export interface TimelineTrack {
  id: string;
  label: string;
  type: TrackType;
  items: TimelineItem[];
}

export interface NodeData {
  id: string;
  type: NodeType;
  prompt: string; // used as content for idea/script
  selectedModel?: string;
  title?: string;
  shots?: StoryboardShot[];
  parentId?: string;
  isLoading?: boolean;
  error?: string;
}

export interface ScriptVersion {
  id: string;
  title: string; // e.g., "悬疑风格", "喜剧风格"
  content: string;
  isGenerating?: boolean;
}

export interface ProjectState {
  idea: string;
  scripts: ScriptVersion[];
  activeScriptId: string | null;
  characters: Character[];
  storyboard: StoryboardShot[];
  // New States
  keyframes: Record<string, KeyframeData>; // Map shotId to KeyframeData
  timeline: TimelineTrack[];
  
  isGeneratingScripts: boolean;
  isGeneratingCharacters: boolean;
  isGeneratingStoryboard: boolean;
  isGeneratingKeyframes: boolean;
  error?: string;
}

export type ScriptAction = 'REWRITE' | 'EXPAND' | 'POLISH' | 'DECONSTRUCT';

// --- Knowledge Graph Types ---

export interface KGEntity {
  id: string;
  label: string; // e.g., "赛博朋克", "张三", "复仇"
  type: 'THEME' | 'CHARACTER' | 'STYLE' | 'OBJECT' | 'LOCATION' | 'LIGHTING' | 'CAMERA';
  weight: number; // Frequency of usage
  scopeId: string; // 'global' or scriptId
}

export interface KGRelation {
  source: string; // Entity ID
  target: string; // Entity ID
  label: string; // e.g., "is_a", "belongs_to", "opposes"
  scopeId: string; // 'global' or scriptId
}

export interface KnowledgeGraph {
  nodes: KGEntity[];
  links: KGRelation[];
}

// --- Logs & Stats Types ---

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'ai';
}

export interface TokenStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number; // Estimated in USD
}
