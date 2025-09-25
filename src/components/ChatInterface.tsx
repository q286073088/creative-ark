import React, { useState, useEffect, useRef } from 'react';
import { Card, Input, Button, Space, message, Avatar, Typography, Select, Upload, Image, Drawer, Empty, Tag, Popconfirm } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined, ClearOutlined, PictureOutlined, HistoryOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { getAllChatModels, MODEL_PROVIDERS } from '../config/models';
import { getApiConfig, decryptApiKey } from '../utils/apiConfig';

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
  providerId?: string;
}

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(() => (getAllChatModels()[0]?.id) || '');
  const [historyVisible, setHistoryVisible] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatModels = getAllChatModels();
  const currentModel = chatModels.find(m => m.id === selectedModel);
  const supportsImages = currentModel?.supportImages || false;
  const noModels = chatModels.length === 0;

  useEffect(() => {
    if (!selectedModel && chatModels.length > 0) {
      setSelectedModel(chatModels[0].id);
    }
  }, [chatModels, selectedModel]);

  useEffect(() => {
    const savedMessages = localStorage.getItem('chat_history');
    if (savedMessages) {
      try {
        setMessages(JSON.parse(savedMessages));
      } catch (error) {
        console.error('加载聊天历史失败:', error);
      }
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveMessages = (newMessages: Message[]) => {
    localStorage.setItem('chat_history', JSON.stringify(newMessages));
  };

  const getProviderConfig = (providerId: string) => {
    const provider = MODEL_PROVIDERS.find(p => p.id === providerId);
    const config = getApiConfig();
    const providerConfig = config.providers?.[providerId];
    
    return {
      baseUrl: provider?.baseUrl || '',
      apiKey: providerConfig?.apiKey ? decryptApiKey(providerConfig.apiKey) : ''
    };
  };

  const sendMessage = async () => {
    if (!inputValue.trim() && uploadedFiles.length === 0) {
      message.warning('请输入消息内容或上传图片');
      return;
    }

    if (!currentModel) {
      message.error('请选择一个模型');
      return;
    }

    const providerConfig = getProviderConfig(currentModel.providerId);
    if (!providerConfig.apiKey) {
      message.error(`请先配置${currentModel.providerName}的API密钥`);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim() || '请分析这张图片',
      images: uploadedFiles.map(file => file.url).filter(Boolean) as string[],
      timestamp: new Date().toISOString(),
      model: selectedModel,
      providerId: currentModel.providerId
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setUploadedFiles([]);
    setLoading(true);

    try {
      const messageContent: any[] = [];
      
      if (userMessage.content) {
        messageContent.push({
          type: 'text',
          text: userMessage.content
        });
      }

      if (userMessage.images && userMessage.images.length > 0 && supportsImages) {
        userMessage.images.forEach(imageUrl => {
          messageContent.push({
            type: 'image_url',
            image_url: {
              url: imageUrl
            }
          });
        });
      }

      const requestBody = {
        model: selectedModel,
        messages: supportsImages && messageContent.length > 0 ? [
          {
            role: 'user',
            content: messageContent
          }
        ] : newMessages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: 0.7,
        max_tokens: currentModel.maxTokens || 2000,
        stream: false
      };

      const response = await fetch(`${providerConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${providerConfig.apiKey}`
        },
        body: JSON.stringify(requestBody)
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
        model: selectedModel,
        providerId: currentModel.providerId
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
    localStorage.removeItem('chat_history');
    message.success('聊天记录已清空');
  };

  const deleteMessage = (messageId: string) => {
    const updatedMessages = messages.filter(msg => msg.id !== messageId);
    setMessages(updatedMessages);
    saveMessages(updatedMessages);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
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

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', padding: 24 }}>
      <Card 
        style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          border: 'none'
        }}
        bodyStyle={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          padding: 0 
        }}
      >
        {/* Header */}
        <div style={{ 
          padding: '16px 24px', 
          borderBottom: '1px solid #f0f0f0',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#fff',
          borderRadius: '12px 12px 0 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <RobotOutlined style={{ fontSize: 20 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>AI智能对话</div>
                <div style={{ fontSize: 12, opacity: 0.9 }}>
                  {currentModel?.name} • {currentModel?.providerName}
                </div>
              </div>
            </div>
            <Space>
              <Button 
                type="text" 
                icon={<HistoryOutlined />}
                onClick={() => setHistoryVisible(true)}
                style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}
              >
                历史
              </Button>
              <Button 
                type="text" 
                icon={<ClearOutlined />} 
                onClick={clearChat}
                style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}
              >
                清空
              </Button>
            </Space>
          </div>
        </div>

        {/* Model Selection */}
        <div style={{ 
          padding: '12px 24px', 
          borderBottom: '1px solid #f0f0f0',
          background: '#fafbfc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Text strong style={{ fontSize: 13, color: '#374151' }}>选择模型:</Text>
            <Select
              value={selectedModel}
              onChange={setSelectedModel}
              style={{ width: 300 }}
              size="small"
              disabled={noModels}
              placeholder={noModels ? "未检测到可用模型，请在 设置 中配置 .env" : "选择模型"}
            >
              {chatModels.map(model => (
                <Option key={model.id} value={model.id}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{model.name}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Tag size="small" color={model.supportImages ? 'green' : 'blue'}>
                        {model.supportImages ? '视觉' : '文本'}
                      </Tag>
                      <Tag size="small" color="orange">{model.providerName}</Tag>
                    </div>
                  </div>
                </Option>
              ))}
            </Select>
            {supportsImages && (
              <Tag color="green" style={{ fontSize: 11 }}>
                <PictureOutlined /> 支持图片
              </Tag>
            )}
          </div>
        </div>
        
        {/* Messages */}
        <div className="custom-scrollbar" style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '24px',
          background: '#f8fafc'
        }}>
          {messages.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              color: '#9ca3af', 
              marginTop: '20%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16
            }}>
              <div style={{ 
                width: 80, 
                height: 80, 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 32
              }}>
                <RobotOutlined />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                  开始与AI对话
                </div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>
                  {supportsImages ? '支持文字和图片输入' : '支持文字输入'}
                </div>
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <div key={message.id} style={{ marginBottom: 24 }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start',
                  flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                  gap: 12
                }}>
                  <Avatar 
                    icon={message.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                    style={{ 
                      backgroundColor: message.role === 'user' 
                        ? '#667eea' 
                        : '#10b981',
                      flexShrink: 0
                    }}
                  />
                  <div style={{ 
                    maxWidth: '75%',
                    background: message.role === 'user' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#fff',
                    color: message.role === 'user' ? '#fff' : '#374151',
                    padding: '12px 16px',
                    borderRadius: message.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
                    position: 'relative'
                  }}>
                    {message.images && message.images.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <Image.PreviewGroup>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {message.images.map((img, imgIndex) => (
                              <Image
                                key={imgIndex}
                                src={img}
                                alt={`Image ${imgIndex + 1}`}
                                style={{ 
                                  width: 80, 
                                  height: 80, 
                                  objectFit: 'cover', 
                                  borderRadius: 8
                                }}
                              />
                            ))}
                          </div>
                        </Image.PreviewGroup>
                      </div>
                    )}
                    <div style={{ 
                      whiteSpace: 'pre-wrap', 
                      wordBreak: 'break-word',
                      lineHeight: 1.6,
                      fontSize: 14
                    }}>
                      {message.content}
                    </div>
                    <div style={{ 
                      fontSize: 11, 
                      opacity: 0.7, 
                      marginTop: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span>{formatTime(message.timestamp)}</span>
                      <Popconfirm
                        title="确定要删除这条消息吗？"
                        onConfirm={() => deleteMessage(message.id)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button 
                          type="text" 
                          size="small"
                          icon={<DeleteOutlined />}
                          style={{ 
                            color: message.role === 'user' ? 'rgba(255,255,255,0.7)' : '#9ca3af',
                            padding: 0,
                            minWidth: 'auto',
                            height: 'auto'
                          }}
                        />
                      </Popconfirm>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 12,
              color: '#6b7280',
              fontSize: 14
            }}>
              <Avatar 
                icon={<RobotOutlined />}
                style={{ backgroundColor: '#10b981' }}
              />
              <div style={{
                background: '#fff',
                padding: '12px 16px',
                borderRadius: '20px 20px 20px 4px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.1)'
              }}>
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input Area */}
        <div style={{ 
          padding: '20px 24px', 
          borderTop: '1px solid #f0f0f0',
          background: '#fff',
          borderRadius: '0 0 12px 12px'
        }}>
          {supportsImages && uploadedFiles.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Upload {...uploadProps}>
                <div style={{ 
                  width: 80, 
                  height: 80, 
                  border: '2px dashed #d1d5db', 
                  borderRadius: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  backgroundColor: '#f9fafb',
                  transition: 'all 0.3s'
                }}>
                  <PictureOutlined style={{ fontSize: 16, color: '#6b7280', marginBottom: 4 }} />
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>添加图片</div>
                </div>
              </Upload>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <TextArea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={supportsImages ? "输入消息或上传图片..." : "输入您的问题..."}
                autoSize={{ minRows: 1, maxRows: 4 }}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                style={{ 
                  resize: 'none',
                  borderRadius: 12,
                  border: '2px solid #e5e7eb',
                  fontSize: 14
                }}
              />
            </div>
            
            {supportsImages && uploadedFiles.length === 0 && (
              <Upload {...uploadProps}>
                <Button 
                  icon={<PictureOutlined />}
                  style={{ 
                    borderRadius: 12,
                    height: 40,
                    border: '2px solid #e5e7eb'
                  }}
                >
                  图片
                </Button>
              </Upload>
            )}
            
            <Button 
              type="primary" 
              icon={<SendOutlined />}
              loading={loading}
              disabled={noModels || loading || (!inputValue.trim() && uploadedFiles.length === 0)}
              onClick={sendMessage}
              style={{ 
                borderRadius: 12,
                height: 40,
                paddingLeft: 20,
                paddingRight: 20,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none'
              }}
            >
              发送
            </Button>
          </div>
          
          <div style={{ 
            marginTop: 8, 
            fontSize: 12, 
            color: '#9ca3af',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>按 Enter 发送，Shift + Enter 换行</span>
            {supportsImages && (
              <span>最多上传3张图片</span>
            )}
          </div>
        </div>
      </Card>

      {/* History Drawer */}
      <Drawer
        title="聊天历史"
        placement="right"
        onClose={() => setHistoryVisible(false)}
        open={historyVisible}
        width={400}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text type="secondary">本地存储，仅在此设备可见</Text>
          <Popconfirm
            title="确定要清空所有历史记录吗？"
            onConfirm={() => {
              clearChat();
              setHistoryVisible(false);
            }}
            okText="确定"
            cancelText="取消"
          >
            <Button size="small" danger>清空历史</Button>
          </Popconfirm>
        </div>
        
        {messages.length === 0 ? (
          <Empty description="暂无聊天记录" />
        ) : (
          <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
            {messages.map((message) => (
              <div key={message.id} style={{ 
                marginBottom: 16, 
                padding: 12, 
                background: '#f8fafc', 
                borderRadius: 8,
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Tag color={message.role === 'user' ? 'blue' : 'green'}>
                    {message.role === 'user' ? '用户' : 'AI'}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {formatTime(message.timestamp)}
                  </Text>
                </div>
                
                {message.images && message.images.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <Image.PreviewGroup>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {message.images.map((img, index) => (
                          <Image
                            key={index}
                            src={img}
                            alt={`Image ${index + 1}`}
                            style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }}
                          />
                        ))}
                      </div>
                    </Image.PreviewGroup>
                  </div>
                )}
                
                <div style={{ 
                  fontSize: 13, 
                  color: '#374151',
                  lineHeight: 1.5,
                  maxHeight: 60,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {message.content}
                </div>
                
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <Button 
                    size="small" 
                    type="text"
                    onClick={() => navigator.clipboard.writeText(message.content)}
                  >
                    复制
                  </Button>
                  <Popconfirm
                    title="确定要删除这条记录吗？"
                    onConfirm={() => deleteMessage(message.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button 
                      size="small" 
                      type="text" 
                      danger
                      icon={<DeleteOutlined />}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                </div>
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default ChatInterface;