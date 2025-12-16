
import { GoogleGenAI, Type } from "@google/genai";
import { KnowledgeGraph, KGEntity, KGRelation } from "../types";

const LOCAL_STORAGE_KEY = 'scriptgen_kg_v1';

const emitLog = (message: string, type: 'info' | 'success' | 'error' | 'ai' = 'info') => {
  window.dispatchEvent(new CustomEvent('app-log', { 
    detail: { message, type, timestamp: new Date().toLocaleTimeString() } 
  }));
};

const emitTokenUsage = (usageMetadata: any) => {
  if (!usageMetadata) return;
  window.dispatchEvent(new CustomEvent('app-token-usage', { 
    detail: { 
      input: usageMetadata.promptTokenCount || 0,
      output: usageMetadata.candidatesTokenCount || 0
    } 
  }));
};

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

// --- Local Storage Management ---

export const loadGraph = (): KnowledgeGraph => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error("Failed to load KG", e);
  }
  return { nodes: [], links: [] };
};

export const saveGraph = (graph: KnowledgeGraph) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(graph));
  } catch (e) {
    console.error("Failed to save KG", e);
  }
};

/**
 * Filter the graph to only include nodes relevant to the current scope.
 * Scope Logic: Include 'global' (Idea) + 'currentScriptId' (Specific Variation).
 */
export const getScopedGraph = (scopeId: string | null): KnowledgeGraph => {
  const fullGraph = loadGraph();
  if (!scopeId) {
    // If no scope provided, only return global nodes
    const nodes = fullGraph.nodes.filter(n => n.scopeId === 'global');
    const nodeIds = new Set(nodes.map(n => n.id));
    const links = fullGraph.links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));
    return { nodes, links };
  }

  // Return Global + Specific Script
  const nodes = fullGraph.nodes.filter(n => n.scopeId === 'global' || n.scopeId === scopeId);
  const nodeIds = new Set(nodes.map(n => n.id));
  const links = fullGraph.links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));
  
  return { nodes, links };
};

// --- RAG: Retrieval Logic ---

/**
 * Common logic to find relevant nodes and their 1-hop neighbors within the active scope.
 */
const findRelevantGraphSubset = (graph: KnowledgeGraph, query: string) => {
  if (!query || !query.trim()) return { relevantNodes: [], relevantLinks: [] };

  const lowerQuery = query.toLowerCase();

  // 1. Direct Hit
  const directHits = graph.nodes.filter(node => 
    node.label.toLowerCase().includes(lowerQuery) || 
    (node.label.length > 1 && node.label.split('').some(char => lowerQuery.includes(char))) 
  );

  if (directHits.length === 0) return { relevantNodes: [], relevantLinks: [] };

  const hitIds = new Set(directHits.map(n => n.id));
  const finalNodeIds = new Set(hitIds);
  const relevantLinks: KGRelation[] = [];

  // 2. Expansion
  graph.links.forEach(link => {
    if (hitIds.has(link.source)) {
      relevantLinks.push(link);
      finalNodeIds.add(link.target);
    } else if (hitIds.has(link.target)) {
      relevantLinks.push(link);
      finalNodeIds.add(link.source);
    }
  });

  const relevantNodes = graph.nodes.filter(n => finalNodeIds.has(n.id));

  return { relevantNodes, relevantLinks };
};

/**
 * Text-based RAG for Gemini
 */
export const retrieveContext = async (query: string, activeScriptId: string | null): Promise<string> => {
  // IMPORTANT: Only load graph data relevant to the current script
  const scopedGraph = getScopedGraph(activeScriptId);
  
  if (scopedGraph.nodes.length === 0) return "";

  const { relevantLinks } = findRelevantGraphSubset(scopedGraph, query);

  if (relevantLinks.length === 0) return "";

  const contextTriples = relevantLinks.map(link => {
     const sourceLabel = scopedGraph.nodes.find(n => n.id === link.source)?.label;
     const targetLabel = scopedGraph.nodes.find(n => n.id === link.target)?.label;
     if (sourceLabel && targetLabel) {
       return `${sourceLabel} --[${link.label}]--> ${targetLabel}`;
     }
     return null;
  }).filter(Boolean);

  const context = contextTriples.slice(0, 15).join("；");
  
  if (!context) return "";

  return `\n\n[知识库记忆 (RAG Context)]: 基于当前剧本方案，我检索到了相关概念：${context}。请确保设定一致性。`;
};

