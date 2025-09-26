import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Space, message, Typography, Divider, Tag, Alert, Modal, List } from 'antd';
import { SettingOutlined, EyeOutlined, EyeInvisibleOutlined, SaveOutlined, ReloadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { initializeConfig, getProvidersConfigSync } from '../config/models';
import { getApiConfig, updateProviderConfig, encryptApiKey, decryptApiKey } from '../utils/apiConfig';

const { Text, Title, Link } = Typography;
const { TextArea } = Input;

interface ProviderConfigState {
  [providerId: string]: {
    apiKey: string;
    showKey: boolean;
  };
}

const ApiConfig: React.FC = () => {
  const [configs, setConfigs] = useState<ProviderConfigState>({});
  const [loading, setLoading] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      await initializeConfig();
      const providersConfig = getProvidersConfigSync();
      const apiConfig = getApiConfig();
      
      const newConfigs: ProviderConfigState = {};
      
      providersConfig.providers.forEach(provider => {
        const localConfig = apiConfig.providers?.[provider.id];
        newConfigs[provider.id] = {
          apiKey: localConfig?.apiKey ? decryptApiKey(localConfig.apiKey) : provider.apiKey || '',
          showKey: false
        };
      });
      
      setConfigs(newConfigs);
    } catch (error) {
      console.error('加载配置失败:', error);
      message.error('加载配置失败');
    }
  };

  const handleApiKeyChange = (providerId: string, value: string) => {
    setConfigs(prev => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        apiKey: value
      }
    }));
  };

  const toggleKeyVisibility = (providerId: string) => {
    setConfigs(prev => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        showKey: !prev[providerId]?.showKey
      }
    }));
  };

  const saveConfig = async (providerId: string) => {
    const config = configs[providerId];
    if (!config) return;

    setLoading(true);
    try {
      await updateProviderConfig(providerId, config.apiKey || '');
      message.success('配置保存成功');
    } catch (error) {
      console.error('保存配置失败:', error);
      message.error('保存配置失败');
    } finally {
      setLoading(false);
    }
  };

  const saveAllConfigs = async () => {
    setLoading(true);
    try {
      for (const [providerId, config] of Object.entries(configs)) {
        await updateProviderConfig(providerId, config.apiKey || '');
      }
      message.success('所有配置保存成功');
    } catch (error) {
      console.error('保存配置失败:', error);
      message.error('保存配置失败');
    } finally {
      setLoading(false);
    }
  };

  const providersConfig = getProvidersConfigSync();

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <SettingOutlined />
          API 配置管理
        </Title>
        <Text type="secondary">
          配置各个AI服务提供商的API密钥，密钥将在本地加密存储
        </Text>
      </div>

      <Alert
        message="安全提示"
        description="所有API密钥均在浏览器本地加密存储，不会上传到任何服务器。请妥善保管您的密钥。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        action={
          <Button size="small" type="link" onClick={() => setInfoVisible(true)}>
            了解更多
          </Button>
        }
      />

      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {providersConfig.providers.map((provider: any) => (
          <Card
            key={provider.id}
            title={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span>{provider.name}</span>
                  <Tag color={provider.id === providersConfig.defaultProvider ? 'green' : 'default'}>
                    {provider.id === providersConfig.defaultProvider ? '默认' : '备用'}
                  </Tag>
                </div>
                <Button
                  type="primary"
                  size="small"
                  icon={<SaveOutlined />}
                  loading={loading}
                  onClick={() => saveConfig(provider.id)}
                >
                  保存
                </Button>
              </div>
            }
            style={{ borderRadius: 8 }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <Text strong>API 基础地址:</Text>
                <div style={{ 
                  marginTop: 4, 
                  padding: '8px 12px', 
                  background: '#f5f5f5', 
                  borderRadius: 4,
                  fontFamily: 'monospace',
                  fontSize: 13
                }}>
                  {provider.baseUrl}
                </div>
              </div>

              <div>
                <Text strong>API 密钥:</Text>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <Input.Password
                    value={configs[provider.id]?.apiKey || ''}
                    onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
                    placeholder={`请输入 ${provider.name} 的 API 密钥`}
                    visibilityToggle={{
                      visible: configs[provider.id]?.showKey,
                      onVisibleChange: () => toggleKeyVisibility(provider.id)
                    }}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>

              {provider.description && (
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {provider.description}
                  </Text>
                </div>
              )}

              <div>
                <Text strong style={{ fontSize: 13 }}>支持的模型:</Text>
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: '#666' }}>💬 文本对话:</Text>
                    <Tag color="blue">{provider.models.chatText.length} 个</Tag>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: '#666' }}>👁️ 视觉对话:</Text>
                    <Tag color="green">{provider.models.chatVision.length} 个</Tag>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: '#666' }}>🎨 图像生成:</Text>
                    <Tag color="orange">{provider.models.imageGeneration.length} 个</Tag>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: '#666' }}>✏️ 图像编辑:</Text>
                    <Tag color="purple">{provider.models.imageEdit.length} 个</Tag>
                  </div>
                </div>
              </div>

              {provider.id === 'modelscope' && (
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    💡 推荐使用 <Link href="https://modelscope.cn/" target="_blank">魔塔社区</Link> 获取API密钥
                  </Text>
                </div>
              )}

              {provider.id === 'newapi' && (
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    💡 请确保您的 New API 服务支持 OpenAI 兼容格式
                  </Text>
                </div>
              )}
            </Space>
          </Card>
        ))}
      </Space>

      <div style={{ marginTop: 32, textAlign: 'center' }}>
        <Space>
          <Button
            type="primary"
            size="large"
            icon={<SaveOutlined />}
            loading={loading}
            onClick={saveAllConfigs}
          >
            保存所有配置
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadConfigs}
          >
            重新加载
          </Button>
        </Space>
      </div>

      <Modal
        title="关于API配置"
        open={infoVisible}
        onCancel={() => setInfoVisible(false)}
        footer={[
          <Button key="close" onClick={() => setInfoVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Title level={5}>🔒 数据安全</Title>
            <List size="small">
              <List.Item>• 所有API密钥使用AES-256加密算法在本地存储</List.Item>
              <List.Item>• 密钥不会发送到任何第三方服务器</List.Item>
              <List.Item>• 清除浏览器数据会同时清除已保存的密钥</List.Item>
            </List>
          </div>

          <Divider />

          <div>
            <Title level={5}>⚙️ 配置优先级</Title>
            <List size="small">
              <List.Item>• 本地保存的密钥优先级最高</List.Item>
              <List.Item>• 如果本地没有配置，将使用默认配置</List.Item>
              <List.Item>• 可以为不同提供商配置不同的密钥</List.Item>
            </List>
          </div>

          <Divider />

          <div>
            <Title level={5}>🔧 使用建议</Title>
            <List size="small">
              <List.Item>• 建议定期更换API密钥以确保安全</List.Item>
              <List.Item>• 不同功能可以使用不同的提供商</List.Item>
              <List.Item>• 遇到问题时可以尝试重新加载配置</List.Item>
            </List>
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default ApiConfig;