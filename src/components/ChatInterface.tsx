import React, { useState, useEffect, useRef } from 'react';
import { Card, Input, Button, Space, message as antdMessage, Avatar, Typography, Select, Upload, Image, Drawer, Empty, Tag, Popconfirm } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined, ClearOutlined, PictureOutlined, HistoryOutlined, DeleteOutlined, CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import type { UploadFile } from 'antd/es/upload/interface';
import { getAllChatModels, getProviderConfig, initializeConfig } from '../config/models';

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
    const initAndSetModel = async () => {
      await initializeConfig();
      const models = getAllChatModels();
      if (!selectedModel && models.length > 0) {
        setSelectedModel(models[0].id);
      }
    };
    initAndSetModel();
  }, [selectedModel]);

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

  const getProviderConfigForChat = (providerId: string) => {
    const providerConfig = getProviderConfig(providerId);
    if (!providerConfig) {
      return { baseUrl: '', apiKey: '' };
    }
    
    return {
      baseUrl: providerConfig.baseUrl,
      apiKey: providerConfig.apiKey
    };
  };

  const sendMessage = async () => {
    if (!inputValue.trim() && uploadedFiles.length === 0) {
      antdMessage.warning('请输入消息内容或上传图片');
      return;
    }

    if (!currentModel) {
      antdMessage.error('请选择一个模型');
      return;
    }

    const { baseUrl, apiKey } = getProviderConfigForChat(currentModel.providerId);
    if (!apiKey) {
      antdMessage.error(`请先配置${currentModel.providerName}的API密钥`);
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
        stream: true
      };

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API请求失败: ${response.status} - ${errorText}`);
      }

      // 创建助手消息占位符
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        model: selectedModel,
        providerId: currentModel.providerId
      };

      const messagesWithPlaceholder = [...newMessages, assistantMessage];
      setMessages(messagesWithPlaceholder);

      // 处理流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                
                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices?.[0]?.delta;
                  if (delta?.content) {
                    accumulatedContent += delta.content;
                    
                    // 实时更新消息内容
                    setMessages(prev => prev.map(msg => 
                      msg.id === assistantMessage.id 
                        ? { ...msg, content: accumulatedContent }
                        : msg
                    ));
                  }
                } catch (parseError) {
                  // 忽略解析错误，继续处理下一行
                  console.warn('解析流数据失败:', parseError);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }

      // 保存最终消息
      const finalMessages = messagesWithPlaceholder.map(msg => 
        msg.id === assistantMessage.id 
          ? { ...msg, content: accumulatedContent }
          : msg
      );
      setMessages(finalMessages);
      saveMessages(finalMessages);
    } catch (error) {
      console.error('发送消息失败:', error);
      antdMessage.error(`发送失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setUploadedFiles([]);
    localStorage.removeItem('chat_history');
    antdMessage.success('聊天记录已清空');
  };

  const deleteMessage = (messageId: string) => {
    const updatedMessages = messages.filter(msg => msg.id !== messageId);
    setMessages(updatedMessages);
    saveMessages(updatedMessages);
  };

  const regenerateMessage = async (messageId: string) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    // 找到对应的用户消息
    const userMessageIndex = messageIndex - 1;
    if (userMessageIndex < 0 || messages[userMessageIndex].role !== 'user') {
      antdMessage.error('无法找到对应的用户消息');
      return;
    }

    const userMessage = messages[userMessageIndex];
    
    // 删除当前AI回复
    const messagesBeforeRegenerate = messages.slice(0, messageIndex);
    setMessages(messagesBeforeRegenerate);

    if (!currentModel) {
      antdMessage.error('请选择一个模型');
      return;
    }

    const { baseUrl, apiKey } = getProviderConfigForChat(currentModel.providerId);
    if (!apiKey) {
      antdMessage.error(`请先配置${currentModel.providerName}的API密钥`);
      return;
    }

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
        ] : messagesBeforeRegenerate.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: 0.7,
        max_tokens: currentModel.maxTokens || 2000,
        stream: true
      };

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API请求失败: ${response.status} - ${errorText}`);
      }

      // 创建新的助手消息
      const newAssistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        model: selectedModel,
        providerId: currentModel.providerId
      };

      const messagesWithNewPlaceholder = [...messagesBeforeRegenerate, newAssistantMessage];
      setMessages(messagesWithNewPlaceholder);

      // 处理流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                
                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices?.[0]?.delta;
                  if (delta?.content) {
                    accumulatedContent += delta.content;
                    
                    // 实时更新消息内容
                    setMessages(prev => prev.map(msg => 
                      msg.id === newAssistantMessage.id 
                        ? { ...msg, content: accumulatedContent }
                        : msg
                    ));
                  }
                } catch (parseError) {
                  console.warn('解析流数据失败:', parseError);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }

      // 保存最终消息
      const finalMessages = messagesWithNewPlaceholder.map(msg => 
        msg.id === newAssistantMessage.id 
          ? { ...msg, content: accumulatedContent }
          : msg
      );
      setMessages(finalMessages);
      saveMessages(finalMessages);
      
      antdMessage.success('重新生成完成');
    } catch (error) {
      console.error('重新生成失败:', error);
      antdMessage.error(`重新生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
      // 恢复原来的消息
      setMessages(messages);
    } finally {
      setLoading(false);
    }
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
        antdMessage.error('只能上传图片文件！');
        return false;
      }
      
      if (uploadedFiles.length >= 3) {
        antdMessage.error('最多只能上传3张图片！');
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
    <div style={{ 
      height: 'calc(100vh - 120px)', 
      display: 'flex', 
      flexDirection: 'column',
      padding: window.innerWidth <= 768 ? '12px' : '24px',
      maxWidth: '100%',
      overflow: 'hidden'
    }}>
      <Card 
        style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          border: 'none',
          height: '100%'
        }}
        bodyStyle={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          padding: 0,
          height: '100%'
        }}
      >
        {/* Header */}
        <div style={{ 
          padding: window.innerWidth <= 768 ? '12px 16px' : '16px 24px', 
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
          padding: window.innerWidth <= 768 ? '8px 16px' : '12px 24px', 
          borderBottom: '1px solid #f0f0f0',
          background: '#fafbfc'
        }}>
          <div style={{ 
            display: 'flex', 
            gap: window.innerWidth <= 768 ? 8 : 12,
            flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
            alignItems: window.innerWidth <= 768 ? 'stretch' : 'center'
          }}>
            <Text strong style={{ fontSize: 13, color: '#374151' }}>选择模型:</Text>
            <Select
              value={selectedModel}
              onChange={setSelectedModel}
              style={{ width: window.innerWidth <= 768 ? '100%' : 420 }}
              size="middle"
              disabled={noModels}
              placeholder={noModels ? "未检测到可用模型，请在 设置 中配置 .env" : "选择模型"}
            >
              {chatModels.map(model => (
                <Option key={model.id} value={model.id}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{model.name}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Tag color={model.supportImages ? 'green' : 'blue'}>
                        {model.supportImages ? '视觉' : '文本'}
                      </Tag>
                      <Tag color="orange">{model.providerName}</Tag>
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
          overflowX: 'hidden',
          padding: window.innerWidth <= 768 ? '16px' : '24px',
          background: '#f8fafc',
          minHeight: 0
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
            messages.map((message) => (
              <div key={message.id} style={{ marginBottom: 24 }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start',
                  flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                  gap: window.innerWidth <= 768 ? 8 : 12
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
                    maxWidth: window.innerWidth <= 768 ? '85%' : '75%',
                    background: message.role === 'user' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#fff',
                    color: message.role === 'user' ? '#fff' : '#374151',
                    padding: window.innerWidth <= 768 ? '10px 12px' : '12px 16px',
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
                      wordBreak: 'break-word',
                      lineHeight: 1.6,
                      fontSize: 14
                    }}>
                      {message.role === 'assistant' ? (
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <div style={{ margin: '8px 0' }}>{children}</div>,
                            code: ({ children, className }) => {
                              const isInline = !className;
                              return isInline ? (
                                <code style={{
                                  background: 'rgba(0,0,0,0.1)',
                                  padding: '2px 4px',
                                  borderRadius: '4px',
                                  fontSize: '13px'
                                }}>
                                  {children}
                                </code>
                              ) : (
                                <pre style={{
                                  background: 'rgba(0,0,0,0.05)',
                                  padding: '12px',
                                  borderRadius: '8px',
                                  overflow: 'auto',
                                  fontSize: '13px',
                                  margin: '8px 0'
                                }}>
                                  <code>{children}</code>
                                </pre>
                              );
                            },
                            ul: ({ children }) => <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>{children}</ul>,
                            ol: ({ children }) => <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>{children}</ol>,
                            li: ({ children }) => <li style={{ margin: '4px 0' }}>{children}</li>,
                            h1: ({ children }) => <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '12px 0 8px 0' }}>{children}</h1>,
                            h2: ({ children }) => <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '10px 0 6px 0' }}>{children}</h2>,
                            h3: ({ children }) => <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '8px 0 4px 0' }}>{children}</h3>,
                            blockquote: ({ children }) => (
                              <blockquote style={{
                                borderLeft: '4px solid #e5e7eb',
                                paddingLeft: '12px',
                                margin: '8px 0',
                                fontStyle: 'italic',
                                color: '#6b7280'
                              }}>
                                {children}
                              </blockquote>
                            )
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      ) : (
                        <div style={{ whiteSpace: 'pre-wrap' }}>
                          {message.content}
                        </div>
                      )}
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
                      {message.role === 'assistant' ? (
                        <Space size={8}>
                          <Button 
                            type="text" 
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => {
                              navigator.clipboard.writeText(message.content);
                              antdMessage.success('已复制到剪贴板');
                            }}
                            style={{ 
                              color: '#9ca3af',
                              padding: '2px 4px',
                              minWidth: 'auto',
                              height: 'auto',
                              fontSize: '12px'
                            }}
                            title="复制"
                          />
                          <Button 
                            type="text" 
                            size="small"
                            icon={<ReloadOutlined />}
                            onClick={() => regenerateMessage(message.id)}
                            style={{ 
                              color: '#9ca3af',
                              padding: '2px 4px',
                              minWidth: 'auto',
                              height: 'auto',
                              fontSize: '12px'
                            }}
                            title="重新生成"
                          />
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
                                color: '#9ca3af',
                                padding: '2px 4px',
                                minWidth: 'auto',
                                height: 'auto',
                                fontSize: '12px'
                              }}
                              title="删除"
                            />
                          </Popconfirm>
                        </Space>
                      ) : (
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
                              color: 'rgba(255,255,255,0.7)',
                              padding: 0,
                              minWidth: 'auto',
                              height: 'auto'
                            }}
                          />
                        </Popconfirm>
                      )}
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
          padding: window.innerWidth <= 768 ? '16px' : '20px 24px', 
          borderTop: '1px solid #f0f0f0',
          background: '#fff',
          borderRadius: '0 0 12px 12px',
          flexShrink: 0
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
          
          <div style={{ 
            display: 'flex', 
            gap: window.innerWidth <= 768 ? 8 : 12, 
            alignItems: 'flex-end',
            flexDirection: window.innerWidth <= 768 ? 'column' : 'row'
          }}>
            <div style={{ 
              flex: 1, 
              width: window.innerWidth <= 768 ? '100%' : 'auto'
            }}>
              <TextArea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={supportsImages ? "输入消息或上传图片..." : "输入您的问题..."}
                autoSize={{ minRows: 1, maxRows: window.innerWidth <= 768 ? 3 : 4 }}
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
            
            <div style={{ 
              display: 'flex', 
              gap: window.innerWidth <= 768 ? 8 : 12,
              width: window.innerWidth <= 768 ? '100%' : 'auto',
              justifyContent: window.innerWidth <= 768 ? 'space-between' : 'flex-start'
            }}>
              {supportsImages && uploadedFiles.length === 0 && (
                <Upload {...uploadProps}>
                  <Button 
                    icon={<PictureOutlined />}
                    style={{ 
                      borderRadius: 12,
                      height: 40,
                      border: '2px solid #e5e7eb',
                      flex: window.innerWidth <= 768 ? 1 : 'none'
                    }}
                  >
                    {window.innerWidth <= 768 ? '' : '图片'}
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
                  paddingLeft: window.innerWidth <= 768 ? 16 : 20,
                  paddingRight: window.innerWidth <= 768 ? 16 : 20,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  flex: window.innerWidth <= 768 ? 2 : 'none'
                }}
              >
                {window.innerWidth <= 768 ? '' : '发送'}
              </Button>
            </div>
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