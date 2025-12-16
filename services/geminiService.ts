
import { GoogleGenAI, Type } from "@google/genai";
import { ScriptVersion, StoryboardShot, ScriptAction, Character, ImagePrompts, KeyframeData } from "../types";
import { retrieveContext, extractAndStoreKnowledge } from "./knowledgeService";

// --- Event Helpers for Logs & Tokens ---

const emitLog = (message: string, type: 'info' | 'success' | 'error' | 'ai' = 'info') => {
  const event = new CustomEvent('app-log', { 
    detail: { message, type, timestamp: new Date().toLocaleTimeString() } 
  });
  window.dispatchEvent(event);
};

const emitTokenUsage = (usageMetadata: any) => {
  if (!usageMetadata) return;
  const event = new CustomEvent('app-token-usage', { 
    detail: { 
      input: usageMetadata.promptTokenCount || 0,
      output: usageMetadata.candidatesTokenCount || 0
    } 
  });
  window.dispatchEvent(event);
};

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    emitLog("API Key missing", 'error');
    throw new Error("请先选择 API Key");
  }
  return new GoogleGenAI({ apiKey });
};

// Simple UUID fallback
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const safeParseJSON = (text: string) => {
  // console.log("Raw AI response:", text); // Removed to reduce console noise, relying on UI logs
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    // Continue
  }
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/i;
  const match = text.match(codeBlockRegex);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      // Continue
    }
  }
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  let candidate = "";
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    const lastBrace = text.lastIndexOf('}');
    if (lastBrace > firstBrace) candidate = text.substring(firstBrace, lastBrace + 1);
  } else if (firstBracket !== -1) {
    const lastBracket = text.lastIndexOf(']');
    if (lastBracket > firstBracket) candidate = text.substring(firstBracket, lastBracket + 1);
  }
  if (candidate) {
    try {
      return JSON.parse(candidate);
    } catch (e) {
      console.error("Heuristic parse failed:", e);
    }
  }
  return null;
};

/**
 * Generate 5 Distinct Script Concepts
 */
