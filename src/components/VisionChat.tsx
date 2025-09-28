import React, { useState, useEffect, useRef } from 'react';
import { Card, Input, Button, Space, message, Avatar, Typography, Select, Upload, Image } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined, ClearOutlined, PictureOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import CryptoJS from 'crypto-js';

const { TextArea } = Input;
const { Text } = Typography;
const { Option } = Select;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  timestamp: string;
  model?: string;
}

const VisionChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('Qwen/Qwen3-VL-235B-A22B-Instruct');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const visionModels = [
    { label: 'Qwen3-VL-235B', value: 'Qwen/Qwen3-VL-235B-A22B-Instruct' },
    { label: 'Step3', value: 'stepfun-ai/step3' },
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
    const savedMessages = localStorage.getItem('vision_chat_history');
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
    localStorage.setItem('vision_chat_history', JSON.stringify(newMessages));
  };

  const uploadProps = {
    beforeUpload: (file: File) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('只能上传图片文件！');
        return false;
      }
      
      if (uploadedFiles.length >= 3) {
        message.error('最多只能上传3张图片！');
        return false;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const newFile: UploadFile = {
          uid: Date.now().toString() + Math.random(),
          name: file.name,
          status: 'done',
          url: e.target?.result as string,
        };
        setUploadedFiles(prev => [...prev, newFile]);
      };
      reader.readAsDataURL(file);
      return false;
    },
    fileList: uploadedFiles,
    onRemove: (file: UploadFile) => {
      setUploadedFiles(prev => prev.filter(f => f.uid !== file.uid));
    },
    multiple: true,
    listType: 'picture-card' as const,
    showUploadList: {
      showPreviewIcon: true,
      showRemoveIcon: true,
    },
  };

  const sendMessage = async () => {
    if (!inputValue.trim() && uploadedFiles.length === 0) {
      message.warning('请输入消息内容或上传图片');
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
      content: inputValue.trim() || '请分析这张图片',
      images: uploadedFiles.map(file => file.url).filter(Boolean) as string[],
      timestamp: new Date().toISOString(),
      model: selectedModel
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setUploadedFiles([]);
    setLoading(true);

    try {
      // 构建消息内容
      const messageContent: any[] = [];
      
      if (userMessage.content) {
        messageContent.push({
          type: 'text',
          text: userMessage.content
        });
      }

      if (userMessage.images && userMessage.images.length > 0) {
        userMessage.images.forEach(imageUrl => {
          messageContent.push({
            type: 'image_url',
            image_url: {
              url: imageUrl
            }
          });
        });
      }

      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            {
              role: 'user',
              content: messageContent
            }
          ],
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
    setUploadedFiles([]);
    localStorage.removeItem('vision_chat_history');
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
        title="视觉对话" 
        size="small"
        extra={
          <Space>
            <Select
              value={selectedModel}
              onChange={setSelectedModel}
              style={{ width: 200 }}
              size="small"
            >
              {visionModels.map(model => (
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
              上传图片开始视觉对话！
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
                    {message.images && message.images.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <Image.PreviewGroup>
                          {message.images.map((img, index) => (
                            <Image
                              key={index}
                              src={img}
                              alt={`Image ${index + 1}`}
                              style={{ 
                                width: 60, 
                                height: 60, 
                                objectFit: 'cover', 
                                borderRadius: 4,
                                marginRight: 4
                              }}
                            />
                          ))}
                        </Image.PreviewGroup>
                      </div>
                    )}
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
                          {visionModels.find(m => m.value === message.model)?.label}
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
              AI正在分析中...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <div style={{ 
          padding: '16px', 
          borderTop: '1px solid #f0f0f0',
          background: '#fff'
        }}>
          {uploadedFiles.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Upload {...uploadProps}>
                <div style={{ 
                  width: 104, 
                  height: 104, 
                  border: '1px dashed #d9d9d9', 
                  borderRadius: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  backgroundColor: '#fafafa'
                }}>
                  <PictureOutlined style={{ fontSize: 20, color: '#999', marginBottom: 4 }} />
                  <div style={{ fontSize: '12px', color: '#666' }}>上传图片</div>
                </div>
              </Upload>
            </div>
          )}
          
          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="描述您想了解的内容，或直接上传图片..."
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
          
          {uploadedFiles.length === 0 && (
            <div style={{ marginTop: 8 }}>
              <Upload {...uploadProps}>
                <Button size="small" icon={<PictureOutlined />}>
                  上传图片
                </Button>
              </Upload>
            </div>
          )}
          
          <Text type="secondary" style={{ fontSize: '12px', marginTop: 8, display: 'block' }}>
            按 Enter 发送，Shift + Enter 换行，最多上传3张图片
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default VisionChat;