export interface ModelConfig {
  id: string;
  name: string;
  maxTokens?: number;
  supportImages?: boolean;
  type?: 'image-generation' | 'image-edit';
}

export interface ModelProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  description?: string;
  models: {
    chatText: ModelConfig[];
    chatVision: ModelConfig[];
    imageGeneration: ModelConfig[];
    imageEdit: ModelConfig[];
  };
}

export interface ProvidersConfig {
  defaultProvider: string;
  providers: ModelProvider[];
}

// 从 providers.json 加载配置
let providersConfig: ProvidersConfig | null = null;

const loadProvidersConfig = async (): Promise<ProvidersConfig> => {
  if (providersConfig) {
    return providersConfig;
  }

  try {
    const response = await fetch('/providers.json');
    if (!response.ok) {
      throw new Error(`Failed to load providers.json: ${response.status}`);
    }
    providersConfig = await response.json();
    return providersConfig!;
  } catch (error) {
    console.error('Error loading providers config:', error);
    // 返回默认配置
    return {
      defaultProvider: 'siliconflow',
      providers: []
    };
  }
};

// 同步获取配置（用于已加载的情况）
const getProvidersConfigSync = (): ProvidersConfig => {
  return providersConfig || {
    defaultProvider: 'siliconflow',
    providers: []
  };
};

// 初始化配置
let configInitialized = false;
const initializeConfig = async () => {
  if (!configInitialized) {
    await loadProvidersConfig();
    configInitialized = true;
  }
};

// 导出的 MODEL_PROVIDERS 数组（保持向后兼容）
export const MODEL_PROVIDERS: ModelProvider[] = [];

// 更新 MODEL_PROVIDERS
const updateModelProviders = () => {
  const config = getProvidersConfigSync();
  MODEL_PROVIDERS.length = 0;
  MODEL_PROVIDERS.push(...config.providers);
};

// 获取所有聊天模型（文本 + 视觉）
export const getAllChatModels = () => {
  const config = getProvidersConfigSync();
  const models: Array<ModelConfig & { providerId: string; providerName: string }> = [];
  
  config.providers.forEach(provider => {
    // 添加文本模型
    provider.models.chatText.forEach(model => {
      models.push({
        ...model,
        providerId: provider.id,
        providerName: provider.name,
        supportImages: false
      });
    });
    
    // 添加视觉模型
    provider.models.chatVision.forEach(model => {
      models.push({
        ...model,
        providerId: provider.id,
        providerName: provider.name,
        supportImages: true
      });
    });
  });
  
  return models;
};

// 获取所有图像生成模型
export const getAllImageModels = () => {
  const config = getProvidersConfigSync();
  const models: Array<ModelConfig & { providerId: string; providerName: string }> = [];
  
  config.providers.forEach(provider => {
    // 添加图像生成模型
    provider.models.imageGeneration.forEach(model => {
      models.push({
        ...model,
        providerId: provider.id,
        providerName: provider.name,
        type: 'image-generation'
      });
    });
    
    // 添加图像编辑模型
    provider.models.imageEdit.forEach(model => {
      models.push({
        ...model,
        providerId: provider.id,
        providerName: provider.name,
        type: 'image-edit'
      });
    });
  });
  
  return models;
};

// 根据 ID 获取提供商
export const getProviderById = (providerId: string): ModelProvider | undefined => {
  const config = getProvidersConfigSync();
  return config.providers.find(p => p.id === providerId);
};

// 获取默认提供商
export const getDefaultProvider = (): ModelProvider | undefined => {
  const config = getProvidersConfigSync();
  return config.providers.find(p => p.id === config.defaultProvider);
};

// 更新提供商的 API Key
export const updateProviderApiKey = (providerId: string, apiKey: string) => {
  const config = getProvidersConfigSync();
  const provider = config.providers.find(p => p.id === providerId);
  if (provider) {
    provider.apiKey = apiKey;
  }
};

// 获取提供商配置（包含 API Key）
export const getProviderConfig = (providerId: string) => {
  const provider = getProviderById(providerId);
  if (!provider) {
    return null;
  }
  
  return {
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    name: provider.name
  };
};

// 初始化配置并更新 MODEL_PROVIDERS
initializeConfig().then(() => {
  updateModelProviders();
});

// 导出初始化函数供组件使用
export { initializeConfig, getProvidersConfigSync };