export const generateScriptVariations = async (idea: string, genre?: string, directorStyle?: string, duration: string = "3分钟"): Promise<ScriptVersion[]> => {
  emitLog(`正在分析创意: "${idea.substring(0, 20)}..."`, 'info');
  
  const ai = getClient();
  const model = "gemini-3-pro-preview"; 

  // 1. Extract Global Knowledge from the Idea immediately
  extractAndStoreKnowledge(idea, 'global');

  // 2. Retrieve context (Global scope only at this stage)
  emitLog("正在检索 RAG 上下文...", 'ai');
  const ragContext = await retrieveContext(idea, null);

  let prompt = `请严格按照以下步骤进行思考和创作：

  **步骤一：语义理解**
  **角色设定：你是一位世界知名的制片人 + 故事分析师。**
  任务：请对用户的创意：“${idea}”进行极深度的语义分析。精准提取其核心主题、隐喻、情感基调、人物深层动机以及潜在的戏剧冲突点。
  
  ${ragContext}

  **步骤二：剧本生成**
  **角色设定：你是一位世界知名类型化编剧，擅长根据影片类型创建各种场景。**
  任务：基于步骤一的深度理解，创作 5 个完全不同的剧本大纲。行文需要优美、准确，具有极强的电影感和画面张力。
  \n`;

  if (genre && genre !== 'auto') {
    prompt += `**核心要求：所有的剧本都必须属于“${genre}”类型。**\n在此类型限制下，请探索 5 种不同的子类型、叙事角度或风格设定。\n`;
  } else {
    prompt += `**核心要求：每一个剧本必须有完全独特的类型（如：悬疑、喜剧、科幻、感人、惊悚等），风格差异要大，挖掘不同的可能性。**\n`;
  }

  if (directorStyle && directorStyle !== 'none') {
    prompt += `**导演风格致敬：请强烈模仿导演“${directorStyle}”的叙事风格、镜头语言和美学特征。**\n例如：如果选择诺兰，请注重非线性叙事和宏大概念；如果选择王家卫，请注重独白、时间流逝感和抽帧视觉描述。\n`;
  }

  prompt += `
  通用要求：
  1. 适合 ${duration} 短片。
  2. 使用简体中文。
  3. 必须返回符合下方 Schema 的 JSON 对象。
  `;

  try {
    emitLog(`[PROMPT] 发送剧本生成请求:\n${prompt}`, 'ai');
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scripts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Script title and specific genre/style" },
                  content: { type: Type.STRING, description: "Detailed script content" },
                },
                required: ["title", "content"]
              },
            },
          },
          required: ["scripts"]
        },
      },
    });

    emitTokenUsage(response.usageMetadata);
    emitLog("剧本生成完成，正在解析...", 'success');

    const text = response.text;
    if (!text) throw new Error("无返回内容");
    
    let data = safeParseJSON(text);
    if (!data) throw new Error("无法解析 AI 返回的 JSON 数据");
    
    let scriptsArray = [];
    if (data && Array.isArray(data.scripts)) {
      scriptsArray = data.scripts;
    } else if (Array.isArray(data)) {
      scriptsArray = data;
    } else if (data && typeof data === 'object') {
       if (Array.isArray((data as any).items)) scriptsArray = (data as any).items;
       else scriptsArray = [data]; 
    }

    scriptsArray = scriptsArray.filter((s: any) => s && (s.title || s.content));

    if (scriptsArray.length === 0) {
      throw new Error("未能解析出有效的剧本数据");
    }

    const processedScripts = scriptsArray.map((item: any) => ({
      id: generateId(),
      title: item.title || "未命名剧本",
      content: item.content || "",
    }));

    // SCOPED Knowledge Extraction
    emitLog("正在提取新剧本的知识点...", 'ai');
    processedScripts.forEach((script: ScriptVersion) => {
      const combinedText = `标题:${script.title}\n内容:${script.content}`;
      extractAndStoreKnowledge(combinedText, script.id);
    });

    return processedScripts;

  } catch (e: any) {
    emitLog(`生成剧本失败: ${e.message}`, 'error');
    console.error("Generate Scripts Error:", e);
    throw new Error(e.message || "生成剧本失败");
  }
};

/**
 * Modify a Script
 */
export const modifyScript = async (currentScript: string, scriptTitle: string, action: ScriptAction, customInstruction?: string): Promise<string> => {
  emitLog(`正在执行剧本修改: ${action}...`, 'info');
  const ai = getClient();
  const model = "gemini-3-pro-preview";
  
  const ragContext = await retrieveContext(scriptTitle + " " + customInstruction, null);

  let persona = "";
  let promptTask = "";
  let userInstructionContext = customInstruction ? `\n**用户特别指令：${customInstruction}**` : "";

  switch (action) {
    case 'REWRITE': 
      persona = "你是一个世界知名的编剧组（多人头脑风暴）。";
      promptTask = `请作为编剧团队，根据用户的特别指令对剧本进行方向性的改写，集思广益，打破常规。`; 
      break;
    case 'EXPAND': 
      persona = "你是一位世界知名的主编剧。";
      promptTask = `请基于“当前剧本内容”进行深度扩写，丰富情节细节，完善结构。`; 
      break;
    case 'POLISH': 
      persona = "你是一位世界知名的文学经理 + 对白师。";
      promptTask = `请对“当前剧本内容”进行精细润色，优化对白潜台词，提升文学质感。`; 
      break;
    case 'DECONSTRUCT': 
      persona = "你是一位世界知名的分镜头剧本师。";
      promptTask = `请对“当前剧本内容”进行解构重组，使其更符合拍摄逻辑和视觉叙事效率。`; 
      break;
  }

  const fullPrompt = `**角色设定：${persona}**
    
  **当前剧本标题：** ${scriptTitle}
  
  **当前剧本内容：**
  ${currentScript}

  ${userInstructionContext}
  
  ${ragContext}

  **任务执行：**
  ${promptTask}
  
  请直接输出修改后的完整剧本（简体中文），无需输出任何解释性文字或前言后语。`;

  try {
    emitLog(`[PROMPT] 发送剧本修改请求:\n${fullPrompt}`, 'ai');
    const response = await ai.models.generateContent({
      model,
      contents: fullPrompt,
    });
    emitTokenUsage(response.usageMetadata);
    emitLog("剧本修改完成", 'success');
    
    const resultText = response.text || currentScript;
    return resultText;
  } catch (e: any) {
    emitLog(`修改失败: ${e.message}`, 'error');
    throw e;
  }
};

