export interface ModelProvider {
  id: string;
  name: string;
  baseUrl: string;
  models: {
    chat: ModelConfig[];
    image: ModelConfig[];
    video?: ModelConfig[];
    audio?: ModelConfig[];
  };
}

export interface ModelConfig {
  id: string;
  name: string;
  type: 'text' | 'vision' | 'image-generation' | 'image-edit' | 'video' | 'audio';
  capabilities: string[];
  maxTokens?: number;
  supportImages?: boolean;
  supportFiles?: boolean;
  // runtime fields
  providerId?: string;
  providerName?: string;
}

const env = import.meta.env as any;

const parseCSV = (val?: string): string[] =>
  (val || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

const modelDisplayName = (id: string, aliasEnvKey?: string): string => {
  const alias = aliasEnvKey ? env[aliasEnvKey] : undefined;
  if (alias) return alias;
  // fallback: last path segment or the id itself
  const seg = id.split('/').pop();
  return seg || id;
};

type Kind = 'CHAT_TEXT' | 'CHAT_VISION' | 'IMAGE_GEN' | 'IMAGE_EDIT';

/**
 * Build provider from env
 * Required:
 * - VITE_PROVIDER_IDS: comma-separated provider ids, e.g. "siliconflow"
 * - For each providerId (UPPER for key):
 *   - VITE_PROVIDER_{ID}_NAME
 *   - VITE_PROVIDER_{ID}_BASE_URL
 *   - VITE_PROVIDER_{ID}_CHAT_TEXT_MODELS
 *   - VITE_PROVIDER_{ID}_CHAT_VISION_MODELS
 *   - VITE_PROVIDER_{ID}_IMAGE_GENERATION_MODELS
 *   - VITE_PROVIDER_{ID}_IMAGE_EDIT_MODELS
 * Optional:
 *   - VITE_PROVIDER_{ID}_DEFAULT_MAX_TOKENS
 *   - Per-model alias: VITE_PROVIDER_{ID}_ALIAS_{SANITIZED_MODEL_ID}
 */
const buildProvidersFromEnv = (): ModelProvider[] => {
  const providerIds = parseCSV(env.VITE_PROVIDER_IDS);
  const providers: ModelProvider[] = [];

  providerIds.forEach((pidRaw: string) => {
    const pid = pidRaw.trim();
    if (!pid) return;
    const KEY = pid.toUpperCase().replace(/-/g, '_');

    const name = env[`VITE_PROVIDER_${KEY}_NAME`] || pid;
    const baseUrl = env[`VITE_PROVIDER_${KEY}_BASE_URL`] || '';
    const defaultMax = Number(env[`VITE_PROVIDER_${KEY}_DEFAULT_MAX_TOKENS`] || 8192);

    const chatText = parseCSV(env[`VITE_PROVIDER_${KEY}_CHAT_TEXT_MODELS`]);
    const chatVision = parseCSV(env[`VITE_PROVIDER_${KEY}_CHAT_VISION_MODELS`]);
    const imgGen = parseCSV(env[`VITE_PROVIDER_${KEY}_IMAGE_GENERATION_MODELS`]);
    const imgEdit = parseCSV(env[`VITE_PROVIDER_${KEY}_IMAGE_EDIT_MODELS`]);

    const aliasKeyFor = (modelId: string) => {
      const sanitized = modelId.replace(/[^A-Za-z0-9]/g, '_').toUpperCase();
      return `VITE_PROVIDER_${KEY}_ALIAS_${sanitized}`;
    };

    const toChatModel = (id: string, kind: Kind): ModelConfig => ({
      id,
      name: modelDisplayName(id, aliasKeyFor(id)),
      type: kind === 'CHAT_VISION' ? 'vision' : 'text',
      capabilities:
        kind === 'CHAT_VISION'
          ? ['text', 'vision', 'multimodal']
          : ['text', 'conversation'],
      maxTokens: defaultMax,
      supportImages: kind === 'CHAT_VISION',
    });

    const toImageModel = (id: string, kind: Kind): ModelConfig => ({
      id,
      name: modelDisplayName(id, aliasKeyFor(id)),
      type: kind === 'IMAGE_EDIT' ? 'image-edit' : 'image-generation',
      capabilities: kind === 'IMAGE_EDIT' ? ['image-to-image', 'editing'] : ['text-to-image'],
      supportImages: kind === 'IMAGE_EDIT',
    });

    const chatModels: ModelConfig[] = [
      ...chatText.map(id => toChatModel(id, 'CHAT_TEXT')),
      ...chatVision.map(id => toChatModel(id, 'CHAT_VISION')),
    ];
    const imageModels: ModelConfig[] = [
      ...imgGen.map(id => toImageModel(id, 'IMAGE_GEN')),
      ...imgEdit.map(id => toImageModel(id, 'IMAGE_EDIT')),
    ];

    providers.push({
      id: pid,
      name,
      baseUrl,
      models: {
        chat: chatModels,
        image: imageModels,
      },
    });
  });

  return providers;
};

export const MODEL_PROVIDERS: ModelProvider[] = buildProvidersFromEnv();

export const getModelsByProvider = (providerId: string) => {
  return MODEL_PROVIDERS.find(p => p.id === providerId);
};

export const getAllChatModels = () => {
  return MODEL_PROVIDERS.flatMap(provider =>
    (provider.models.chat || []).map(model => ({
      ...model,
      providerId: provider.id,
      providerName: provider.name,
    }))
  );
};

export const getAllImageModels = () => {
  return MODEL_PROVIDERS.flatMap(provider =>
    (provider.models.image || []).map(model => ({
      ...model,
      providerId: provider.id,
      providerName: provider.name,
    }))
  );
};

export const getDefaultProvider = () => {
  const defaultId = env.VITE_DEFAULT_PROVIDER || (MODEL_PROVIDERS[0]?.id ?? '');
  return MODEL_PROVIDERS.find(p => p.id === defaultId) || MODEL_PROVIDERS[0];
};