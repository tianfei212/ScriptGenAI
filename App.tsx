
import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  PenTool, 
  Clapperboard, 
  Layout, 
  Film, 
  Wand2, 
  Maximize2, 
  Save, 
  Trash2,
  ChevronRight,
  Loader2,
  MessageSquarePlus,
  Eraser,
  RefreshCw,
  Settings2,
  Image as ImageIcon,
  Plus,
  Languages,
  Users,
  User,
  Download,
  AlertTriangle,
  XCircle,
  Edit3,
  Network,
  Share2,
  Map as MapIcon,
  Grid,
  Search,
  Eye,
  Video,
  Scissors,
  Layers,
  Terminal,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Palette,
  Files,
  Copy,
  Play,
  Pause,
  Music,
  Type as TypeIcon,
  Clock,
  Zap
} from 'lucide-react';
import { generateScriptVariations, modifyScript, generateStoryboard, translateText, translateStoryboardData, generateCharacters, translateCharacters, generateImagePrompts, refineImagePrompt, generateKeyframeBreakdown, generateVideoGenerationPrompt } from './services/geminiService';
import { getScopedGraph, simulateRetrieval, extractAndStoreKnowledge } from './services/knowledgeService';
import { ProjectState, ScriptVersion, StoryboardShot, ScriptAction, Character, KnowledgeGraph, LogEntry, TokenStats, ImagePrompts, TimelineTrack, TimelineItem, KeyframeData } from './types';
import GraphView from './components/GraphView';

const TOOLBAR_BTN_CLASS = "px-2 py-1 rounded text-xs font-medium flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

// Google Gemini 1.5 Pro Pricing Estimates (as fallback for Gemini 3 which is preview)
// Input: $3.50 / 1M tokens (<128k context)
// Output: $10.50 / 1M tokens
const PRICE_INPUT_PER_MILLION = 3.50;
const PRICE_OUTPUT_PER_MILLION = 10.50;

// --- Modal Component for Prompt Editing ---
const PromptEditorModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  prompts: ImagePrompts;
  onSave: (newPrompts: ImagePrompts) => void;
  onRegenerate: () => Promise<void>; // Added Prop
}> = ({ isOpen, onClose, title, prompts, onSave, onRegenerate }) => {
  const [geminiPrompt, setGeminiPrompt] = useState(prompts.gemini);
  const [mjPrompt, setMjPrompt] = useState(prompts.midjourney);
  const [refineInput, setRefineInput] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    setGeminiPrompt(prompts.gemini);
    setMjPrompt(prompts.midjourney);
  }, [prompts, isOpen]);

  const handleRefine = async () => {
    if (!refineInput.trim()) return;
    setIsRefining(true);
    try {
      const refined = await refineImagePrompt({ gemini: geminiPrompt, midjourney: mjPrompt }, refineInput);
      setGeminiPrompt(refined.gemini);
      setMjPrompt(refined.midjourney);
      setRefineInput("");
    } catch (e) {
      alert("修改失败，请重试");
    } finally {
      setIsRefining(false);
    }
  };

  const handleFullRegenerate = async () => {
    if (!window.confirm("确定要完全重新生成当前的提示词吗？当前的手动修改将丢失。")) return;
    setIsRegenerating(true);
    try {
        await onRegenerate();
    } catch(e) {
        console.error(e);
    } finally {
        setIsRegenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!isOpen) return null;

  return (
     <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] animate-fade-in-up">
           <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-850">
              <h3 className="font-bold flex items-center gap-2 text-indigo-400"><Palette className="w-5 h-5"/> {title}</h3>
              <button onClick={onClose}><XCircle className="w-5 h-5 text-gray-500 hover:text-white"/></button>
           </div>
           <div className="flex-1 overflow-y-auto p-6 space-y-6 relative">
              {isRegenerating && (
                  <div className="absolute inset-0 bg-gray-900/80 z-10 flex flex-col items-center justify-center text-blue-400 gap-3">
                      <Loader2 className="w-8 h-8 animate-spin"/>
                      <span className="text-sm font-medium">正在重新生成提示词...</span>
                  </div>
              )}

              {/* Gemini Section */}
              <div className="space-y-2">
                 <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-blue-300">Gemini 3 Image Prompt</label>
                    <button onClick={() => copyToClipboard(geminiPrompt)} className="text-xs text-gray-500 hover:text-white flex items-center gap-1"><Copy className="w-3 h-3"/> Copy</button>
                 </div>
                 <textarea 
                    value={geminiPrompt} 
                    onChange={(e) => setGeminiPrompt(e.target.value)}
                    className="w-full h-32 bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm focus:border-blue-500 focus:outline-none resize-none"
                 />
              </div>

              {/* MJ Section */}
              <div className="space-y-2">
                 <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-purple-300">Midjourney Prompt</label>
                    <button onClick={() => copyToClipboard(mjPrompt)} className="text-xs text-gray-500 hover:text-white flex items-center gap-1"><Copy className="w-3 h-3"/> Copy</button>
                 </div>
                 <textarea 
                    value={mjPrompt} 
                    onChange={(e) => setMjPrompt(e.target.value)}
                    className="w-full h-24 bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm focus:border-purple-500 focus:outline-none resize-none font-mono text-xs"
                 />
              </div>

              {/* Refine Section */}
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 space-y-3">
                 <label className="text-sm font-semibold text-gray-300 flex items-center gap-2"><Wand2 className="w-4 h-4"/> AI 局部修改 (Refine)</label>
                 <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="例如：把光线调暗一点，增加赛博朋克风格..."
                      value={refineInput}
                      onChange={(e) => setRefineInput(e.target.value)}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 text-sm focus:border-indigo-500 outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                    />
                    <button 
                      onClick={handleRefine} 
                      disabled={isRefining || !refineInput.trim()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white rounded text-sm font-medium flex items-center gap-2"
                    >
                       {isRefining ? <Loader2 className="w-4 h-4 animate-spin"/> : "修改"}
                    </button>
                 </div>
              </div>
           </div>
           <div className="p-4 border-t border-gray-800 bg-gray-850/50 flex justify-between items-center">
              <button 
                onClick={handleFullRegenerate}
                disabled={isRegenerating}
                className="flex items-center gap-2 px-4 py-2 text-yellow-500 hover:text-yellow-400 hover:bg-yellow-900/20 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                 <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`}/> 完全重新生成
              </button>
              
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">取消</button>
                <button onClick={() => { onSave({gemini: geminiPrompt, midjourney: mjPrompt}); onClose(); }} className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg">保存更改</button>
              </div>
           </div>
        </div>
     </div>
  );
};