/**
 * Generate Characters from Script
 */
export const generateCharacters = async (scriptContent: string): Promise<Character[]> => {
  emitLog("开始分析剧本角色...", 'info');
  const ai = getClient();
  const model = "gemini-3-pro-preview";

  const prompt = `**角色设定：你是一位世界知名的人物设定专家和心理画像专家以及美术指导 + 化妆造型师。**
  任务：请阅读以下剧本，深度剖析所有主要角色，并为他们设计详细的视觉形象和心理特征。
  
  **核心指令：输出语言必须是简体中文 (Simplified Chinese)。无论输入是什么语言，返回的 JSON 值中的 name 和 description 必须是中文。**
  
  剧本：
  ${scriptContent}
  
  要求：输出 JSON，包含 characters 数组 (name, description)。
  - Description 必须具体、直观，包含外貌、服饰、气质等细节，适合作为后续生成的 Prompt。
  `;

  try {
    emitLog(`[PROMPT] 发送角色提取请求:\n${prompt}`, 'ai');
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            characters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ["name", "description"]
              }
            }
          },
          required: ["characters"]
        }
      }
    });

    emitTokenUsage(response.usageMetadata);
    emitLog("角色生成完成", 'success');

    const text = response.text;
    if (!text) return [];

    let data = safeParseJSON(text);
    let charsArray = [];

    if (data && Array.isArray(data.characters)) {
      charsArray = data.characters;
    } else if (Array.isArray(data)) {
      charsArray = data;
    }

    return charsArray.map((c: any) => ({
      id: generateId(),
      name: c.name || "未命名角色",
      description: c.description || "暂无描述"
    }));

  } catch (e: any) {
     emitLog(`角色生成失败: ${e.message}`, 'error');
     console.error("Generate Characters Error:", e);
     throw new Error(e.message || "生成角色失败");
  }
};

/**
 * Generate Storyboard
 */