/**
 * Visual RAG Simulation
 */
export const simulateRetrieval = (query: string, activeScriptId: string | null): Set<string> => {
  const scopedGraph = getScopedGraph(activeScriptId);
  const { relevantNodes } = findRelevantGraphSubset(scopedGraph, query);
  return new Set(relevantNodes.map(n => n.id));
};

// --- Knowledge Extraction ---

/**
 * Extracts entities and relationships.
 * @param text The text to analyze.
 * @param scopeId 'global' for the idea, or a scriptId for specific variations.
 */
export const extractAndStoreKnowledge = async (text: string, scopeId: string = 'global') => {
  const ai = getClient();
  if (!ai || !text || text.length < 50) return;
  
  emitLog(`正在提取知识图谱 (${scopeId === 'global' ? '全局' : '局部'})...`, 'ai');

  const model = "gemini-3-pro-preview";

  const prompt = `你是一位专业的知识图谱工程师。
  请从下方的影视剧本/创意文本中提取关键实体和关系，构建知识图谱。
  
  请特别关注以下两类关系，并使用中文输出：
  1. **人物关系 (Character Relationships)**：角色之间的社会关系或情感连接。
  2. **视听语言 (Visual Language)**：场景的灯光氛围、镜头运动方式与剧情的关系。
  
  实体类型 (Types) 请严格使用以下分类:
  - CHARACTER (人物)
  - LOCATION (场景/地点)
  - THEME (主题)
  - STYLE (风格)
  - OBJECT (关键道具)
  - LIGHTING (灯光/色调) - 例如：赛博霓虹、低调光、自然光
  - CAMERA (运镜/机位) - 例如：手持跟拍、上帝视角、特写

  输出必须是纯 JSON 格式：
  {
    "entities": [{"label": "实体名(中文)", "type": "TYPE"}],
    "relations": [{"source": "实体名1", "target": "实体名2", "relation": "关系名(中文)"}]
  }
  
  文本内容:
  ${text.substring(0, 3000)}
  `;

  try {
    emitLog(`[PROMPT] 发送知识图谱提取请求:\n${prompt}`, 'ai');
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    emitTokenUsage(response.usageMetadata);

    const textResponse = response.text || "{}";
    const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const json = JSON.parse(cleanJson);
    if (json.entities && json.relations) {
        mergeKnowledge(json.entities, json.relations, scopeId);
        emitLog(`提取成功: ${json.entities.length} 实体, ${json.relations.length} 关系`, 'success');
    }
  } catch (e) {
    console.error("KG Extraction failed:", e);
    emitLog("知识提取失败", 'error');
  }
};

const mergeKnowledge = (newEntities: any[], newRelations: any[], scopeId: string) => {
  const graph = loadGraph();
  let updated = false;

  newEntities.forEach(e => {
    if (!e.label || e.label.length < 2) return;
    
    // Check if node exists in THIS scope or GLOBAL scope
    // If it exists in Global, we don't need to re-add it to script scope (inheritance)
    // If it exists in current Scope, update weight.
    const existing = graph.nodes.find(n => n.label === e.label && (n.scopeId === scopeId || n.scopeId === 'global'));
    
    if (existing) {
      existing.weight += 1;
    } else {
      graph.nodes.push({
        // FIX: Removed duplicate 'id' property and cleaned up conflicting comments.
        id: e.label, 
        label: e.label,
        type: e.type,
        weight: 1,
        scopeId: scopeId
      });
      updated = true;
    }
  });

  newRelations.forEach(r => {
    // Only add link if both nodes exist (or can be found in loaded graph)
    // Note: relations definitely need to be scoped.
    const existingLink = graph.links.find(l => 
        l.source === r.source && 
        l.target === r.target && 
        l.label === r.relation && 
        l.scopeId === scopeId
    );

    if (!existingLink) {
      graph.links.push({
        source: r.source,
        target: r.target,
        label: r.relation,
        scopeId: scopeId
      });
      updated = true;
    }
  });

  if (updated) {
    saveGraph(graph);
    window.dispatchEvent(new Event('kg-updated'));
  }
};
