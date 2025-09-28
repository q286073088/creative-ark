import React, { useState, useEffect, useRef } from 'react';
import { Card, Input, Button, Space, message, Avatar, Typography, Select } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined, ClearOutlined } from '@ant-design/icons';
import CryptoJS from 'crypto-js';

const { TextArea } = Input;
const { Text } = Typography;
const { Option } = Select;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
}

const TextChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('iic/Tongyi-DeepResearch-30B-A3B');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const textModels = [
    { label: 'Tongyi-DeepResearch-30B', value: 'iic/Tongyi-DeepResearch-30B-A3B' },
    { label: 'Qwen3-Coder-480B', value: 'Qwen/Qwen3-Coder-480B-A35B-Instruct' },
    { label: 'Kimi-K2-Instruct', value: 'moonshotai/Kimi-K2-Instruct-0905' },
    { label: 'GLM-4.5', value: 'ZhipuAI/GLM-4.5' },
  ];

  const ENCRYPT_KEY = 'creative-ark-secret-key';

  const decryptApiKey = (encryptedKey: string) => {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedKey, ENCRYPT_KEY);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      return '';
    }
  };

  const getApiConfig = () => {
    const config = localStorage.getItem('api_config');
    if (config) {
      try {
        const parsedConfig = JSON.parse(config);
        return {
          baseUrl: parsedConfig.baseUrl || 'https://api.siliconflow.cn/v1',
          apiKey: parsedConfig.apiKey ? decryptApiKey(parsedConfig.apiKey) : ''
        };
      } catch (error) {
        return { baseUrl: 'https://api.siliconflow.cn/v1', apiKey: '' };
      }
    }
    return { baseUrl: 'https://api.siliconflow.cn/v1', apiKey: '' };
  };

  useEffect(() => {
    const savedMessages = localStorage.getItem('text_chat_history');
    if (savedMessages) {
      try {
        setMessages(JSON.parse(savedMessages));
      } catch (error) {
        console.error('加载聊天历史失败:', error);
      }
    }
  }, []);

  useEffect(() => {
    // Only scroll to bottom if user is already near the bottom
    const shouldAutoScroll = () => {
      const messagesContainer = document.querySelector('.custom-scrollbar');
      if (messagesContainer) {
        const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
        // If user is within 100px of the bottom, auto-scroll
        return scrollHeight - scrollTop - clientHeight < 100;
      }
      return true; // Default to true if container not found
    };

    if (shouldAutoScroll()) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const saveMessages = (newMessages: Message[]) => {
    localStorage.setItem('text_chat_history', JSON.stringify(newMessages));
  };

  const sendMessage = async () => {
    if (!inputValue.trim()) {
      message.warning('请输入消息内容');
      return;
    }

    const config = getApiConfig();
    if (!config.apiKey) {
      message.error('请先配置API密钥');
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
      model: selectedModel
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setLoading(true);

    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: newMessages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          temperature: 0.7,
          max_tokens: 2000,
          stream: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API请求失败: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.choices[0].message.content,
        timestamp: new Date().toISOString(),
        model: selectedModel
      };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);
      saveMessages(finalMessages);
    } catch (error) {
      console.error('发送消息失败:', error);
      message.error(`发送失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem('text_chat_history');
    message.success('聊天记录已清空');
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <Card 
        title="文本对话" 
        size="small"
        extra={
          <Space>
            <Select
              value={selectedModel}
              onChange={setSelectedModel}
              style={{ width: 200 }}
              size="small"
            >
              {textModels.map(model => (
                <Option key={model.value} value={model.value}>
                  {model.label}
                </Option>
              ))}
            </Select>
            <Button size="small" icon={<ClearOutlined />} onClick={clearChat}>
              清空
            </Button>
          </Space>
        }
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0 }}
      >
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '16px',
          background: '#fafafa'
        }}>
          {messages.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              color: '#8c8c8c', 
              marginTop: '20%' 
            }}>
              开始与AI对话吧！
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} style={{ marginBottom: 16 }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start',
                  flexDirection: message.role === 'user' ? 'row-reverse' : 'row'
                }}>
                  <Avatar 
                    icon={message.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                    style={{ 
                      backgroundColor: message.role === 'user' ? '#1890ff' : '#52c41a',
                      margin: message.role === 'user' ? '0 0 0 8px' : '0 8px 0 0'
                    }}
                  />
                  <div style={{ 
                    maxWidth: '70%',
                    background: message.role === 'user' ? '#1890ff' : '#fff',
                    color: message.role === 'user' ? '#fff' : '#000',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                  }}>
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {message.content}
                    </div>
                    <div style={{ 
                      fontSize: '11px', 
                      opacity: 0.7, 
                      marginTop: 4,
                      textAlign: message.role === 'user' ? 'right' : 'left'
                    }}>
                      {formatTime(message.timestamp)}
                      {message.model && (
                        <span style={{ marginLeft: 8 }}>
                          {textModels.find(m => m.value === message.model)?.label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div style={{ textAlign: 'center', color: '#8c8c8c' }}>
              AI正在思考中...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <div style={{ 
          padding: '16px', 
          borderTop: '1px solid #f0f0f0',
          background: '#fff'
        }}>
          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="输入您的问题..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              style={{ resize: 'none' }}
            />
            <Button 
              type="primary" 
              icon={<SendOutlined />}
              loading={loading}
              onClick={sendMessage}
              style={{ height: 'auto' }}
            >
              发送
            </Button>
          </Space.Compact>
          <Text type="secondary" style={{ fontSize: '12px', marginTop: 8, display: 'block' }}>
            按 Enter 发送，Shift + Enter 换行
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default TextChat;