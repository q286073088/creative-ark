# Creative Ark - 多模态AI创作平台

一个基于浏览器本地存储的多模态AI创作平台，支持AI对话、文生图、图生图等功能，提供完整的AI创作体验。

## ✨ 核心特性

- 🤖 **AI对话**: 支持文本对话和视觉多模态对话，可处理图像输入
- 🎨 **AI绘图**: 文本生成图片、图片编辑和图生图功能
- 🔄 **多提供商支持**: 支持魔塔社区、New API等多个AI服务提供商
- 🔒 **本地存储**: 所有数据和配置均存储在浏览器本地，保护用户隐私
- 🛠️ **灵活配置**: 支持动态配置API密钥和模型参数
- 📱 **响应式设计**: 基于Ant Design的现代UI界面，适配各种设备

## 🚀 快速开始

### 环境要求

- Node.js 16+
- npm 或 yarn

### 安装依赖

```bash
npm run install:all
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:5173 查看应用

### 生产部署

```bash
npm run build
npm run preview
```

## 🏗️ 技术架构

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite
- **UI组件**: Ant Design 5
- **状态管理**: React Hooks + Context
- **数据存储**: IndexedDB + localStorage
- **加密**: Crypto.js (AES加密)
- **图标**: @ant-design/icons

## 🔧 配置说明

### 环境变量配置

复制 `.env.example` 为 `.env` 并配置以下变量：

```bash
# API密钥配置
# 复制此文件为.env并填入你的API密钥

# OpenAI API密钥
VITE_OPENAI_API_KEY=your_openai_api_key_here

# ModelScope API密钥
VITE_MODELSCOPE_API_KEY=ms-4c

```

### 支持的模型

#### 文本对话模型
- Tongyi DeepResearch 30B
- Qwen3 Coder 480B
- Kimi K2 Instruct
- GLM 4.5

#### 视觉多模态模型
- Qwen3-VL-235B (支持图像输入)
- Step3 (多模态理解)

#### 图像生成模型
- FLUX.1 Krea Dev (文生图)
- Qwen Image (文生图)
- Qwen Image Edit (图生图)

## 📁 项目结构

```
src/
├── components/          # React组件
│   ├── ApiConfig.tsx   # API配置界面
│   ├── ChatInterface.tsx # AI对话界面
│   ├── ImageGeneration.tsx # 图像生成界面
│   ├── TextChat.tsx    # 文本对话组件
│   ├── VisionChat.tsx  # 视觉对话组件
│   └── GenerationHistory.tsx # 生成历史
├── config/             # 配置文件
│   └── models.ts       # 模型配置
├── utils/              # 工具函数
│   └── apiConfig.ts    # API配置工具
├── App.tsx             # 主应用组件
└── main.tsx            # 应用入口
```

## 🔒 安全特性

- **本地数据存储**: 所有用户数据仅存储在浏览器本地
- **API密钥加密**: 使用AES加密算法存储API密钥
- **无后端依赖**: 不依赖后端数据库，完全保护用户隐私
- **环境变量隔离**: 敏感配置通过环境变量管理

## 🎯 使用指南

### 1. API配置
- 点击右上角"设置"按钮
- 选择AI服务提供商
- 输入API密钥
- 保存配置（密钥会本地加密存储）

### 2. AI对话
- 选择"AI对话"标签
- 选择文本对话或视觉对话
- 输入提示词，视觉对话可上传图片
- 点击发送开始对话

### 3. 图像生成
- 选择"图像生成"标签
- 输入图像描述提示词
- 选择生成参数（如尺寸、风格等）
- 点击生成按钮创建图像

### 4. 图像编辑
- 在图像生成界面选择"图生图"模式
- 上传原始图片
- 输入编辑描述
- 生成编辑后的图像

## 🛠️ 开发说明

### 添加新的AI提供商

1. 在 `.env` 中添加新的提供商ID到 `VITE_PROVIDER_IDS`
2. 配置对应的环境变量：
   - `VITE_PROVIDER_{ID}_NAME`
   - `VITE_PROVIDER_{ID}_BASE_URL`
   - `VITE_PROVIDER_{ID}_API_KEY`
   - 各种模型类型的配置
3. 重启应用即可使用新提供商

### 扩展模型类型

在 `src/config/models.ts` 中可以扩展支持更多模型类型：
- 视频生成模型
- 语音合成模型
- 其他多模态模型

## 📄 许可证

MIT License