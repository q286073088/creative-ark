# Creative Ark - 多模态AI创作平台

## 项目概述

Creative Ark 是一个基于浏览器本地存储的多模态AI创作平台，支持AI对话、文生图、图生图等功能，提供完整的AI创作体验。该平台允许用户通过多种AI提供商（如魔塔社区、New API等）进行文本对话、视觉多模态对话以及图像生成和编辑。

### 核心功能
- AI对话（文本对话和视觉多模态对话）
- AI绘图（文本生成图片、图片编辑和图生图功能）
- 多提供商支持（魔塔社区、New API等多个AI服务提供商）
- 本地数据存储（所有数据和配置均存储在浏览器本地，保护用户隐私）
- AES加密的API密钥存储
- 响应式设计的现代化界面（基于Ant Design）

### 技术架构
- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite
- **UI组件**: Ant Design 5
- **状态管理**: React Hooks + Context
- **数据存储**: IndexedDB + localStorage
- **加密**: Crypto.js (AES加密)
- **图标**: @ant-design/icons
- **代理**: Vite开发服务器代理

## 项目结构

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

## 环境配置

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

## API提供商配置

### 内置提供商

1. **魔塔社区 (ModelScope)**
   - 文本对话模型: Tongyi-DeepResearch-30B, Qwen3-Coder-480B, Kimi-K2-Instruct, GLM-4.5
   - 视觉对话模型: Qwen3-VL-235B, Step3
   - 图像生成模型: FLUX.1-Krea-dev, Qwen-Image
   - 图像编辑模型: Qwen-Image-Edit

2. **New API 渠道**
   - 支持标准 OpenAI API 兼容接口
   - 包含 GPT-4o 和 GPT-4o 视觉版

### 添加新提供商

1. 在 `.env` 中添加新的提供商ID到 `VITE_PROVIDER_IDS`
2. 配置对应的环境变量：
   - `VITE_PROVIDER_{ID}_NAME`
   - `VITE_PROVIDER_{ID}_BASE_URL`
   - `VITE_PROVIDER_{ID}_API_KEY`
   - 各种模型类型的配置
3. 重启应用即可使用新提供商

## 构建和运行

### 开发模式

```bash
npm run install:all
npm run dev
```

访问 http://localhost:5173 查看应用

### 生产构建

```bash
npm run build
npm run preview
```

## 核心功能组件

### 1. AI对话界面 (ChatInterface.tsx)
- 支持文本和视觉多模态对话
- 支持上传图片进行视觉对话
- 保存对话历史到本地存储
- 支持重新生成、创建对话分支等功能

### 2. 图像生成界面 (ImageGeneration.tsx)
- 支持文本生成图片和图片编辑
- 支持多种图像尺寸选择
- 本地保存生成历史
- 支持下载生成的图片

### 3. 模型配置 (models.ts)
- 管理多个AI提供商的配置
- 动态加载模型列表
- 支持文本、视觉、图像生成和编辑模型

### 4. API配置工具 (apiConfig.ts)
- 使用AES加密存储API密钥
- 从localStorage加载配置
- 提供加密/解密功能

## 安全特性

- **本地数据存储**: 所有用户数据仅存储在浏览器本地
- **API密钥加密**: 使用AES加密算法存储API密钥
- **无后端依赖**: 不依赖后端数据库，完全保护用户隐私
- **环境变量隔离**: 敏感配置通过环境变量管理

## 开发约定

### 代码风格
- 使用TypeScript进行类型安全开发
- 遵循React函数组件和Hooks模式
- 使用Ant Design组件库保持一致的UI风格
- 代码格式化使用Prettier规范

### 数据管理
- 所有状态使用React Hooks管理
- 长期数据存储在localStorage中
- API密钥使用AES加密后存储

### API交互
- 通过fetch()进行API调用
- 支持流式响应处理
- 通过Vite代理处理跨域请求

## 用法指南

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