export const generateStoryboard = async (scriptContent: string, characters: Character[], duration: string): Promise<StoryboardShot[]> => {
  emitLog(`开始规划分镜头 (目标时长: ${duration})...`, 'info');
  const ai = getClient();
  const model = "gemini-3-pro-preview"; 

  const characterContext = characters.length > 0 
    ? `\n**角色参考 (必须严格遵守以下视觉描述):**\n` + characters.map(c => `- ${c.name}: ${c.description}`).join('\n')
    : "";

  const prompt = `**角色设定：你是一位世界知名的分镜师 + 摄影师。**
  
  你需要同时具备以下两个角色的思维来辅助后续生成：
  1. **概念设计师 + 插画师** (为 Visual 提供画面参考)
  2. **场景设计师 + 美术助理** (为 Background 提供布景细节)

  任务：请将剧本转化为一个完整、详细的短片分镜头表。
  
  **重要要求：**
  1. **目标时长**：影片的总时长必须严格控制在 **${duration}** 左右。
  2. **镜头密度**：请根据目标时长合理规划镜头数量（每分钟约 15-20 个镜头）。请务必生成足够多的镜头来完整表现剧情，切勿通过“一镜到底”或简单的概括来偷懒。我们需要详细的视觉流。
  3. **语言**：所有描述必须使用 **简体中文**。

  剧本：
  ${scriptContent}
  ${characterContext}
  
  要求：输出 JSON，包含 shots 数组 (visual, audio, camera, character, background, duration)。
  - visual: 画面内容描述，侧重构图和动作，画面感强。
  - camera: 专业的摄影机位术语 (如: 推轨, 特写, 荷兰角, 浅景深)。
  - background: 场景美术设定。
  - character: 画面中出现的所有角色的名字。如果有多人，请用逗号分隔，并简述其状态。确保不遗漏剧本中提及的任何在场角色。
  - duration: 预估时长 (如 "4s")。
  `;

  try {
    emitLog(`[PROMPT] 发送分镜生成请求:\n${prompt}`, 'ai');
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shots: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  visual: { type: Type.STRING },
                  audio: { type: Type.STRING },
                  camera: { type: Type.STRING },
                  character: { type: Type.STRING },
                  background: { type: Type.STRING },
                  duration: { type: Type.STRING },
                },
                required: ["visual", "camera", "background", "character"]
              },
            },
          },
          required: ["shots"]
        },
      },
    });

    emitTokenUsage(response.usageMetadata);
    emitLog(`分镜头生成完成`, 'success');

    const text = response.text;
    let data = safeParseJSON(text);
    let shotsArray = [];

    if (data && Array.isArray(data.shots)) {
      shotsArray = data.shots;
    } else if (Array.isArray(data)) {
      shotsArray = data;
    } else if (data && typeof data === 'object') {
       if (Array.isArray((data as any).items)) shotsArray = (data as any).items;
       else if ((data as any).visual) shotsArray = [data]; 
    }
    
    if (!shotsArray || shotsArray.length === 0) return [];

    return shotsArray.map((item: any) => ({
      id: generateId(),
      visual: item.visual || "",
      audio: item.audio || "",
      camera: item.camera || "",
      character: item.character || "",
      background: item.background || "",
      duration: item.duration || "3s",
      startTime: ""
    }));
  } catch (e: any) {
    emitLog(`分镜生成失败: ${e.message}`, 'error');
    console.error("Storyboard Generation Error:", e);
    throw new Error(e.message || "生成分镜失败");
  }
};

/**
 * Generate Dual Image Prompts (Gemini + MJ)
 */
export const generateImagePrompts = async (context: string, type: 'CHARACTER' | 'BACKGROUND' | 'COMPOSITE'): Promise<ImagePrompts> => {
  emitLog(`正在生成 ${type} 生图提示词...`, 'ai');
  const ai = getClient();
  const model = "gemini-3-pro-preview";
  
  let taskDesc = "";
  if (type === 'CHARACTER') {
      taskDesc = "为该角色生成生图提示词。重点关注面部特征、服饰细节、性格气质。";
  } else if (type === 'BACKGROUND') {
      taskDesc = "为该场景生成生图提示词。重点关注光影、构图、氛围、环境细节，排除人物。";
  } else {
      taskDesc = "为该镜头生成完整合成画面的提示词。结合人物动作、环境背景、运镜方式，形成电影级的画面描述。";
  }

  const prompt = `你是一位精通 AI 绘画的提示词工程师 (Prompt Engineer)。
  任务：${taskDesc}
  
  输入内容：
  "${context}"
  
  请生成两个版本的提示词，并以 JSON 格式返回：
  1. **gemini**: 适合 Gemini 3 Image (Imagen 3) 的自然语言描述，英语，细节丰富，极具画面感，包含光影和风格描述。
  2. **midjourney**: 适合 Midjourney v6 的关键词格式，英语，逗号分隔，包含参数 (如 --ar 16:9 --v 6.0)。
  
  Output JSON Schema:
  { "gemini": "string", "midjourney": "string" }
  `;

  try {
    emitLog(`[PROMPT] 发送 Prompt 生成请求:\n${prompt}`, 'ai');
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                gemini: { type: Type.STRING },
                midjourney: { type: Type.STRING }
            },
            required: ["gemini", "midjourney"]
        }
      }
    });
    emitTokenUsage(response.usageMetadata);
    
    const data = safeParseJSON(response.text);
    if (!data) throw new Error("Format Error");
    
    emitLog(`${type} 提示词生成成功`, 'success');
    return {
        gemini: data.gemini,
        midjourney: data.midjourney
    };
  } catch (e: any) {
    emitLog(`Prompt 生成失败: ${e.message}`, 'error');
    throw e;
  }
};

