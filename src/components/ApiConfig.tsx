import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, message, Space, Typography, Divider, Tabs, Card } from 'antd';
import { EyeInvisibleOutlined, EyeTwoTone, InfoCircleOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { MODEL_PROVIDERS } from '../config/models';
import { getApiConfig, updateProviderConfig, decryptApiKey } from '../utils/apiConfig';

const { Text, Link } = Typography;
const { TabPane } = Tabs;

interface ApiConfigProps {
  visible: boolean;
  onCancel: () => void;
}

const ApiConfig: React.FC<ApiConfigProps> = ({ visible, onCancel }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [providerStatus, setProviderStatus] = useState<{[key: string]: 'success' | 'error' | 'testing' | null}>({});

  useEffect(() => {
    if (visible) {
      loadConfigs();
    }
  }, [visible]);

  const loadConfigs = () => {
    const config = getApiConfig();
    const formValues: any = {};
    
    MODEL_PROVIDERS.forEach(provider => {
      const providerConfig = config.providers?.[provider.id];
      if (providerConfig?.apiKey) {
        formValues[`${provider.id}_apiKey`] = decryptApiKey(providerConfig.apiKey);
      }
    });
    
    form.setFieldsValue(formValues);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      
      MODEL_PROVIDERS.forEach(provider => {
        const apiKey = values[`${provider.id}_apiKey`];
        if (apiKey) {
          updateProviderConfig(provider.id, apiKey);
        }
      });
      
      message.success('配置保存成功！');
      onCancel();
    } catch (error) {
      console.error('保存配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (providerId: string) => {
    try {
      setTestingProvider(providerId);
      setProviderStatus(prev => ({ ...prev, [providerId]: 'testing' }));
      
      const values = form.getFieldsValue();
      const apiKey = values[`${providerId}_apiKey`];
      
      if (!apiKey) {
        message.warning('请先输入API密钥');
        setProviderStatus(prev => ({ ...prev, [providerId]: null }));
        return;
      }

      const provider = MODEL_PROVIDERS.find(p => p.id === providerId);
      if (!provider) {
        throw new Error('未找到提供商配置');
      }

      const response = await fetch(`${provider.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (response.ok) {
        message.success(`${provider.name} 连接测试成功！`);
        setProviderStatus(prev => ({ ...prev, [providerId]: 'success' }));
      } else {
        message.error(`${provider.name} 连接测试失败，请检查配置`);
        setProviderStatus(prev => ({ ...prev, [providerId]: 'error' }));
      }
    } catch (error) {
      const provider = MODEL_PROVIDERS.find(p => p.id === providerId);
      message.error(`${provider?.name} 连接测试失败，请检查网络和配置`);
      setProviderStatus(prev => ({ ...prev, [providerId]: 'error' }));
    } finally {
      setTestingProvider(null);
    }
  };

  const getStatusIcon = (providerId: string) => {
    const status = providerStatus[providerId];
    switch (status) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'error':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'testing':
        return <div className="loading-spinner" />;
      default:
        return null;
    }
  };

  return (
    <Modal
      title="API配置管理"
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="save" type="primary" onClick={handleSave} loading={loading}>
          保存配置
        </Button>
      ]}
      width={800}
      style={{ top: 20 }}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
          padding: '16px', 
          borderRadius: '8px',
          color: '#fff',
          marginBottom: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <InfoCircleOutlined />
            <Text strong style={{ color: '#fff' }}>多提供商AI平台配置</Text>
          </div>
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>
            配置多个AI服务提供商，享受更丰富的模型选择和更稳定的服务体验
          </Text>
        </div>
      </div>

      <Form form={form} layout="vertical">
        <Tabs defaultActiveKey="siliconflow" type="card">
          {MODEL_PROVIDERS.map(provider => (
            <TabPane 
              tab={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{provider.name}</span>
                  {getStatusIcon(provider.id)}
                </div>
              } 
              key={provider.id}
            >
              <Card size="small" style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ fontSize: 16, color: '#1f2937' }}>
                    {provider.name}
                  </Text>
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                    API地址: {provider.baseUrl}
                  </div>
                </div>

                <Form.Item
                  label={`${provider.name} API密钥`}
                  name={`${provider.id}_apiKey`}
                  rules={[
                    { 
                      required: false, 
                      message: `请输入${provider.name}的API密钥` 
                    }
                  ]}
                >
                  <Input.Password
                    placeholder={`请输入${provider.name}的API密钥`}
                    iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                    suffix={
                      <Button 
                        type="link" 
                        size="small"
                        loading={testingProvider === provider.id}
                        onClick={() => testConnection(provider.id)}
                        style={{ padding: 0, height: 'auto' }}
                      >
                        测试
                      </Button>
                    }
                  />
                </Form.Item>

                <div style={{ 
                  background: '#f8fafc', 
                  padding: '12px', 
                  borderRadius: '6px',
                  marginTop: 12
                }}>
                  <Text strong style={{ fontSize: 13, color: '#374151' }}>
                    支持的模型类型:
                  </Text>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                      💬 对话模型: {provider.models.chat.length} 个
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                      🎨 图像模型: {provider.models.image.length} 个
                    </div>
                    {provider.models.video && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                        🎬 视频模型: {provider.models.video.length} 个
                      </div>
                    )}
                    {provider.models.audio && (
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        🎵 音频模型: {provider.models.audio.length} 个
                      </div>
                    )}
                  </div>
                </div>

                {provider.id === 'siliconflow' && (
                  <div style={{ marginTop: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      💡 推荐使用 <Link href="https://siliconflow.cn/" target="_blank">硅基流动</Link> 访问魔塔社区模型
                    </Text>
                  </div>
                )}

                {provider.id === 'openai' && (
                  <div style={{ marginTop: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      💡 需要 <Link href="https://platform.openai.com/" target="_blank">OpenAI官方API密钥</Link>
                    </Text>
                  </div>
                )}
              </Card>
            </TabPane>
          ))}
        </Tabs>
      </Form>

      <Divider />

      <div style={{ 
        background: '#f6f8fa', 
        padding: '16px', 
        borderRadius: '6px'
      }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Text strong style={{ color: '#374151' }}>
            <InfoCircleOutlined /> 安全说明
          </Text>
          
          <Text type="secondary" style={{ fontSize: 12 }}>
            • 所有API密钥均使用AES加密存储在本地浏览器中，不会上传到服务器
          </Text>
          
          <Text type="secondary" style={{ fontSize: 12 }}>
            • 支持多个提供商同时配置，系统会根据选择的模型自动使用对应的API
          </Text>
          
          <Text type="secondary" style={{ fontSize: 12 }}>
            • 建议定期更新API密钥以确保账户安全
          </Text>
        </Space>
      </div>
    </Modal>
  );
};

export default ApiConfig;