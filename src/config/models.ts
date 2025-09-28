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
    try {
      const response = await fetch('/providers.json');
      const data = await response.json();
      
      // 从环境变量获取API密钥
      const defaultProvider = import.meta.env.VITE_DEFAULT_PROVIDER || data.defaultProvider;
      
      // 确保providers是数组
      const providers = Array.isArray(data.providers) ? [...data.providers] : [];
      
      // 更新ModelScope的API密钥
      const modelscope = providers.find(p => p.id === 'modelscope');
      if (modelscope && import.meta.env.MODELSCOPE_API_KEY) {
        modelscope.apiKey = import.meta.env.MODELSCOPE_API_KEY;
      }
      
      // 更新OpenAI的API密钥 (如果使用newapi作为OpenAI代理)
      const newapi = providers.find(p => p.id === 'newapi');
      if (newapi && import.meta.env.VITE_OPENAI_API_KEY) {
        newapi.apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      }
      
      // 确保所有提供商都有apiKey
      providers.forEach(provider => {
        if (!provider.apiKey) {
          provider.apiKey = '';
        }
      });
      
      providersConfig = { 
        defaultProvider, 
        providers 
      };
      
      // 更新MODEL_PROVIDERS数组
      updateModelProviders();
      
    } catch (error) {
      console.error('Error loading providers config:', error);
      providersConfig = { defaultProvider: 'modelscope', providers: [] };
    }
    configInitialized = true;
  }
};

// 导出的 MODEL_PROVIDERS 数组（保持向后兼容）
export const MODEL_PROVIDERS: ModelProvider[] = [];

// 自动初始化配置
initializeConfig();

// 更新 MODEL_PROVIDERS
const updateModelProviders = () => {
  const config = getProvidersConfigSync();
  MODEL_PROVIDERS.length = 0;
  // 确保providers是数组
  if (Array.isArray(config.providers)) {
    MODEL_PROVIDERS.push(...config.providers);
  } else if (typeof config.providers === 'object') {
    // 如果是对象，转换为数组
    MODEL_PROVIDERS.push(...Object.values(config.providers));
  }
};

// 获取所有聊天模型（文本 + 视觉）
export const getAllChatModels = () => {
  const config = getProvidersConfigSync();
  const models: Array<ModelConfig & { providerId: string; providerName: string }> = [];
  
  // 确保providers是可迭代的
  const providers = Array.isArray(config.providers) 
    ? config.providers 
    : Object.values(config.providers || {});
  
  providers.forEach(provider => {
    if (!provider || !provider.models) return;

    // 添加文本模型
    if (Array.isArray(provider.models.chatText)) {
      provider.models.chatText.forEach(model => {
        models.push({
          ...model,
          providerId: provider.id,
          providerName: provider.name,
          supportImages: false
        });
      });
    }

    // 添加视觉模型
    if (Array.isArray(provider.models.chatVision)) {
      provider.models.chatVision.forEach(model => {
        // 确保视觉模型有唯一的ID，避免与文本模型冲突
        const uniqueId = model.id.endsWith('-vision') ? model.id : `${model.id}-vision`;
        models.push({
          ...model,
          id: uniqueId,
          providerId: provider.id,
          providerName: provider.name,
          supportImages: true
        });
      });
    }
  });
  
  return models;
};

// 获取所有图像生成模型
export const getAllImageModels = () => {
  const config = getProvidersConfigSync();
  const models: Array<ModelConfig & { providerId: string; providerName: string }> = [];
  
  // 确保providers是可迭代的
  const providers = Array.isArray(config.providers) 
    ? config.providers 
    : Object.values(config.providers || {});
  
  providers.forEach(provider => {
    if (!provider || !provider.models) return;
    
    // 添加图像生成模型
    if (Array.isArray(provider.models.imageGeneration)) {
      provider.models.imageGeneration.forEach(model => {
        models.push({
          ...model,
          providerId: provider.id,
          providerName: provider.name,
          type: 'image-generation'
        });
      });
    }
    
    // 添加图像编辑模型
    if (Array.isArray(provider.models.imageEdit)) {
      provider.models.imageEdit.forEach(model => {
        models.push({
          ...model,
          providerId: provider.id,
          providerName: provider.name,
          type: 'image-edit'
        });
      });
    }
  });
  
  return models;
};

// 根据 ID 获取提供商
export const getProviderById = (providerId: string): ModelProvider | undefined => {
  const config = getProvidersConfigSync();
  // 处理providers可能是对象的情况
  if (Array.isArray(config.providers)) {
    return config.providers.find(p => p.id === providerId);
  } else if (typeof config.providers === 'object') {
    // 如果是对象，直接通过键访问
    return config.providers[providerId];
  }
  return undefined;
};

// 获取默认提供商
export const getDefaultProvider = (): ModelProvider | undefined => {
  const config = getProvidersConfigSync();
  return getProviderById(config.defaultProvider);
};

// 更新提供商的 API Key
export const updateProviderApiKey = (providerId: string, apiKey: string) => {
  const config = getProvidersConfigSync();
  if (Array.isArray(config.providers)) {
    const provider = config.providers.find(p => p.id === providerId);
    if (provider) {
      provider.apiKey = apiKey;
    }
  } else if (typeof config.providers === 'object' && config.providers[providerId]) {
    config.providers[providerId].apiKey = apiKey;
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