/**
 * Refine/Edit Image Prompts based on User Instruction
 */
export const refineImagePrompt = async (original: ImagePrompts, instruction: string): Promise<ImagePrompts> => {
  emitLog(`正在局部修改提示词: "${instruction}"`, 'info');
  const ai = getClient();
  const model = "gemini-3-pro-preview";

  const prompt = `你是一位 AI 绘画助手。用户希望修改现有的提示词。
  
  原始提示词 (Gemini): ${original.gemini}
  原始提示词 (Midjourney): ${original.midjourney}
  
  修改指令: "${instruction}"
  
  请根据指令调整两个版本的提示词。保持英语。
  
  Output JSON Schema:
  { "gemini": "string", "midjourney": "string" }
  `;

  try {
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    gemini: { type: Type.STRING },
                    midjourney: { type: Type.STRING }
                },
                required: ["gemini", "midjourney"]
            }
        }
    });
    emitTokenUsage(response.usageMetadata);
    const data = safeParseJSON(response.text);
    if (!data) throw new Error("Format Error");
    
    emitLog(`提示词修改完成`, 'success');
    return { gemini: data.gemini, midjourney: data.midjourney };
  } catch (e: any) {
    emitLog(`修改失败: ${e.message}`, 'error');
    throw e;
  }
};

/**
 * NEW: Generate 12 Keyframe Descriptions for a Shot
 */
