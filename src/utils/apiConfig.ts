import CryptoJS from 'crypto-js';

const ENCRYPT_KEY = 'creative-ark-secret-key';

export interface ProviderConfig {
  apiKey: string;
}

export interface ApiConfig {
  providers: {
    [providerId: string]: ProviderConfig;
  };
}

export const encryptApiKey = (apiKey: string): string => {
  return CryptoJS.AES.encrypt(apiKey, ENCRYPT_KEY).toString();
};

export const decryptApiKey = (encryptedKey: string): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedKey, ENCRYPT_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    return '';
  }
};

export const getApiConfig = (): ApiConfig => {
  const config = localStorage.getItem('api_config');
  if (config) {
    try {
      return JSON.parse(config);
    } catch (error) {
      return { providers: {} };
    }
  }
  return { providers: {} };
};

export const saveApiConfig = (config: ApiConfig): void => {
  localStorage.setItem('api_config', JSON.stringify(config));
};

export const updateProviderConfig = (providerId: string, apiKey: string): void => {
  const config = getApiConfig();
  if (!config.providers) {
    config.providers = {};
  }
  config.providers[providerId] = {
    apiKey: encryptApiKey(apiKey)
  };
  saveApiConfig(config);
};

export default {
  encryptApiKey,
  decryptApiKey,
  getApiConfig,
  saveApiConfig,
  updateProviderConfig
};