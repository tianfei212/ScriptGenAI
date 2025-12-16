import React, { useState, useEffect } from 'react';
import { NodeData, NodeType, StoryboardShot } from '../types';

interface NodeCardProps {
  node: NodeData;
  onUpdate: (id: string, updates: Partial<NodeData>) => void;
  onDelete: (id: string) => void;
  onAction: (id: string, action: string, payload?: any) => void;
}

const NodeCard: React.FC<NodeCardProps> = ({ node, onUpdate, onDelete, onAction }) => {
  const [localText, setLocalText] = useState(node.prompt);
  const [selectedModel, setSelectedModel] = useState(node.selectedModel || 'gemini-3');

  // Sync local state if node updates externally
  useEffect(() => {
    setLocalText(node.prompt);
  }, [node.prompt]);

  const handleGenerateScripts = () => {
    onAction(node.id, 'GENERATE_VARIATIONS', { model: selectedModel, prompt: localText });
  };

  const handleScriptMod = (type: 'REWRITE' | 'EXPAND' | 'POLISH' | 'DECONSTRUCT') => {
    onAction(node.id, 'MODIFY_SCRIPT', { type });
  };

  const handleGenerateStoryboard = () => {
    onAction(node.id, 'GENERATE_STORYBOARD');
  };

  const updateShot = (shotId: string, field: keyof StoryboardShot, value: string) => {
    if (!node.shots) return;
    const newShots = node.shots.map(s => s.id === shotId ? { ...s, [field]: value } : s);
    onUpdate(node.id, { shots: newShots });
  };

  const getHeaderColor = () => {
    switch (node.type) {
      case NodeType.IDEA: return 'bg-yellow-500/20 border-yellow-500';
      case NodeType.SCRIPT: return 'bg-blue-500/20 border-blue-500';
      case NodeType.STORYBOARD: return 'bg-purple-500/20 border-purple-500';
      default: return 'bg-gray-800 border-gray-600';
    }
  };

  const renderModelSelector = () => (
    <select 
      value={selectedModel}
      onChange={(e) => {
        setSelectedModel(e.target.value);
        onUpdate(node.id, { selectedModel: e.target.value });
      }}
      className="bg-gray-900 border border-gray-700 text-xs rounded px-2 py-1 text-gray-300 outline-none focus:border-blue-500"
    >
      <option value="gemini-3">Gemini 3 Pro</option>
      <option value="openai">OpenAI GPT-4o</option>
      <option value="kimi">Kimi</option>
      <option value="tork">Grok (Tork)</option>
      <option value="qwan">Qwen</option>
    </select>
  );

  return (
    <div className={`
      relative flex flex-col w-[28rem] bg-gray-900/90 backdrop-blur-xl 
      border-t-4 ${getHeaderColor()} rounded-lg shadow-2xl 
      transition-all duration-300 mb-8 mx-4
      ${node.isLoading ? 'animate-pulse border-white' : ''}
    `}>
      
      {/* Header */}
      <div className="flex justify-between items-center p-3 border-b border-gray-800">
        <div className="flex items-center gap-2 font-bold text-gray-200 uppercase tracking-wider text-xs">
          {node.type === NodeType.IDEA && <span>💡 Initial Idea</span>}
          {node.type === NodeType.SCRIPT && <span>📜 Script: {node.title || 'Untitled'}</span>}
          {node.type === NodeType.STORYBOARD && <span>🎬 Storyboard</span>}
        </div>
        <div className="flex items-center gap-2">
           <button 
             onClick={() => onAction(node.id, 'TRANSLATE')}
             className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-xs text-blue-300 transition-colors border border-gray-700"
             title="Translate content to Chinese"
           >
             <span className="text-xs">文/A</span>
           </button>
           {(node.type === NodeType.IDEA || node.type === NodeType.SCRIPT) && renderModelSelector()}
          <button onClick={() => onDelete(node.id)} className="text-gray-500 hover:text-red-400 px-2">&times;</button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        
        {/* IDEA INPUT */}
        {node.type === NodeType.IDEA && (
          <>
            <textarea
              className="w-full h-32 bg-gray-950 border border-gray-800 rounded p-3 text-sm text-gray-200 focus:border-yellow-500 focus:outline-none resize-none"
              placeholder="Describe your story idea here..."
              value={localText}
              onChange={(e) => setLocalText(e.target.value)}
            />
            <button 
              onClick={handleGenerateScripts}
              disabled={node.isLoading || !localText}
              className="w-full py-2 bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-sm rounded transition-colors disabled:opacity-50"
            >
              {node.isLoading ? 'Dreaming...' : 'Generate 5 Script Options'}
            </button>
          </>
        )}

        {/* SCRIPT EDITOR */}
        {node.type === NodeType.SCRIPT && (
          <>
            <textarea
              className="w-full h-64 bg-gray-950 border border-gray-800 rounded p-3 text-sm font-mono text-gray-300 focus:border-blue-500 focus:outline-none resize-y leading-relaxed"
              value={localText}
              onChange={(e) => {
                setLocalText(e.target.value);
                onUpdate(node.id, { prompt: e.target.value });
              }}
            />
            
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => handleScriptMod('REWRITE')} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-blue-300">Rewrite</button>
              <button onClick={() => handleScriptMod('EXPAND')} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-green-300">Expand</button>
              <button onClick={() => handleScriptMod('POLISH')} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-purple-300">Polish</button>
              <button onClick={() => handleScriptMod('DECONSTRUCT')} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-orange-300">Deconstruct</button>
            </div>

            <button 
              onClick={handleGenerateStoryboard}
              disabled={node.isLoading}
              className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded transition-colors"
            >
              Generate Storyboard
            </button>
          </>
        )}

        {/* STORYBOARD TABLE */}
        {node.type === NodeType.STORYBOARD && node.shots && (
          <div className="space-y-4">
             <div className="max-h-96 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {node.shots.map((shot, idx) => (
                  <div key={idx} className="bg-gray-950 border border-gray-800 rounded p-2 text-xs space-y-2">
                     <div className="flex justify-between text-gray-500 font-mono">
                       <span>Shot #{idx + 1}</span>
                       <input 
                         className="bg-transparent text-right w-16 focus:outline-none text-gray-300"
                         value={shot.startTime || ''}
                         onChange={(e) => updateShot(shot.id, 'startTime', e.target.value)}
                       />
                     </div>
                     <div className="grid grid-cols-1 gap-1">
                        <textarea 
                          rows={2}
                          className="bg-gray-900/50 w-full p-1 rounded border-l-2 border-blue-500 focus:outline-none text-gray-300 placeholder-gray-600"
                          placeholder="Visual description..."
                          value={shot.visual}
                          onChange={(e) => updateShot(shot.id, 'visual', e.target.value)}
                        />
                         <input 
                          className="bg-gray-900/50 w-full p-1 rounded border-l-2 border-green-500 focus:outline-none text-gray-300 placeholder-gray-600"
                          placeholder="Audio/Dialogue..."
                          value={shot.audio}
                          onChange={(e) => updateShot(shot.id, 'audio', e.target.value)}
                        />
                        <input 
                          className="bg-gray-900/50 w-full p-1 rounded border-l-2 border-purple-500 focus:outline-none text-gray-300 placeholder-gray-600 font-mono"
                          placeholder="Camera..."
                          value={shot.camera}
                          onChange={(e) => updateShot(shot.id, 'camera', e.target.value)}
                        />
                     </div>
                  </div>
                ))}
             </div>
             <div className="text-center text-xs text-gray-500">
               Changes are saved automatically.
             </div>
          </div>
        )}

        {/* Status */}
        {node.isLoading && <div className="text-center text-xs text-blue-400 animate-pulse">AI is working...</div>}
        {node.error && <div className="text-center text-xs text-red-400">{node.error}</div>}
      </div>

       {/* Connection Points */}
      <div className="absolute top-1/2 -right-3 w-4 h-4 rounded-full bg-gray-700 border border-gray-500"></div>
      {node.parentId && <div className="absolute top-1/2 -left-3 w-4 h-4 rounded-full bg-gray-700 border border-gray-500"></div>}
    </div>
  );
};

export default NodeCard;