export const generateKeyframeBreakdown = async (
  shot: StoryboardShot,
  allCharacters: Character[]
): Promise<string[]> => {
  emitLog(`正在生成镜头 #${shot.id} 的关键帧序列...`, 'info');
  const ai = getClient();
  const model = "gemini-3-pro-preview";

  // Match Characters
  let charContext = "无主要角色";
  if (shot.character) {
      const charNames = shot.character.split(/,|，/).map(s => s.trim());
      const matched = allCharacters.filter(c => charNames.some(name => c.name.includes(name) || name.includes(c.name)));
      if (matched.length > 0) {
        charContext = matched.map(c => `[角色: ${c.name}] 特征: ${c.description}`).join('\n');
      } else {
        charContext = `[角色描述]: ${shot.character}`;
      }
  }

  const prompt = `你是一位顶级动画导演和分镜艺术家。
  任务：将以下这个镜头的动作分解为 **12 张** 连续的关键帧画面描述（Keyframes）。
  
  **输入镜头信息：**
  - 画面内容 (Visual): ${shot.visual}
  - 角色信息: ${charContext}
  - 环境背景: ${shot.background}
  - 运镜 (Camera): ${shot.camera}
  - 持续时间: ${shot.duration}
  
  **要求：**
  1. 生成 12 个独立的描述，代表时间轴上均匀分布的 12 个时刻。
  2. 描述必须连贯，体现动作的起步、发展和结束 (Motion Progression)。
  3. 必须结合角色特征和环境。
  4. 使用简体中文。
  5. 返回纯 JSON 数组：["frame 1 desc", "frame 2 desc", ... "frame 12 desc"]
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                frames: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["frames"]
        }
      }
    });
    emitTokenUsage(response.usageMetadata);
    
    const data = safeParseJSON(response.text);
    if (!data || !data.frames || data.frames.length === 0) throw new Error("Keyframe generation returned empty.");
    
    // Ensure we have exactly 12 (pad or slice)
    let frames = data.frames as string[];
    if (frames.length > 12) frames = frames.slice(0, 12);
    while (frames.length < 12) frames.push(frames[frames.length - 1]);

    return frames;

  } catch (e: any) {
    emitLog(`关键帧生成失败: ${e.message}`, 'error');
    throw e;
  }
};

/**
 * NEW: Generate Video Generation Prompt (e.g. for Veo/Sora)
 */
export const generateVideoGenerationPrompt = async (
  shot: StoryboardShot,
  keyframes: string[]
): Promise<string> => {
  emitLog(`正在生成视频生成提示词...`, 'ai');
  const ai = getClient();
  const model = "gemini-3-pro-preview";

  const prompt = `你是一位精通 Veo/Sora 等视频生成模型的提示词专家。
  任务：根据提供的 12 帧关键帧描述，编写一个**连贯、流畅、高质量**的视频生成提示词 (Video Prompt)。
  
  输入关键帧序列：
  ${keyframes.map((f, i) => `${i+1}. ${f}`).join('\n')}
  
  运镜要求: ${shot.camera}
  
  **要求：**
  1. 输出为一段完整的英文 Prompt。
  2. 强调动作的流畅性 (fluid motion)、光影一致性 (consistent lighting) 和电影质感 (cinematic look)。
  3. 包含画质参数关键词 (如: 4k, high resolution, photorealistic)。
  4. 不要分段，生成一段纯文本。
  
  Output Schema: { "prompt": "string" }
  `;

  try {
     const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: { prompt: { type: Type.STRING } },
            required: ["prompt"]
        }
      }
    });
    emitTokenUsage(response.usageMetadata);
    const data = safeParseJSON(response.text);
    return data?.prompt || "";
  } catch (e: any) {
    emitLog(`视频提示词生成失败: ${e.message}`, 'error');
    return "";
  }
};

export const translateText = async (text: string): Promise<string> => {
  emitLog("正在翻译...", 'info');
  const ai = getClient();
  const model = "gemini-3-pro-preview";
  if (!text) return "";
  const prompt = `Translate to/from Chinese/English (Literary/Script Style):\n${text}`;
  try {
    const response = await ai.models.generateContent({model, contents: prompt});
    emitTokenUsage(response.usageMetadata);
    return response.text || text;
  } catch (e) {
    return text;
  }
};

export const translateCharacters = async (characters: Character[]): Promise<Character[]> => {
  emitLog("翻译角色设定...", 'info');
  const ai = getClient();
  const model = "gemini-3-pro-preview";
  if (!characters || characters.length === 0) return [];
  
  const prompt = `Translate the following JSON character descriptions to Chinese (if English) or English (if Chinese). Return JSON Array with same structure.
  ${JSON.stringify(characters.map(c => ({ id: c.id, name: c.name, description: c.description })))}
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    emitTokenUsage(response.usageMetadata);
    const translated = safeParseJSON(response.text);
    if (!translated || !Array.isArray(translated)) return characters;
    
    const idMap = new Map(translated.map((t:any) => [t.id, t]));
    
    return characters.map(c => {
        const t = idMap.get(c.id);
        return t ? { ...c, name: t.name, description: t.description } : c;
    });
  } catch (e) {
    console.error("Translate Characters Error", e);
    return characters;
  }
};

export const translateStoryboardData = async (shots: StoryboardShot[]): Promise<StoryboardShot[]> => {
  emitLog("翻译分镜头...", 'info');
  const ai = getClient();
  const model = "gemini-3-pro-preview";
  if (!shots || shots.length === 0) return [];
  const dataToTranslate = shots.map(s => ({
    id: s.id,
    visual: s.visual,
    audio: s.audio,
    camera: s.camera,
    character: s.character,
    background: s.background
  }));
  const prompt = `Translate JSON values to/from Chinese/English (Film Terminology). Return JSON Array.\n${JSON.stringify(dataToTranslate)}`;
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    emitTokenUsage(response.usageMetadata);
    const translatedData = safeParseJSON(response.text);
    if (!translatedData || !Array.isArray(translatedData)) return shots;
    const idMap = new Map(translatedData.map((item: any) => [item.id, item]));
    return shots.map(shot => {
      const translated = idMap.get(shot.id);
      if (translated) {
        return {
          ...shot,
          visual: translated.visual || shot.visual,
          audio: translated.audio || shot.audio,
          camera: translated.camera || shot.camera,
          character: translated.character || shot.character,
          background: translated.background || shot.background
        };
      }
      return shot;
    });
  } catch (e) {
    return shots;
  }
};