export default function App() {
  // --- State ---
  const [isApiKeySet, setIsApiKeySet] = useState<boolean>(false);
  const [project, setProject] = useState<ProjectState>({
    idea: '',
    scripts: [],
    activeScriptId: null,
    characters: [],
    storyboard: [],
    keyframes: {},
    timeline: [
      { id: 'video-1', label: 'Video Track 1', type: 'VIDEO', items: [] },
      { id: 'audio-1', label: 'Audio Track 1', type: 'AUDIO', items: [] },
      { id: 'sub-1', label: 'Subtitles', type: 'SUBTITLE', items: [] },
    ],
    isGeneratingScripts: false,
    isGeneratingCharacters: false,
    isGeneratingStoryboard: false,
    isGeneratingKeyframes: false, // Global flag for "Generate All"
  });

  const [targetDuration, setTargetDuration] = useState("1分钟");
  const [showTimeline, setShowTimeline] = useState(false);
  
  // Loading States for individual items
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [isGeneratingAllVideoPrompts, setIsGeneratingAllVideoPrompts] = useState(false);

  // Stats & Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tokenStats, setTokenStats] = useState<TokenStats>({ totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0 });
  const [isLogOpen, setIsLogOpen] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Loading states (Global)
  const [isTranslatingIdea, setIsTranslatingIdea] = useState(false);
  const [isTranslatingScript, setIsTranslatingScript] = useState(false);
  const [isTranslatingCharacters, setIsTranslatingCharacters] = useState(false);
  const [isTranslatingStoryboard, setIsTranslatingStoryboard] = useState(false);
  
  // Genre & Director State
  const [selectedGenre, setSelectedGenre] = useState<string>('auto');
  const [customGenre, setCustomGenre] = useState<string>('');
  const [selectedDirector, setSelectedDirector] = useState<string>('none');
  const [customDirector, setCustomDirector] = useState<string>('');

  // Script Editor
  const [activeTabPrompt, setActiveTabPrompt] = useState('');
  const [modifying, setModifying] = useState(false);

  // Modification Modal
  const [modifyModalOpen, setModifyModalOpen] = useState(false);
  const [modifyAction, setModifyAction] = useState<ScriptAction | null>(null);
  const [modifyInstruction, setModifyInstruction] = useState('');

  // Prompt Editor Modal
  const [promptModal, setPromptModal] = useState<{
    isOpen: boolean;
    type: 'CHAR' | 'BG' | 'COMPOSITE';
    id: string; // character id or shot id
    prompts: ImagePrompts;
    title: string;
  }>({
    isOpen: false,
    type: 'CHAR',
    id: '',
    prompts: { gemini: '', midjourney: '' },
    title: ''
  });

  // Knowledge Graph Modal
  const [kgModalOpen, setKgModalOpen] = useState(false);
  const [kgData, setKgData] = useState<KnowledgeGraph>({ nodes: [], links: [] });
  const [kgViewMode, setKgViewMode] = useState<'ALL' | 'CHARACTER' | 'LOCATION' | 'VISUAL'>('ALL');
  
  // RAG Visualization
  const [ragQuery, setRagQuery] = useState('');
  const [ragHighlights, setRagHighlights] = useState<Set<string>>(new Set());

  // --- Effects ---
  useEffect(() => {
    const checkKey = async () => {
      try {
        const aistudio = (window as any).aistudio;
        if (aistudio && await aistudio.hasSelectedApiKey()) {
          setIsApiKeySet(true);
        }
      } catch (e) { console.warn(e); }
    };
    checkKey();
  }, []);

  // Update editor text when active script changes
  useEffect(() => {
    if (project.activeScriptId) {
      const script = project.scripts.find(s => s.id === project.activeScriptId);
      if (script) {
        // Only update if prompt is different to avoid cursor jumps if we were syncing constantly (which we aren't, but good practice)
        setActiveTabPrompt(script.content);
      }
    }
  }, [project.activeScriptId, project.scripts]);

  // Listen for KG updates and refresh KG view if open
  useEffect(() => {
    const handleKgUpdate = () => {
       if (kgModalOpen) {
         setKgData(getScopedGraph(project.activeScriptId));
       }
    };
    window.addEventListener('kg-updated', handleKgUpdate);
    return () => window.removeEventListener('kg-updated', handleKgUpdate);
  }, [kgModalOpen, project.activeScriptId]);

  // Handle Log Events
  useEffect(() => {
    const handleLog = (e: CustomEvent) => {
      setLogs(prev => [...prev, {
        id: Date.now().toString() + Math.random(),
        timestamp: e.detail.timestamp,
        message: e.detail.message,
        type: e.detail.type
      }]);
    };
    
    const handleTokenUsage = (e: CustomEvent) => {
      const { input, output } = e.detail;
      setTokenStats(prev => {
        const cost = (input / 1000000 * PRICE_INPUT_PER_MILLION) + (output / 1000000 * PRICE_OUTPUT_PER_MILLION);
        return {
          totalInputTokens: prev.totalInputTokens + input,
          totalOutputTokens: prev.totalOutputTokens + output,
          totalCost: prev.totalCost + cost
        };
      });
    };

    window.addEventListener('app-log', handleLog as EventListener);
    window.addEventListener('app-token-usage', handleTokenUsage as EventListener);
    
    return () => {
      window.removeEventListener('app-log', handleLog as EventListener);
      window.removeEventListener('app-token-usage', handleTokenUsage as EventListener);
    };
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (isLogOpen && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isLogOpen]);

  // Handle RAG Search Input
  useEffect(() => {
    if (!ragQuery.trim()) {
      setRagHighlights(new Set());
      return;
    }
    const hits = simulateRetrieval(ragQuery, project.activeScriptId);
    setRagHighlights(hits);
  }, [ragQuery, project.activeScriptId]);

  // --- Handlers ---
  const handleSelectKey = async () => {
    try {
      const aistudio = (window as any).aistudio;
      if (aistudio) {
        await aistudio.openSelectKey();
        setIsApiKeySet(true);
      }
    } catch (e) { console.error(e); }
  };

  const handleGenerateScripts = async () => {
    if (!project.idea.trim()) return;
    
    setProject(prev => ({ ...prev, isGeneratingScripts: true, error: undefined }));
    let genreToSend = selectedGenre === 'custom' && customGenre.trim() ? customGenre.trim() : selectedGenre;
    let directorToSend = selectedDirector === 'custom' && customDirector.trim() ? customDirector.trim() : selectedDirector;

    try {
      // Pass both genre and director style
      const scripts = await generateScriptVariations(project.idea, genreToSend, directorToSend, targetDuration);
      setProject(prev => ({
        ...prev,
        scripts,
        activeScriptId: scripts[0]?.id || null,
        isGeneratingScripts: false
      }));
    } catch (e: any) {
      setProject(prev => ({ ...prev, isGeneratingScripts: false, error: e.message }));
      alert(`剧本生成失败: ${e.message}`);
    }
  };

  // Safe tab switching that saves current content
  const handleTabChange = (targetScriptId: string) => {
    setProject(prev => {
      // Save current activeTabPrompt to the script we are LEAVING
      const updatedScripts = prev.scripts.map(s => 
        s.id === prev.activeScriptId ? { ...s, content: activeTabPrompt } : s
      );
      return {
        ...prev,
        scripts: updatedScripts,
        activeScriptId: targetScriptId
      };
    });
  };

  const saveCurrentScriptContent = () => {
    if (!project.activeScriptId) return;
    setProject(prev => ({
      ...prev,
      scripts: prev.scripts.map(s => s.id === prev.activeScriptId ? { ...s, content: activeTabPrompt } : s)
    }));
  };

  const openModifyModal = (action: ScriptAction) => {
    if (!project.activeScriptId) return;
    // Ensure we save current content before modifying
    saveCurrentScriptContent();
    setModifyAction(action);
    setModifyInstruction('');
    setModifyModalOpen(true);
  };

  const confirmModifyScript = async () => {
    if (!project.activeScriptId || !modifyAction) return;
    const currentScriptObj = project.scripts.find(s => s.id === project.activeScriptId);
    // Use activeTabPrompt as source of truth for modification
    const titleContext = currentScriptObj?.title || "未命名剧本";

    setModifying(true);
    setProject(prev => ({ ...prev, error: undefined }));
    // Do NOT close modal immediately, wait for finish
    // setModifyModalOpen(false); 

    try {
      const newContent = await modifyScript(activeTabPrompt, titleContext, modifyAction, modifyInstruction);
      
      // Update script
      setProject(prev => ({
        ...prev,
        scripts: prev.scripts.map(s => s.id === prev.activeScriptId ? { ...s, content: newContent } : s)
      }));
      setActiveTabPrompt(newContent);
      
      // Update Knowledge for THIS specific script
      extractAndStoreKnowledge(newContent, project.activeScriptId);
      
      setModifyModalOpen(false); // Close on success

    } catch (e: any) {
      console.error(e);
      setProject(prev => ({ ...prev, error: e.message }));
      alert(`修改失败: ${e.message}`);
    } finally {
      setModifying(false);
      setModifyAction(null);
    }
  };

  const handleGenerateCharacters = async () => {
    if (!activeTabPrompt) return;
    saveCurrentScriptContent();
    setProject(prev => ({ ...prev, isGeneratingCharacters: true, error: undefined }));
    try {
      const chars = await generateCharacters(activeTabPrompt);
      setProject(prev => ({
        ...prev,
        characters: chars,
        isGeneratingCharacters: false
      }));
      
      // Store character knowledge
      const charText = chars.map(c => `${c.name}: ${c.description}`).join('\n');
      if (project.activeScriptId) {
         extractAndStoreKnowledge(charText, project.activeScriptId);
      }

      setTimeout(() => {
        document.getElementById('characters-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (e: any) {
      setProject(prev => ({ ...prev, isGeneratingCharacters: false, error: e.message }));
      alert(`角色提取失败: ${e.message}`);
    }
  };

  const handleCharacterUpdate = (id: string, field: keyof Character, value: string) => {
    setProject(prev => ({
      ...prev,
      characters: prev.characters.map(c => c.id === id ? { ...c, [field]: value } : c)
    }));
  };

  // --- Prompt Logic for Characters ---
  const handleGenCharPrompts = async (charId: string) => {
    const char = project.characters.find(c => c.id === charId);
    if (!char) return;
    const loadingKey = `char_prompts_${charId}`;
    setLoadingMap(p => ({ ...p, [loadingKey]: true }));
    try {
        const prompts = await generateImagePrompts(`${char.name}: ${char.description}`, 'CHARACTER');
        setProject(prev => ({
            ...prev,
            characters: prev.characters.map(c => c.id === charId ? { ...c, imagePrompts: prompts } : c)
        }));
        // Auto open edit modal
        setPromptModal({ isOpen: true, type: 'CHAR', id: charId, prompts, title: `角色提示词: ${char.name}` });
    } catch (e) {
        alert("生成提示词失败");
    } finally {
        setLoadingMap(p => ({ ...p, [loadingKey]: false }));
    }
  };

  const handleEditCharPrompts = (charId: string) => {
    const char = project.characters.find(c => c.id === charId);
    if (!char || !char.imagePrompts) return;
    setPromptModal({ isOpen: true, type: 'CHAR', id: charId, prompts: char.imagePrompts, title: `角色提示词: ${char.name}` });
  };

  const handleAddCharacter = () => {
     setProject(prev => ({
       ...prev,
       characters: [...prev.characters, { id: Date.now().toString(), name: "新角色", description: "" }]
     }));
  };

  const handleDeleteCharacter = (id: string) => {
      setProject(prev => ({
          ...prev,
          characters: prev.characters.filter(c => c.id !== id)
      }));
  };

  const handleGenerateStoryboard = async () => {
    if (!activeTabPrompt) return;
    saveCurrentScriptContent();
    if (project.characters.length === 0 && !window.confirm("尚未生成角色设定，分镜中的角色形象可能不一致。是否继续？")) {
        return;
    }

    setProject(prev => ({ ...prev, isGeneratingStoryboard: true, error: undefined }));
    try {
      const shots = await generateStoryboard(activeTabPrompt, project.characters, targetDuration);
      setProject(prev => ({
        ...prev,
        storyboard: shots,
        isGeneratingStoryboard: false
      }));
      setTimeout(() => {
        document.getElementById('storyboard-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (e: any) {
      setProject(prev => ({ ...prev, isGeneratingStoryboard: false, error: e.message }));
      alert(`分镜生成出错: ${e.message}`);
    }
  };

  const handleStoryboardUpdate = (id: string, field: keyof StoryboardShot, value: string) => {
    setProject(prev => ({
      ...prev,
      storyboard: prev.storyboard.map(s => s.id === id ? { ...s, [field]: value } : s)
    }));
  };

  // --- Prompt Logic for Storyboard ---
  const handleGenBgPrompts = async (shotId: string) => {
     const shot = project.storyboard.find(s => s.id === shotId);
     if (!shot) return;
     const loadingKey = `shot_bg_${shotId}`;
     setLoadingMap(p => ({ ...p, [loadingKey]: true }));
     try {
         const desc = `Visual: ${shot.visual}\nBackground Description: ${shot.background}`;
         const prompts = await generateImagePrompts(desc, 'BACKGROUND');
         setProject(prev => ({
             ...prev,
             storyboard: prev.storyboard.map(s => s.id === shotId ? { ...s, bgPrompts: prompts } : s)
         }));
         setPromptModal({ isOpen: true, type: 'BG', id: shotId, prompts, title: `Shot #${project.storyboard.indexOf(shot) + 1} 背景提示词` });
     } catch (e) { alert("生成背景提示词失败"); }
     finally { setLoadingMap(p => ({ ...p, [loadingKey]: false })); }
  };

  const handleGenCompositePrompts = async (shotId: string) => {
     const shot = project.storyboard.find(s => s.id === shotId);
     if (!shot) return;
     const loadingKey = `shot_comp_${shotId}`;
     setLoadingMap(p => ({ ...p, [loadingKey]: true }));
     
     try {
         // Find relevant character description if possible
         let charContext = "";
         if (shot.character) {
             const linkedChar = project.characters.find(c => shot.character.includes(c.name) || (c.name && shot.character.includes(c.name)));
             if (linkedChar) charContext = `Character Info: ${linkedChar.name} - ${linkedChar.description}\n`;
             else charContext = `Character Description: ${shot.character}\n`;
         }

         const desc = `${charContext}Visual Action: ${shot.visual}\nBackground: ${shot.background}\nCamera: ${shot.camera}`;
         const prompts = await generateImagePrompts(desc, 'COMPOSITE');
         setProject(prev => ({
             ...prev,
             storyboard: prev.storyboard.map(s => s.id === shotId ? { ...s, compositePrompts: prompts } : s)
         }));
         setPromptModal({ isOpen: true, type: 'COMPOSITE', id: shotId, prompts, title: `Shot #${project.storyboard.indexOf(shot) + 1} 合成提示词` });
     } catch (e) { alert("生成合成提示词失败"); }
     finally { setLoadingMap(p => ({ ...p, [loadingKey]: false })); }
  };

  const handleEditShotPrompts = (shotId: string, type: 'BG' | 'COMPOSITE') => {
      const shot = project.storyboard.find(s => s.id === shotId);
      if (!shot) return;
      const prompts = type === 'BG' ? shot.bgPrompts : shot.compositePrompts;
      if (!prompts) return;
      setPromptModal({ 
          isOpen: true, 
          type, 
          id: shotId, 
          prompts, 
          title: `Shot #${project.storyboard.indexOf(shot) + 1} ${type === 'BG' ? '背景' : '合成'}提示词` 
      });
  };

  const handleSavePrompts = (newPrompts: ImagePrompts) => {
      if (promptModal.type === 'CHAR') {
          setProject(prev => ({
              ...prev,
              characters: prev.characters.map(c => c.id === promptModal.id ? { ...c, imagePrompts: newPrompts } : c)
          }));
      } else {
          setProject(prev => ({
              ...prev,
              storyboard: prev.storyboard.map(s => s.id === promptModal.id ? 
                  (promptModal.type === 'BG' ? { ...s, bgPrompts: newPrompts } : { ...s, compositePrompts: newPrompts }) 
                  : s)
          }));
      }
  };

  // --- Logic to Regenerate Prompts inside Modal ---
  const handleRegenerateCurrentPrompts = async () => {
      const { type, id } = promptModal;
      let newPrompts: ImagePrompts | null = null;

      if (type === 'CHAR') {
         const char = project.characters.find(c => c.id === id);
         if (char) {
             newPrompts = await generateImagePrompts(`${char.name}: ${char.description}`, 'CHARACTER');
         }
      } else if (type === 'BG') {
         const shot = project.storyboard.find(s => s.id === id);
         if (shot) {
             newPrompts = await generateImagePrompts(`Visual: ${shot.visual}\nBackground Description: ${shot.background}`, 'BACKGROUND');
         }
      } else if (type === 'COMPOSITE') {
         const shot = project.storyboard.find(s => s.id === id);
         if (shot) {
             // Reconstruct logic for composite prompt
             let charContext = "";
             if (shot.character) {
                 const linkedChar = project.characters.find(c => shot.character.includes(c.name) || (c.name && shot.character.includes(c.name)));
                 if (linkedChar) charContext = `Character Info: ${linkedChar.name} - ${linkedChar.description}\n`;
                 else charContext = `Character Description: ${shot.character}\n`;
             }
             const desc = `${charContext}Visual Action: ${shot.visual}\nBackground: ${shot.background}\nCamera: ${shot.camera}`;
             newPrompts = await generateImagePrompts(desc, 'COMPOSITE');
         }
      }

      if (newPrompts) {
          // 1. Save to project
          handleSavePrompts(newPrompts);
          // 2. Update local modal state to reflect change immediately
          setPromptModal(prev => ({ ...prev, prompts: newPrompts! }));
      }
  };

  const handleAddShot = () => {
    const newShot: StoryboardShot = {
      id: Date.now().toString(),
      visual: '',
      audio: '',
      camera: '',
      character: '',
      background: '',
      startTime: '',
      duration: '3s'
    };
    setProject(prev => ({ ...prev, storyboard: [...prev.storyboard, newShot] }));
  };
  
  const handleInsertShot = (index: number) => {
    const newShot: StoryboardShot = {
      id: Date.now().toString() + Math.random(),
      visual: '',
      audio: '',
      camera: '',
      character: '',
      background: '',
      startTime: '',
      duration: '3s'
    };
    const newStoryboard = [...project.storyboard];
    newStoryboard.splice(index + 1, 0, newShot);
    setProject(prev => ({ ...prev, storyboard: newStoryboard }));
  };

  const handleDeleteShot = (id: string) => {
    if (window.confirm("确定要删除这个镜头吗？")) {
      setProject(prev => ({ ...prev, storyboard: prev.storyboard.filter(s => s.id !== id) }));
    }
  };

  // --- Keyframe & Video Logic ---

  const handleGenerateKeyframes = async (shotId: string) => {
    const shot = project.storyboard.find(s => s.id === shotId);
    if (!shot) return;
    
    // We use a local loading map for single item generation to keep UI responsive
    const loadingKey = `shot_kf_${shotId}`;
    setLoadingMap(p => ({ ...p, [loadingKey]: true }));

    try {
      const frames = await generateKeyframeBreakdown(shot, project.characters);
      setProject(prev => ({
        ...prev,
        keyframes: { ...prev.keyframes, [shotId]: { shotId, frames } },
      }));
    } catch (e) {
      alert("关键帧生成失败");
    } finally {
      setLoadingMap(p => ({ ...p, [loadingKey]: false }));
    }
  };

  const handleGenerateAllKeyframes = async () => {
      if (project.storyboard.length === 0) return;
      if (!window.confirm(`确认要为所有 ${project.storyboard.length} 个镜头生成关键帧吗？这可能需要一些时间。`)) return;

      setProject(prev => ({ ...prev, isGeneratingKeyframes: true }));
      
      // Sequential generation to avoid hitting rate limits too hard
      for (const shot of project.storyboard) {
          try {
              if (project.keyframes[shot.id]) continue; // Skip if already exists
              const frames = await generateKeyframeBreakdown(shot, project.characters);
              setProject(prev => ({
                ...prev,
                keyframes: { ...prev.keyframes, [shot.id]: { shotId: shot.id, frames } }
              }));
          } catch (e) {
              console.error(`Failed to gen keyframes for shot ${shot.id}`);
          }
      }
      setProject(prev => ({ ...prev, isGeneratingKeyframes: false }));
  };

  const handleGenerateVideoPrompt = async (shotId: string) => {
    const kf = project.keyframes[shotId];
    const shot = project.storyboard.find(s => s.id === shotId);
    if (!kf || !shot) return;

    const loadingKey = `shot_vid_${shotId}`;
    setLoadingMap(p => ({ ...p, [loadingKey]: true }));

    try {
       const prompt = await generateVideoGenerationPrompt(shot, kf.frames);
       setProject(prev => ({
         ...prev,
         keyframes: { ...prev.keyframes, [shotId]: { ...kf, videoGenPrompt: prompt } }
       }));
    } catch (e) {
      alert("视频提示词生成失败");
    } finally {
      setLoadingMap(p => ({ ...p, [loadingKey]: false }));
    }
  };

  const handleGenerateAllVideoPrompts = async () => {
      const shotsWithKF = project.storyboard.filter(s => project.keyframes[s.id]);
      if (shotsWithKF.length === 0) return;
       if (!window.confirm(`确认要为 ${shotsWithKF.length} 个镜头生成视频提示词吗？`)) return;

      setIsGeneratingAllVideoPrompts(true);
      for (const shot of shotsWithKF) {
          const kf = project.keyframes[shot.id];
          if (!kf || kf.videoGenPrompt) continue;
          try {
              const prompt = await generateVideoGenerationPrompt(shot, kf.frames);
              setProject(prev => ({
                ...prev,
                keyframes: { ...prev.keyframes, [shot.id]: { ...kf, videoGenPrompt: prompt } }
              }));
          } catch (e) { console.error(e); }
      }
      setIsGeneratingAllVideoPrompts(false);
  };

  // --- Timeline Auto Assembly ---
  const handleAutoAssemble = () => {
    if (project.storyboard.length === 0) return;
    
    const videoItems: TimelineItem[] = [];
    const audioItems: TimelineItem[] = [];
    const subItems: TimelineItem[] = [];
    
    let currentTime = 0;

    project.storyboard.forEach((shot) => {
       const durationSec = parseFloat(shot.duration) || 3;
       
       // Video Track
       const kfData = project.keyframes[shot.id];
       const content = kfData?.videoGenPrompt || (shot.compositePrompts?.gemini || shot.visual);
       
       videoItems.push({
         id: `v-${shot.id}`,
         shotId: shot.id,
         content: content,
         startTime: currentTime,
         duration: durationSec,
         color: 'bg-blue-600'
       });

       // Audio Track
       if (shot.audio) {
         audioItems.push({
           id: `a-${shot.id}`,
           shotId: shot.id,
           content: shot.audio,
           startTime: currentTime,
           duration: durationSec,
           color: 'bg-green-600'
         });
       }

       // Subtitle Track (Simulation)
       if (shot.audio && shot.audio.includes(":")) {
          // If audio looks like dialogue "Name: Content"
          subItems.push({
            id: `s-${shot.id}`,
            shotId: shot.id,
            content: shot.audio.split(":")[1] || shot.audio,
            startTime: currentTime,
            duration: durationSec,
            color: 'bg-yellow-600'
          });
       }

       currentTime += durationSec;
    });

    setProject(prev => ({
      ...prev,
      timeline: [
        { id: 'video-1', label: 'Video Track', type: 'VIDEO', items: videoItems },
        { id: 'audio-1', label: 'Audio Track', type: 'AUDIO', items: audioItems },
        { id: 'sub-1', label: 'Subtitles', type: 'SUBTITLE', items: subItems },
      ]
    }));

    // Show the timeline
    setShowTimeline(true);

    setTimeout(() => {
        document.getElementById('timeline-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Translation (Simplified for brevity as logic didn't change much)
  const handleTranslateIdea = async () => {
    if (!project.idea) return;
    setIsTranslatingIdea(true);
    try {
      const translated = await translateText(project.idea);
      setProject(p => ({ ...p, idea: translated }));
    } catch (e) { console.error(e); } finally { setIsTranslatingIdea(false); }
  };
  const handleTranslateScript = async () => {
    if (!activeTabPrompt) return;
    saveCurrentScriptContent();
    setIsTranslatingScript(true);
    try {
      const translated = await translateText(activeTabPrompt);
      setActiveTabPrompt(translated);
      setProject(prev => ({
        ...prev,
        scripts: prev.scripts.map(s => s.id === prev.activeScriptId ? { ...s, content: translated } : s)
      }));
    } catch (e) { console.error(e); } finally { setIsTranslatingScript(false); }
  };
  const handleTranslateCharacters = async () => {
    if (project.characters.length === 0) return;
    setIsTranslatingCharacters(true);
    try {
      const translatedChars = await translateCharacters(project.characters);
      setProject(prev => ({ ...prev, characters: translatedChars }));
    } catch (e) { console.error(e); } finally { setIsTranslatingCharacters(false); }
  };
  const handleTranslateStoryboard = async () => {
    if (project.storyboard.length === 0) return;
    setIsTranslatingStoryboard(true);
    try {
      const translatedShots = await translateStoryboardData(project.storyboard);
      setProject(prev => ({ ...prev, storyboard: translatedShots }));
    } catch (e) { console.error(e); } finally { setIsTranslatingStoryboard(false); }
  };

  // Export
  const handleExport = () => {
    // Save current editing state before export
    if (project.activeScriptId) {
        // Manually merging state because setProject is async and we need data NOW
        const currentScripts = project.scripts.map(s => s.id === project.activeScriptId ? { ...s, content: activeTabPrompt } : s);
        const exportData = { 
            ...project, 
            scripts: currentScripts,
            metadata: { exportedAt: new Date().toISOString() } 
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scriptgen_project.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } else {
        if (!project.idea && project.scripts.length === 0) {
            alert("项目为空，无法导出");
            return;
        }
    }
  };
  
  const handleExportKG = () => {
     if (kgData.nodes.length === 0) return;
     const blob = new Blob([JSON.stringify(kgData, null, 2)], { type: 'application/json' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `scriptgen_knowledge_graph.json`;
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
  };

  const handleOpenKG = () => {
    // Load graph specific to the active script (or just global if none)
    setKgData(getScopedGraph(project.activeScriptId));
    setKgViewMode('ALL');
    setRagQuery('');
    setRagHighlights(new Set());
    setKgModalOpen(true);
  };

  // Render Helpers
  const getModalTitle = (action: ScriptAction | null) => {
    switch (action) {
      case 'REWRITE': return '变体改写 (Rewrite)';
      case 'EXPAND': return '结构扩写 (Expand)';
      case 'POLISH': return '文风润色 (Polish)';
      case 'DECONSTRUCT': return '创意解构 (Deconstruct)';
      default: return '修改剧本';
    }
  };
  const getModalDescription = (action: ScriptAction | null) => {
     switch (action) {
      case 'REWRITE': return '请输入改写的具体方向...';
      case 'EXPAND': return 'AI 将基于当前标题和内容进行扩写...';
      case 'POLISH': return 'AI 将优化语言质感...';
      case 'DECONSTRUCT': return 'AI 将打破常规结构...';
      default: return '请输入指令';
    }
  };

  // --- JSX (Simplified Layout structure remains same, updated Logic connections) ---
  if (!isApiKeySet) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-indigo-900/50">
          <Clapperboard className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">剧本与分镜 AI 助手</h1>
        <button onClick={handleSelectKey} className="flex items-center gap-2 px-8 py-3 bg-white text-gray-950 font-bold rounded-lg hover:bg-gray-200 mt-8">
          <Sparkles className="w-4 h-4" /> 开始创作 (选择 API Key)
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden font-sans relative">
      
      {/* Modification Modal */}
      {modifyModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-850">
              <h3 className="font-bold flex items-center gap-2"><Edit3 className="w-4 h-4 text-indigo-400"/> {getModalTitle(modifyAction)}</h3>
              <button onClick={() => setModifyModalOpen(false)}><XCircle className="w-5 h-5 text-gray-500 hover:text-white"/></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-400">{getModalDescription(modifyAction)}</p>
              <textarea 
                className="w-full h-32 bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm focus:border-indigo-500 focus:outline-none resize-none"
                value={modifyInstruction} onChange={(e) => setModifyInstruction(e.target.value)}
              />
            </div>
            <div className="p-4 border-t border-gray-800 bg-gray-850/50 flex justify-end gap-2">
              <button onClick={() => setModifyModalOpen(false)} className="px-4 py-2 text-sm text-gray-400">取消</button>
              <button 
                onClick={confirmModifyScript} 
                disabled={modifying}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg flex items-center gap-2"
              >
                {modifying ? <><Loader2 className="w-4 h-4 animate-spin"/> 正在修改...</> : "确认并生成"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Editor Modal */}
      <PromptEditorModal 
         isOpen={promptModal.isOpen} 
         onClose={() => setPromptModal(prev => ({...prev, isOpen: false}))}
         title={promptModal.title}
         prompts={promptModal.prompts}
         onSave={handleSavePrompts}
         onRegenerate={handleRegenerateCurrentPrompts}
      />

      {/* KG Modal */}
      {kgModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
             <div className="p-4 border-b border-gray-800 flex flex-col gap-4 bg-gray-850">
               <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <h3 className="font-bold flex items-center gap-2 text-indigo-400">
                      <Network className="w-5 h-5"/> 知识图谱 (Knowledge Graph)
                      {project.activeScriptId && <span className="text-xs bg-indigo-900/50 px-2 py-0.5 rounded text-indigo-300 ml-2">Filtered by Current Script</span>}
                    </h3>
                    <div className="flex bg-gray-950 p-1 rounded-lg border border-gray-800">
                        <button onClick={() => setKgViewMode('ALL')} className={`px-3 py-1 text-xs font-medium rounded ${kgViewMode === 'ALL' ? 'bg-gray-800 text-white' : 'text-gray-500'}`}>全景</button>
                        <button onClick={() => setKgViewMode('CHARACTER')} className={`px-3 py-1 text-xs font-medium rounded ${kgViewMode === 'CHARACTER' ? 'bg-indigo-900/50 text-indigo-300' : 'text-gray-500'}`}>人物</button>
                        <button onClick={() => setKgViewMode('LOCATION')} className={`px-3 py-1 text-xs font-medium rounded ${kgViewMode === 'LOCATION' ? 'bg-green-900/50 text-green-300' : 'text-gray-500'}`}>环境</button>
                        <button onClick={() => setKgViewMode('VISUAL')} className={`px-3 py-1 text-xs font-medium rounded ${kgViewMode === 'VISUAL' ? 'bg-yellow-900/50 text-yellow-300' : 'text-gray-500'}`}>视听 (Visuals)</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleExportKG} className="text-gray-400 hover:text-white flex items-center gap-1 text-xs px-2 py-1 bg-gray-800 rounded border border-gray-700">
                        <Download className="w-3 h-3"/> 导出 JSON
                    </button>
                    <button onClick={() => setKgModalOpen(false)}><XCircle className="w-5 h-5 text-gray-500 hover:text-white"/></button>
                  </div>
               </div>
               <div className="relative">
                  <Eye className={`absolute top-2.5 left-3 w-4 h-4 ${ragQuery ? 'text-indigo-400' : 'text-gray-500'}`} />
                  <input 
                    type="text" 
                    className="w-full bg-gray-950 border border-gray-700 text-sm rounded-lg pl-10 pr-4 py-2 focus:border-indigo-500 focus:outline-none"
                    placeholder="RAG 检索测试：输入关键词..."
                    value={ragQuery}
                    onChange={(e) => setRagQuery(e.target.value)}
                  />
               </div>
             </div>
             <div className="flex-1 overflow-hidden relative bg-gray-950">
                {kgData.nodes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4"><Share2 className="w-12 h-12 opacity-50"/><p>暂无相关知识数据</p></div>
                ) : (
                  <GraphView nodes={kgData.nodes} links={kgData.links} filterType={kgViewMode} highlightedNodeIds={ragHighlights} />
                )}
             </div>
             <div className="p-3 border-t border-gray-800 bg-gray-900/50 text-xs text-gray-500 flex justify-between">
                <div className="flex gap-4">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400"></span> Character</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400"></span> Location</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400"></span> Visual/Light</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400"></span> Camera</span>
                </div>
                <span>当前视图仅包含：全局创意 + 选中剧本的知识点</span>
             </div>
          </div>
        </div>
      )}

      {/* Sidebar & Main Content (Standard Layout) */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 z-30">
        <div className="p-4 border-b border-gray-800 flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center"><Film className="w-5 h-5 text-white" /></div>
          <span className="font-bold text-lg tracking-tight">ScriptGen.AI</span>
        </div>
        <div className="p-4 space-y-4 flex-1 overflow-y-auto no-scrollbar">
          {/* Project Stats */}
          <div className="bg-gray-800/50 rounded-lg p-3 space-y-3 border border-indigo-500/30 shadow-lg">
             <div className="flex justify-between items-center text-sm">
               <span className="text-gray-400 flex items-center gap-2"><Layers className="w-3.5 h-3.5"/> 方案数</span>
               <span className="text-white font-mono font-bold text-indigo-300">{project.scripts.length}</span>
             </div>
             <div className="flex justify-between items-center text-sm">
               <span className="text-gray-400 flex items-center gap-2"><Users className="w-3.5 h-3.5"/> 角色数</span>
               <span className="text-white font-mono font-bold text-indigo-300">{project.characters.length}</span>
             </div>
              <div className="flex justify-between items-center text-sm">
               <span className="text-gray-400 flex items-center gap-2"><Layout className="w-3.5 h-3.5"/> 镜头数</span>
               <span className="text-white font-mono font-bold text-indigo-300">{project.storyboard.length}</span>
             </div>
          </div>

          {/* Token Cost Stats */}
           <div className="bg-gray-950 rounded-lg p-3 space-y-2 border border-gray-800">
             <div className="flex items-center gap-2 text-xs text-gray-400 uppercase font-semibold mb-1">
               <DollarSign className="w-3.5 h-3.5 text-green-400"/> 消耗统计
             </div>
             <div className="flex justify-between items-center text-xs">
               <span className="text-gray-500">输入 Tokens</span>
               <span className="text-gray-300 font-mono">{tokenStats.totalInputTokens.toLocaleString()}</span>
             </div>
             <div className="flex justify-between items-center text-xs">
               <span className="text-gray-500">输出 Tokens</span>
               <span className="text-gray-300 font-mono">{tokenStats.totalOutputTokens.toLocaleString()}</span>
             </div>
             <div className="pt-2 border-t border-gray-800 flex justify-between items-center text-sm font-bold">
               <span className="text-green-500">总费用</span>
               <span className="text-white font-mono">${tokenStats.totalCost.toFixed(4)}</span>
             </div>
             <p className="text-[10px] text-gray-600 mt-1">*基于 Google Gemini Pro 定价估算</p>
          </div>

          <div className="pt-2 border-t border-gray-800">
            <button onClick={handleOpenKG} className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-indigo-300 border border-indigo-900/50 rounded flex items-center justify-center gap-2 text-xs font-medium transition-colors">
              <Network className="w-4 h-4" /> 查看知识图谱 (KG)
            </button>
            <p className="text-[10px] text-gray-500 mt-2 text-center">AI 自动记忆并关联您的创意</p>
          </div>
        </div>
        
        {/* Logs Section at Bottom of Sidebar */}
        <div className={`border-t border-gray-800 bg-black flex flex-col transition-all duration-300 ease-in-out ${isLogOpen ? 'h-64' : 'h-10'}`}>
          <button 
             onClick={() => setIsLogOpen(!isLogOpen)}
             className="flex items-center justify-between px-4 h-10 w-full bg-gray-900 hover:bg-gray-800 text-xs text-gray-400 border-b border-gray-800"
          >
             <div className="flex items-center gap-2 font-mono"><Terminal className="w-3 h-3 text-green-500"/> AI 思维链日志</div>
             {isLogOpen ? <ChevronDown className="w-3 h-3"/> : <ChevronUp className="w-3 h-3"/>}
          </button>
          
          {isLogOpen && (
            <div className="flex-1 overflow-y-auto p-2 font-mono text-[10px] space-y-1 custom-scrollbar">
              {logs.length === 0 && <div className="text-gray-600 italic px-2">等待 AI 思考...</div>}
              {logs.map((log) => (
                <div key={log.id} className="flex gap-2 mb-1 border-b border-gray-900 pb-1">
                  <span className="text-gray-600 shrink-0 select-none">[{log.timestamp.split(' ')[0]}]</span>
                  <span className={`break-words whitespace-pre-wrap ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : log.type === 'ai' ? 'text-blue-400' : 'text-gray-300'}`}>
                    {log.type === 'ai' && '🤖 '}
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-14 border-b border-gray-800 bg-gray-950/50 backdrop-blur flex items-center justify-between px-6 shrink-0 relative z-20">
           <div className="flex items-center gap-2 text-sm text-gray-400">
             <span className={project.scripts.length === 0 ? "text-white font-medium" : ""}>1. 创意</span>
             <ChevronRight className="w-4 h-4" />
             <span className={project.scripts.length > 0 ? "text-white font-medium" : ""}>2. 剧本</span>
             <ChevronRight className="w-4 h-4" />
             <span className={project.storyboard.length > 0 ? "text-white font-medium" : ""}>3. 角色 & 分镜</span>
             <ChevronRight className="w-4 h-4" />
             <span className={project.storyboard.length > 0 ? "text-white font-medium" : ""}>4. 关键帧</span>
             <ChevronRight className="w-4 h-4" />
             <span className={Object.keys(project.keyframes).length > 0 ? "text-white font-medium" : ""}>5. 视频</span>
             <ChevronRight className="w-4 h-4" />
             <span className={showTimeline ? "text-white font-medium" : ""}>6. 剪辑</span>
           </div>
           <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded border border-gray-700"><Download className="w-3.5 h-3.5" /> 导出 JSON</button>
        </header>

        {project.error && (
            <div className="bg-red-900/80 text-white px-6 py-2 flex items-center justify-between shadow-lg relative z-10 backdrop-blur-sm border-b border-red-800">
              <div className="flex items-center gap-2 text-sm font-medium"><AlertTriangle className="w-4 h-4 text-red-200" /><span>{project.error}</span></div>
              <button onClick={() => setProject(p => ({ ...p, error: undefined }))}><XCircle className="w-4 h-4"/></button>
            </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* IDEA SECTION */}
          <section className="max-w-4xl mx-auto w-full">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4"><Sparkles className="w-5 h-5 text-yellow-500" /> 核心创意</h2>
            <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-lg relative overflow-hidden">
               <div className="bg-gray-850 p-3 border-b border-gray-800 flex flex-wrap items-center gap-3">
                  
                  {/* Genre Selector */}
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Settings2 className="w-4 h-4 text-gray-500" />
                      <span>类型:</span>
                  </div>
                  <select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)} className="bg-gray-900 border border-gray-700 text-sm rounded px-3 py-1.5 outline-none max-w-[150px]">
                      <option value="auto">🤖 智能推荐</option>
                      <option value="sci-fi">🛸 科幻 (Sci-Fi)</option>
                      <option value="suspense">🕵️‍♂️ 悬疑 (Suspense)</option>
                      <option value="comedy">🤣 喜剧 (Comedy)</option>
                      <option value="action">💥 动作 (Action)</option>
                      <option value="romance">❤️ 爱情 (Romance)</option>
                      <option value="horror">👻 恐怖 (Horror)</option>
                      <option value="drama">🎭 剧情 (Drama)</option>
                      <option value="crime">🚓 犯罪 (Crime)</option>
                      <option value="fantasy">🐉 奇幻 (Fantasy)</option>
                      <option value="thriller">🔪 惊悚 (Thriller)</option>
                      <option value="documentary">📹 纪录片 (Documentary)</option>
                      <option value="animation">🎨 动画 (Animation)</option>
                      <option value="musical">🎵 歌舞 (Musical)</option>
                      <option value="war">⚔️ 战争 (War)</option>
                      <option value="historical">📜 历史 (Historical)</option>
                      <option value="biopic">👤 传记 (Biopic)</option>
                      <option value="cyberpunk">🌃 赛博朋克 (Cyberpunk)</option>
                      <option value="steampunk">⚙️ 蒸汽朋克 (Steampunk)</option>
                      <option value="film-noir">🚬 黑色电影 (Film Noir)</option>
                      <option value="western">🤠 西部 (Western)</option>
                      <option value="custom">✏️ 自定义...</option>
                  </select>
                  {selectedGenre === 'custom' && <input type="text" placeholder="输入类型..." value={customGenre} onChange={(e) => setCustomGenre(e.target.value)} className="bg-gray-900 border border-gray-700 text-sm rounded px-3 py-1.5 w-24"/>}
                  
                  <div className="h-6 w-px bg-gray-700 mx-1 hidden md:block"></div>

                  {/* Director Selector */}
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Video className="w-4 h-4 text-gray-500" />
                      <span>导演风格:</span>
                  </div>
                  <select value={selectedDirector} onChange={(e) => setSelectedDirector(e.target.value)} className="bg-gray-900 border border-gray-700 text-sm rounded px-3 py-1.5 outline-none max-w-[150px]">
                      <option value="none">🎬 不限导演风格</option>
                      <option value="Christopher Nolan">⏳ 克里斯托弗·诺兰 (Christopher Nolan)</option>
                      <option value="Wong Kar-wai">🕶️ 王家卫 (Wong Kar-wai)</option>
                      <option value="Wes Anderson">对称 韦斯·安德森 (Wes Anderson)</option>
                      <option value="Quentin Tarantino">🩸 昆汀·塔伦蒂诺 (Quentin Tarantino)</option>
                      <option value="Steven Spielberg">🦕 斯皮尔伯格 (Steven Spielberg)</option>
                      <option value="Hayao Miyazaki">☁️ 宫崎骏 (Hayao Miyazaki)</option>
                      <option value="Alfred Hitchcock">😱 希区柯克 (Alfred Hitchcock)</option>
                      <option value="Stanley Kubrick">👁️ 库布里克 (Stanley Kubrick)</option>
                      <option value="Martin Scorsese">🚕 马丁·斯科塞斯 (Martin Scorsese)</option>
                      <option value="Tim Burton">🦇 蒂姆·波顿 (Tim Burton)</option>
                      <option value="David Fincher">🔦 大卫·芬奇 (David Fincher)</option>
                      <option value="Greta Gerwig">🎀 格蕾塔·葛韦格 (Greta Gerwig)</option>
                      <option value="Akira Kurosawa">🗡️ 黑泽明 (Akira Kurosawa)</option>
                      <option value="James Cameron">🌊 詹姆斯·卡梅隆 (James Cameron)</option>
                      <option value="Denis Villeneuve">🪐 丹尼斯·维伦纽瓦 (Denis Villeneuve)</option>
                      <option value="custom">✏️ 自定义...</option>
                  </select>
                  {selectedDirector === 'custom' && <input type="text" placeholder="输入导演..." value={customDirector} onChange={(e) => setCustomDirector(e.target.value)} className="bg-gray-900 border border-gray-700 text-sm rounded px-3 py-1.5 w-24"/>}

                  <button onClick={handleTranslateIdea} className="ml-auto text-xs text-blue-400 bg-blue-900/20 px-3 py-1.5 rounded flex gap-2">
                     {isTranslatingIdea ? <Loader2 className="w-3 h-3 animate-spin"/> : <Languages className="w-3 h-3"/>} 翻译
                  </button>
               </div>
               <textarea 
                  className="w-full h-32 bg-transparent p-4 text-lg outline-none text-gray-200 resize-none focus:bg-gray-900/50"
                  placeholder="在此输入您的电影创意..."
                  value={project.idea}
                  onChange={(e) => setProject(p => ({ ...p, idea: e.target.value }))}
               />
               <div className="flex justify-end items-center gap-4 p-2 border-t border-gray-800 bg-gray-850/50">
                  <div className="flex items-center gap-2 bg-gray-900 rounded-lg p-1 border border-gray-800">
                        <Clock className="w-4 h-4 text-gray-500 ml-2" />
                        <select 
                           value={targetDuration} 
                           onChange={(e) => setTargetDuration(e.target.value)}
                           className="bg-transparent text-sm text-gray-300 outline-none px-2 py-1"
                        >
                           <option value="30秒">30 秒</option>
                           <option value="1分钟">1 分钟 (默认)</option>
                           <option value="2分钟">2 分钟</option>
                           <option value="3分钟">3 分钟</option>
                        </select>
                  </div>
                  <button onClick={handleGenerateScripts} disabled={project.isGeneratingScripts || !project.idea.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2">
                    {project.isGeneratingScripts ? <><Loader2 className="w-4 h-4 animate-spin" /> 生成中...</> : <><Wand2 className="w-4 h-4" /> 生成 5 个方案</>}
                  </button>
               </div>
            </div>
          </section>

          {/* SCRIPT TABS */}
          {project.scripts.length > 0 && (
            <section className="max-w-6xl mx-auto w-full h-[600px] flex flex-col bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl animate-fade-in-up">
              <div className="flex items-center border-b border-gray-800 bg-gray-950/50 overflow-x-auto">
                {project.scripts.map((script, idx) => (
                  <button key={script.id} onClick={() => handleTabChange(script.id)}
                    className={`px-6 py-3 text-sm font-medium border-r border-gray-800 flex items-center gap-2 whitespace-nowrap ${project.activeScriptId === script.id ? 'bg-gray-800 text-white border-t-2 border-t-indigo-500' : 'text-gray-500 hover:bg-gray-900'}`}
                  >
                     <span className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-xs">{idx + 1}</span>
                     {script.title || `方案 ${idx + 1}`}
                  </button>
                ))}
              </div>
              <div className="h-12 border-b border-gray-800 bg-gray-900 flex items-center justify-between px-4 shrink-0">
                 <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 uppercase font-bold mr-2">AI 润色:</span>
                    <button onClick={() => openModifyModal('REWRITE')} className={`${TOOLBAR_BTN_CLASS} text-blue-400 hover:bg-blue-900/20`}><PenTool className="w-3 h-3 mr-1"/>改写</button>
                    <button onClick={() => openModifyModal('EXPAND')} className={`${TOOLBAR_BTN_CLASS} text-green-400 hover:bg-green-900/20`}><Maximize2 className="w-3 h-3 mr-1"/>扩写</button>
                    <button onClick={() => openModifyModal('POLISH')} className={`${TOOLBAR_BTN_CLASS} text-purple-400 hover:bg-purple-900/20`}><Sparkles className="w-3 h-3 mr-1"/>润色</button>
                    <button onClick={() => openModifyModal('DECONSTRUCT')} className={`${TOOLBAR_BTN_CLASS} text-orange-400 hover:bg-orange-900/20`}><Scissors className="w-3 h-3 mr-1"/>解构</button>
                    <div className="w-px h-4 bg-gray-700 mx-2"></div>
                    <button onClick={handleTranslateScript} className={`${TOOLBAR_BTN_CLASS} text-gray-400 hover:text-white`}><Languages className="w-3 h-3 mr-1" />翻译</button>
                 </div>
                 <button onClick={handleGenerateCharacters} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded flex gap-1.5">
                   {project.isGeneratingCharacters ? <Loader2 className="w-3 h-3 animate-spin"/> : <Users className="w-3 h-3" />} 提取角色
                 </button>
              </div>
              <textarea 
                className="flex-1 w-full bg-gray-900 p-6 text-gray-300 leading-relaxed outline-none resize-none font-mono text-sm" 
                value={activeTabPrompt} 
                onChange={(e) => setActiveTabPrompt(e.target.value)} 
                onBlur={saveCurrentScriptContent}
                placeholder="在上方选择一个剧本方案开始编辑..."
              />
            </section>
          )}

          {/* CHARACTERS */}
          {project.characters.length > 0 && (
             <section id="characters-section" className="max-w-6xl mx-auto w-full animate-fade-in-up">
                 <div className="mb-4 flex items-center justify-between">
                   <h2 className="text-xl font-semibold flex items-center gap-2"><Users className="w-5 h-5 text-indigo-400" /> 角色设定</h2>
                   <div className="flex items-center gap-2">
                       <button onClick={handleTranslateCharacters} className="text-xs text-blue-400 bg-blue-900/20 px-3 py-1.5 rounded flex gap-1.5">
                           {isTranslatingCharacters ? <Loader2 className="w-3 h-3 animate-spin"/> : <Languages className="w-3 h-3"/>} 翻译
                       </button>
                       <button onClick={handleAddCharacter} className="text-xs text-gray-400 hover:text-white flex items-center gap-1 bg-gray-800 px-3 py-1.5 rounded border border-gray-700">
                           <Plus className="w-3 h-3" /> 添加角色
                       </button>
                   </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {project.characters.map((char) => (
                       <div key={char.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 shadow-lg flex flex-col">
                          <div className="flex justify-between items-start mb-2">
                             <div className="flex items-center gap-2 font-bold text-indigo-400">
                                <User className="w-4 h-4" />
                                <input value={char.name} onChange={(e) => handleCharacterUpdate(char.id, 'name', e.target.value)} className="bg-transparent border-b border-transparent hover:border-gray-700 focus:border-indigo-500 outline-none w-32"/>
                             </div>
                             <button onClick={() => handleDeleteCharacter(char.id)}><Trash2 className="w-3 h-3 text-gray-600 hover:text-red-500" /></button>
                          </div>
                          <textarea value={char.description} onChange={(e) => handleCharacterUpdate(char.id, 'description', e.target.value)} className="w-full h-24 bg-gray-950/50 p-2 rounded text-sm text-gray-300 resize-none outline-none mb-3"/>
                          
                          <div className="mt-auto pt-3 border-t border-gray-800">
                             {char.imagePrompts ? (
                                <div className="flex gap-2">
                                  <button onClick={() => handleEditCharPrompts(char.id)} className="flex-1 py-1.5 text-xs bg-indigo-900/40 hover:bg-indigo-900/60 text-indigo-300 rounded border border-indigo-900/50 flex items-center justify-center gap-2">
                                    <Palette className="w-3 h-3"/> 查看/修改提示词
                                  </button>
                                  <button onClick={() => handleGenCharPrompts(char.id)} className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 flex items-center justify-center" title="重新生成">
                                    {loadingMap[`char_prompts_${char.id}`] ? <Loader2 className="w-3 h-3 animate-spin text-blue-400"/> : <RefreshCw className="w-3 h-3"/>}
                                  </button>
                                </div>
                             ) : (
                                <button 
                                  onClick={() => handleGenCharPrompts(char.id)} 
                                  disabled={loadingMap[`char_prompts_${char.id}`]}
                                  className="w-full py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 flex items-center justify-center gap-2"
                                >
                                  {loadingMap[`char_prompts_${char.id}`] ? <Loader2 className="w-3 h-3 animate-spin"/> : <Wand2 className="w-3 h-3"/>} 生成生图提示词
                                </button>
                             )}
                          </div>
                       </div>
                    ))}
                 </div>
                 <div className="flex justify-end items-center gap-4">
                    <button onClick={handleGenerateStoryboard} disabled={project.isGeneratingStoryboard} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2">
                      {project.isGeneratingStoryboard ? <><Loader2 className="w-4 h-4 animate-spin" /> 生成中...</> : <><Layout className="w-4 h-4" /> 生成分镜表</>}
                    </button>
                 </div>
             </section>
          )}

          {/* STORYBOARD */}
          {project.storyboard.length > 0 && (
            <section id="storyboard-section" className="max-w-6xl mx-auto w-full animate-fade-in-up">
               <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2"><Layout className="w-5 h-5 text-indigo-500" /> 分镜脚本</h2>
                <button onClick={handleTranslateStoryboard} className="text-xs text-blue-400 bg-blue-900/20 px-3 py-1.5 rounded flex gap-1.5">{isTranslatingStoryboard ? <Loader2 className="w-3 h-3 animate-spin"/> : <Languages className="w-3 h-3" />} 翻译</button>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
                 <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[1200px]">
                       <thead className="bg-gray-950 text-gray-400 uppercase text-xs font-semibold tracking-wider border-b border-gray-800">
                          <tr>
                            <th className="px-4 py-3 w-12 text-center">#</th>
                            <th className="px-4 py-3 w-20">Time</th>
                            <th className="px-4 py-3 min-w-[200px]">Visual (画面)</th>
                            <th className="px-4 py-3 min-w-[150px]">Audio (声音)</th>
                            <th className="px-4 py-3 min-w-[150px]">Camera (机位)</th>
                            <th className="px-4 py-3 min-w-[150px]">Character (角色)</th>
                            <th className="px-4 py-3 min-w-[150px]">Background (环境)</th>
                            <th className="px-4 py-3 text-center w-24">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-800">
                          {project.storyboard.map((shot, idx) => (
                             <tr key={shot.id} className="hover:bg-gray-800/50 group">
                                <td className="px-4 py-3 text-center text-gray-500 font-mono">{idx + 1}</td>
                                <td className="px-4 py-3 align-top space-y-1">
                                   <input className="w-full bg-transparent text-gray-300 outline-none text-xs" value={shot.startTime} onChange={(e) => handleStoryboardUpdate(shot.id, 'startTime', e.target.value)} placeholder="Start"/>
                                   <input className="w-full bg-transparent text-gray-500 outline-none text-xs" value={shot.duration} onChange={(e) => handleStoryboardUpdate(shot.id, 'duration', e.target.value)} placeholder="Dur"/>
                                </td>
                                <td className="px-4 py-3 align-top"><textarea className="w-full bg-transparent text-gray-300 outline-none resize-none h-20 text-xs" value={shot.visual} onChange={(e) => handleStoryboardUpdate(shot.id, 'visual', e.target.value)}/></td>
                                <td className="px-4 py-3 align-top"><textarea className="w-full bg-transparent text-gray-400 outline-none resize-none h-20 text-xs italic" value={shot.audio} onChange={(e) => handleStoryboardUpdate(shot.id, 'audio', e.target.value)}/></td>
                                <td className="px-4 py-3 align-top"><textarea className="w-full bg-transparent text-red-300 outline-none resize-none h-20 text-xs" value={shot.camera} onChange={(e) => handleStoryboardUpdate(shot.id, 'camera', e.target.value)}/></td>
                                <td className="px-4 py-3 align-top"><textarea className="w-full bg-transparent text-indigo-300 outline-none resize-none h-20 text-xs" value={shot.character} onChange={(e) => handleStoryboardUpdate(shot.id, 'character', e.target.value)}/></td>
                                <td className="px-4 py-3 align-top"><textarea className="w-full bg-transparent text-green-300 outline-none resize-none h-20 text-xs" value={shot.background} onChange={(e) => handleStoryboardUpdate(shot.id, 'background', e.target.value)}/></td>

                                <td className="px-4 py-3 align-top">
                                  <div className="flex flex-col gap-2">
                                     {/* Background Prompts */}
                                     {shot.bgPrompts ? (
                                       <div className="flex gap-1">
                                          <button onClick={() => handleEditShotPrompts(shot.id, 'BG')} title="查看/修改背景提示词" className="flex-1 p-1.5 rounded bg-green-900/30 text-green-400 hover:text-white border border-green-900/50">
                                            <Files className="w-3 h-3 mx-auto"/>
                                          </button>
                                          <button onClick={() => handleGenBgPrompts(shot.id)} title="重新生成背景提示词" className="p-1.5 rounded bg-gray-800 text-gray-500 hover:text-green-400 border border-gray-700">
                                            {loadingMap[`shot_bg_${shot.id}`] ? <Loader2 className="w-3 h-3 animate-spin text-green-400"/> : <RefreshCw className="w-3 h-3"/>}
                                          </button>
                                       </div>
                                     ) : (
                                       <button onClick={() => handleGenBgPrompts(shot.id)} title="生成背景提示词" className="p-1.5 rounded bg-gray-800 text-gray-500 hover:text-green-400 border border-gray-700">
                                         {loadingMap[`shot_bg_${shot.id}`] ? <Loader2 className="w-3 h-3 animate-spin"/> : <ImageIcon className="w-3 h-3 mx-auto"/>}
                                       </button>
                                     )}

                                     {/* Composite Prompts */}
                                     {shot.compositePrompts ? (
                                       <div className="flex gap-1">
                                          <button onClick={() => handleEditShotPrompts(shot.id, 'COMPOSITE')} title="查看/修改合成提示词" className="flex-1 p-1.5 rounded bg-purple-900/30 text-purple-400 hover:text-white border border-purple-900/50">
                                            <Palette className="w-3 h-3 mx-auto"/>
                                          </button>
                                          <button onClick={() => handleGenCompositePrompts(shot.id)} title="重新生成合成提示词" className="p-1.5 rounded bg-gray-800 text-gray-500 hover:text-purple-400 border border-gray-700">
                                            {loadingMap[`shot_comp_${shot.id}`] ? <Loader2 className="w-3 h-3 animate-spin text-purple-400"/> : <RefreshCw className="w-3 h-3"/>}
                                          </button>
                                       </div>
                                     ) : (
                                       <button onClick={() => handleGenCompositePrompts(shot.id)} title="生成合成提示词" className="p-1.5 rounded bg-gray-800 text-gray-500 hover:text-purple-400 border border-gray-700">
                                         {loadingMap[`shot_comp_${shot.id}`] ? <Loader2 className="w-3 h-3 animate-spin"/> : <Wand2 className="w-3 h-3 mx-auto"/>}
                                       </button>
                                     )}
                                     
                                     <div className="w-full h-px bg-gray-800 my-1"></div>
                                     <button onClick={() => handleInsertShot(idx)} title="插入镜头"><Plus className="w-3 h-3 text-gray-500 hover:text-blue-400 mx-auto"/></button>
                                     <button onClick={() => handleDeleteShot(shot.id)} title="删除镜头"><Trash2 className="w-3 h-3 text-gray-500 hover:text-red-500 mx-auto"/></button>
                                  </div>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
                 <button onClick={handleAddShot} className="w-full py-3 border-t border-gray-800 text-gray-500 hover:text-white flex justify-center gap-2 text-sm"><Plus className="w-4 h-4" /> 添加新镜头</button>
              </div>
            </section>
          )}

          {/* SECTION 4: KEYFRAME GENERATION */}
          {project.storyboard.length > 0 && (
             <section className="max-w-6xl mx-auto w-full animate-fade-in-up">
               <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2"><Grid className="w-5 h-5 text-blue-500" /> 关键帧生成 (Keyframe Generation)</h2>
                <button 
                  onClick={handleGenerateAllKeyframes}
                  disabled={project.isGeneratingKeyframes}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 text-xs"
                >
                   {project.isGeneratingKeyframes ? <Loader2 className="w-4 h-4 animate-spin"/> : <Zap className="w-4 h-4" />}
                   Generate All Keyframes
                </button>
               </div>
               <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
                 <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[1000px]">
                      <thead className="bg-gray-950 text-gray-400 uppercase text-xs font-semibold tracking-wider border-b border-gray-800">
                        <tr>
                          <th className="px-4 py-3 w-12 text-center">Shot</th>
                          <th className="px-4 py-3 w-[250px]">Context (Visual & Camera)</th>
                          <th className="px-4 py-3">Keyframe Breakdown (12 Frames)</th>
                          <th className="px-4 py-3 w-32 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {project.storyboard.map((shot, idx) => {
                          const kf = project.keyframes[shot.id];
                          const isLoading = loadingMap[`shot_kf_${shot.id}`] || project.isGeneratingKeyframes;
                          return (
                            <tr key={shot.id} className="hover:bg-gray-800/50">
                              <td className="px-4 py-3 text-center text-gray-500 font-mono font-bold">{idx + 1}</td>
                              
                              {/* Context */}
                              <td className="px-4 py-3 align-top text-xs space-y-2">
                                 <div><span className="text-gray-500">Visual:</span> <span className="text-gray-300">{shot.visual.substring(0, 100)}...</span></div>
                                 <div><span className="text-red-400">Cam:</span> <span className="text-gray-400">{shot.camera}</span></div>
                              </td>

                              {/* 12 Frame Breakdown */}
                              <td className="px-4 py-3 align-top">
                                {kf ? (
                                   <div className="grid grid-cols-4 gap-2">
                                     {kf.frames.map((frame, fIdx) => (
                                       <div key={fIdx} className="bg-gray-950 border border-gray-800 p-1.5 rounded text-[10px] text-gray-400 leading-tight h-16 overflow-hidden relative group">
                                          <span className="absolute top-0.5 left-1 text-[8px] text-gray-600 font-bold">{fIdx + 1}</span>
                                          <div className="mt-3 overflow-hidden h-full">{frame}</div>
                                       </div>
                                     ))}
                                   </div>
                                ) : (
                                   <div className="h-16 flex items-center justify-center border border-dashed border-gray-800 rounded text-gray-600 text-xs">
                                      {isLoading ? "Generating..." : "Not generated yet"}
                                   </div>
                                )}
                              </td>

                              {/* Action Buttons */}
                              <td className="px-4 py-3 align-middle">
                                 <button 
                                   onClick={() => handleGenerateKeyframes(shot.id)}
                                   disabled={isLoading}
                                   className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-blue-400 border border-blue-900/50 rounded flex flex-col items-center justify-center gap-1 text-xs transition-colors disabled:opacity-50"
                                 >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Grid className="w-4 h-4"/>}
                                    {kf ? 'Regenerate' : '12关键帧生成'}
                                 </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                 </div>
               </div>
             </section>
          )}

          {/* SECTION 5: VIDEO GENERATION (Only if Keyframes exist) */}
          {Object.keys(project.keyframes).length > 0 && (
             <section className="max-w-6xl mx-auto w-full animate-fade-in-up">
               <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2"><Film className="w-5 h-5 text-red-500" /> 视频生成 (Video Generation)</h2>
                 <div className="flex gap-2">
                   <button 
                    onClick={handleGenerateAllVideoPrompts}
                    disabled={isGeneratingAllVideoPrompts}
                    className="bg-red-900/40 hover:bg-red-900/60 text-red-300 border border-red-900/50 px-4 py-2 rounded-lg font-medium flex items-center gap-2 text-xs"
                   >
                     {isGeneratingAllVideoPrompts ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4" />} Generate All Prompts
                   </button>
                   <button 
                    onClick={handleAutoAssemble}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 text-xs"
                   >
                     <Scissors className="w-4 h-4" /> 自动剪辑 (Auto Assemble)
                   </button>
                 </div>
               </div>
               <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
                 <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[1000px]">
                      <thead className="bg-gray-950 text-gray-400 uppercase text-xs font-semibold tracking-wider border-b border-gray-800">
                        <tr>
                          <th className="px-4 py-3 w-12 text-center">Shot</th>
                          <th className="px-4 py-3 w-[20%]">Keyframe Source</th>
                          <th className="px-4 py-3">Video Generation Prompt (Veo/Sora)</th>
                          <th className="px-4 py-3 w-32 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {project.storyboard.map((shot, idx) => {
                          const kf = project.keyframes[shot.id];
                          if (!kf) return null; // Only show rows with keyframes
                          
                          const isLoading = loadingMap[`shot_vid_${shot.id}`] || isGeneratingAllVideoPrompts;

                          return (
                            <tr key={shot.id} className="hover:bg-gray-800/50">
                              <td className="px-4 py-3 text-center text-gray-500 font-mono font-bold">{idx + 1}</td>
                              
                              {/* Source Preview */}
                              <td className="px-4 py-3 align-top">
                                 <div className="text-xs text-gray-400 mb-1 font-mono">12 Frames Ready</div>
                                 <div className="flex gap-0.5 opacity-50">
                                   {[...Array(12)].map((_, i) => <div key={i} className="w-1.5 h-3 bg-blue-500/50 rounded-sm"></div>)}
                                 </div>
                                 <div className="mt-2 text-[10px] text-gray-600">{shot.camera}</div>
                              </td>

                              {/* Video Prompt */}
                              <td className="px-4 py-3 align-top">
                                 {kf.videoGenPrompt ? (
                                   <textarea 
                                     className="w-full h-24 bg-gray-950 border border-gray-800 rounded p-2 text-xs text-blue-300 resize-none focus:outline-none"
                                     value={kf.videoGenPrompt}
                                     readOnly
                                   />
                                 ) : (
                                   <div className="text-gray-600 text-xs italic p-4 border border-dashed border-gray-800 rounded text-center">
                                      {isLoading ? "Generating..." : "Prompt not generated"}
                                   </div>
                                 )}
                              </td>

                              {/* Action Buttons */}
                              <td className="px-4 py-3 align-middle">
                                 <button 
                                   onClick={() => handleGenerateVideoPrompt(shot.id)}
                                   disabled={isLoading}
                                   className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-red-400 border border-red-900/50 rounded flex flex-col items-center justify-center gap-1 text-xs transition-colors disabled:opacity-50"
                                 >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Video className="w-4 h-4"/>} 
                                    Gen Prompt
                                 </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                 </div>
               </div>
             </section>
          )}

          {/* NLE TIMELINE EDITOR (Hidden until assembly) */}
          {showTimeline && project.timeline.length > 0 && (
            <section id="timeline-section" className="max-w-6xl mx-auto w-full pb-32 animate-fade-in-up">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4"><Scissors className="w-5 h-5 text-purple-500" /> AI 智能剪辑 (Timeline)</h2>
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-96">
                 
                 {/* Toolbar */}
                 <div className="h-12 border-b border-gray-800 bg-gray-850 flex items-center justify-between px-4">
                    <div className="flex items-center gap-4">
                       <button className="text-gray-400 hover:text-white"><Play className="w-4 h-4"/></button>
                       <button className="text-gray-400 hover:text-white"><Pause className="w-4 h-4"/></button>
                       <span className="text-xs font-mono text-gray-500">00:00:00:00</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <button className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 rounded text-xs text-gray-300 hover:bg-gray-700 border border-gray-700"><Music className="w-3 h-3"/> Import Audio</button>
                       <button className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 rounded text-xs text-gray-300 hover:bg-gray-700 border border-gray-700"><TypeIcon className="w-3 h-3"/> Import Subtitles</button>
                    </div>
                 </div>

                 {/* Tracks Area */}
                 <div className="flex-1 overflow-x-auto overflow-y-auto bg-gray-950 relative">
                    {/* Time Ruler (Simplified) */}
                    <div className="h-6 bg-gray-900 border-b border-gray-800 sticky top-0 z-10 flex items-end">
                       {[...Array(20)].map((_, i) => (
                          <div key={i} className="flex-1 border-l border-gray-800 h-2 text-[10px] text-gray-600 pl-1">{i * 5}s</div>
                       ))}
                    </div>

                    <div className="flex flex-col min-w-[1200px]">
                      {project.timeline.map((track) => (
                         <div key={track.id} className="flex h-24 border-b border-gray-900 relative group">
                            {/* Track Header */}
                            <div className="w-32 bg-gray-900 border-r border-gray-800 flex items-center justify-center shrink-0 sticky left-0 z-20 shadow-md">
                               <span className="text-xs font-bold text-gray-500">{track.label}</span>
                            </div>
                            
                            {/* Track Items */}
                            <div className="flex-1 relative bg-gray-950/50">
                               {track.items.map((item) => {
                                  // Simple positioning calculation (scale: 1s = 20px)
                                  const scale = 20; 
                                  const left = item.startTime * scale;
                                  const width = item.duration * scale;
                                  
                                  return (
                                    <div 
                                      key={item.id}
                                      className={`absolute top-2 bottom-2 rounded-md ${item.color} border border-white/10 shadow-sm flex items-center px-2 overflow-hidden cursor-move hover:brightness-110 transition-all`}
                                      style={{ left: `${left}px`, width: `${width}px` }}
                                      title={item.content}
                                    >
                                       <span className="text-[10px] font-medium text-white/90 truncate drop-shadow-md">
                                          {item.id}
                                       </span>
                                    </div>
                                  );
                               })}
                            </div>
                         </div>
                      ))}
                    </div>
                 </div>
              </div>
            </section>
          )}

        </div>
      </main>
      <style>{`
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } 
        .animate-fade-in-up { animation: fade-in-up 0.5s ease-out forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #111827; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4b5563; }
      `}</style>
    </div>
  );
}
