<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: [https://ai.studio/apps/drive/15CQEHT9TSpPLHAcHYDI_qighkBnzMeqf](https://service-213571702922.us-west1.run.app)

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

# ScriptGenAI - 全流程 AI 影视创作助手使用手册

**ScriptGenAI** 是一款专为影视创作者、编剧及 AI 视频制作者打造的生产力工具。它利用先进的大语言模型（LLM）和知识图谱技术，将“创意灵感”无缝转化为可执行的“分镜脚本”和“视频生成提示词”，打通了从文本到视觉创作的最后一公里。

---

## 📚 目录

- [1. 核心功能概览](#1-核心功能概览)
- [2. 快速开始](#2-快速开始)
- [3. 详细操作指南](#3-详细操作指南)
  - [3.1 创意与剧本生成](#31-创意与剧本生成)
  - [3.2 智能角色设定](#32-智能角色设定)
  - [3.3 分镜脚本与画面设计](#33-分镜脚本与画面设计-storyboard)
  - [3.4 提示词工程与微调](#34-提示词工程与微调)
  - [3.5 关键帧与视频生成](#35-关键帧与视频生成)
  - [3.6 自动剪辑与知识图谱](#36-自动剪辑与知识图谱)
- [4. 数据导出与管理](#4-数据导出与管理)
- [5. 常见问题 (FAQ)](#5-常见问题-faq)

---

## 1. 核心功能概览

* **多维创意裂变**：基于一个核心点子，结合导演风格（如诺兰、王家卫）生成多个版本的剧本方案。
* **AI 深度编辑**：支持对剧本进行扩写、润色、解构和翻译。
* **角色一致性管理**：自动提取角色特征，生成固定的人物生图提示词。
* **智能分镜系统**：将文本自动转换为包含画面、声音、机位、背景的分镜表。
* **双模提示词生成**：同时生成 **Google Gemini** 和 **Midjourney** 格式的绘画提示词。
* **视频模型桥接**：为 Sora、Veo 等视频模型生成专用的视频提示词。
* **可视化知识图谱**：实时构建项目知识网络，防止长篇创作中的逻辑冲突。

---

## 2. 快速开始

### 2.1 环境准备

首次进入系统，您需要配置 **Google Gemini API Key** 才能使用 AI 服务。

> <img width="996" height="656" alt="image" src="https://github.com/user-attachments/assets/718154da-3b32-410a-b9e6-7a2de055713d" />

>
> *图示说明：在欢迎页点击“开始创作”，输入您的 API Key。*

### 2.2 界面布局

系统采用专业的暗色模式 IDE 布局：

* **左侧边栏**：项目统计、费用估算、思维链日志。
* **顶部导航**：创作流程进度条（创意 -> 剧本 -> 分镜 -> 视频）。
* **主工作区**：核心编辑与生成区域。

---

## 3. 详细操作指南

### 3.1 创意与剧本生成

这是创作的起点。您只需输入一个模糊的想法，AI 将帮您完善它。

**操作步骤：**

1.  在“核心创意”输入框中描述您的故事想法。
2.  选择类型（如：科幻、悬疑、赛博朋克）。
3.  选择导演风格（如：克里斯托弗·诺兰、王家卫、韦斯·安德森）。
4.  设定目标时长（30秒 - 3分钟）。
5.  点击 **“生成 5 个方案”**。

><img width="2016" height="652" alt="image" src="https://github.com/user-attachments/assets/a73d96ba-a843-4b96-8f7f-b413dce11f96" />

>
> *图示说明：配置创意参数并生成剧本。*

生成后，下方会出现多个剧本标签页。您可以点击切换不同方案，并使用工具栏中的“改写”、“扩写”或“润色”功能对选定剧本进行迭代。

> <img width="2196" height="1134" alt="image" src="https://github.com/user-attachments/assets/62eb0042-693e-4935-bcca-f0da8b393ca5" />

>
> *图示说明：查看不同版本的剧本并使用 AI 工具栏进行修改。*

### 3.2 智能角色设定

AI 会自动分析当前剧本，提取所有登场角色的性格、外貌特征。

**操作步骤：**

1.  确定好剧本后，点击 **“提取角色”** 按钮。
2.  系统将生成角色卡片。您可以手动修改角色的名字或描述。
3.  点击卡片下方的 **“生成生图提示词”**，AI 将为该角色生成标准化的形象 Prompt，确保后续画面中人物一致。

> <img width="1508" height="560" alt="image" src="https://github.com/user-attachments/assets/ab7e18d4-2569-4a5e-9e0a-c25df7defb86" />

><img width="1322" height="1054" alt="image" src="https://github.com/user-attachments/assets/160a73d8-975f-43b3-be41-174d9edaf03a" />

> *图示说明：角色卡片展示及提示词生成按钮。*

### 3.3 分镜脚本与画面设计 (Storyboard)

这是将文字转化为视觉语言的关键步骤。

**操作步骤：**

1.  点击 **“生成分镜表”**。
2.  系统会将剧本拆解为逐个镜头的表格，包含：
    * **Visual**: 画面内容
    * **Audio**: 对白与音效
    * **Camera**: 运镜方式（如推拉摇移）
3.  您可以在表格中直接编辑任何单元格内容。

> <img width="2056" height="1576" alt="image" src="https://github.com/user-attachments/assets/68931e2b-7d65-45a5-b141-c8f506b1657b" />

>
> *图示说明：详细的分镜列表，展示画面、声音和机位信息。*

### 3.4 提示词工程与微调

ScriptGenAI 最大的亮点是内置了专业的提示词编辑器。

**操作步骤：**

1.  在分镜表中，点击每个镜头的 **“生成合成提示词”** 或 **“生成背景提示词”**。
2.  生成完成后，点击 **“查看/修改”** 按钮打开高级编辑器。

**高级编辑器功能：**

* 查看 Gemini 和 Midjourney 两种格式的 Prompt。
* 使用 **“AI 局部修改 (Refine)”** 功能，用自然语言调整提示词（例如输入：*“把光线调暗一点，增加赛博朋克霓虹灯”*）。

> <img width="1328" height="1066" alt="image" src="https://github.com/user-attachments/assets/c95084f1-8f98-48ec-ba09-d16cb1a0c08d" />

>
> *图示说明：提示词高级编辑器，展示 MJ/Gemini 双提示词及 AI 修改输入框。*

### 3.5 关键帧与视频生成

针对视频生成模型（如 Sora, Runway, Pika, Veo），系统提供了更精细的控制。

**操作步骤：**

1.  点击 **“生成所有关键帧 (Generate All Keyframes)”**。AI 会将每个镜头进一步拆解为 12 帧的连续动作描述。
2.  基于关键帧，点击 **`Gen Prompt`** 生成视频生成专用的提示词。

> <img width="2104" height="982" alt="image" src="https://github.com/user-attachments/assets/c5b0e8e4-5e44-452d-8839-46fba7a9efd4" />

>
> *图示说明：关键帧拆解详情及视频模型专用提示词。*

### 3.6 自动剪辑与知识图谱

**自动剪辑 (Timeline)：**

系统根据分镜的时长信息，自动在时间轴上生成预览轨道，帮助您把控视频节奏。

> <img width="2128" height="812" alt="image" src="https://github.com/user-attachments/assets/2f612a8c-1eef-4eec-b95e-f0e37b94b545" />

>
> *图示说明：可视化时间轴，展示视频轨、音频轨和字幕轨的排布。*

**知识图谱 (Knowledge Graph)：**

点击左下角的“查看知识图谱”，以可视化节点的形式查看角色关系、地点关联和核心视觉元素。这对于检查剧情逻辑漏洞非常有用。

><img width="1784" height="1502" alt="image" src="https://github.com/user-attachments/assets/70cfb65d-b9d2-48ab-8c72-f67fba8efc8a" />

>
> *图示说明：节点连接图，展示角色与场景的关联。*

---

## 4. 数据导出与管理

* **JSON 导出**：点击顶部的“导出 JSON”按钮，您可以将包含剧本、角色、分镜、提示词的完整项目文件保存到本地，便于备份或迁移。
* **成本监控**：左侧边栏实时显示 Token 消耗量和预估费用（基于 Google Gemini 定价），让您的 AI 创作成本透明可控。

> <img width="442" height="648" alt="image" src="https://github.com/user-attachments/assets/65af16e7-82e1-44bf-9a04-90a45613d8f1" />

>
> *图示说明：Token 消耗与费用预估面板。*

---

## 5. 常见问题 (FAQ)

**Q: 如何保证生成的人物长相一致？**
**A:** 请务必先在“角色设定”模块生成角色的基础提示词。后续生成分镜画面提示词时，系统会自动将角色的基础特征（Seed/Reference）融合进去。

**Q: 支持哪些语言？**
**A:** 核心逻辑支持多语言。您可以使用中文输入创意，若需要英文提示词（用于 Midjourney），系统会自动进行翻译转换。

**Q: 这里的“视频生成”是直接出视频吗？**
**A:** 不是。本工具生成的是高质量的 **视频生成提示词**。您需要复制这些提示词到 Sora、Runway 或 Pika 等工具中生成最终视频。ScriptGenAI 解决了“如何写出好提示词”这一核心难题。

---

*文档版本: v1.0 | 更新日期: 2025-07-20*
