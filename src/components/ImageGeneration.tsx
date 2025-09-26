import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Upload, Space, message, Image, Select, Drawer, Empty, Tag, Popconfirm, Progress } from 'antd';
import { PictureOutlined, DownloadOutlined, ClearOutlined, HistoryOutlined, DeleteOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { getAllImageModels, getProviderConfig } from '../config/models';


const { TextArea } = Input;
const { Option } = Select;

interface GenerationItem {
  id: string;
  image: string;
  prompt: string;
  timestamp: string;
  referenceImages?: string[];
  imageSize?: string;
  model?: string;
  providerId?: string;
}

const ImageGeneration: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadFile[]>([]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imageSize, setImageSize] = useState('1024x1024');
  const [selectedModel, setSelectedModel] = useState(() => (getAllImageModels()[0]?.id) || '');
  const [historyVisible, setHistoryVisible] = useState(false);
  const [history, setHistory] = useState<GenerationItem[]>([]);

  const imageModels = getAllImageModels();
  const currentModel = imageModels.find(m => m.id === selectedModel);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (uploadedFiles.length > 0) {
      // 如果有上传图片，自动切换到图生图模型
      const editModel = imageModels.find(m => m.type === 'image-edit');
      if (editModel && editModel.id !== selectedModel) {
        setSelectedModel(editModel.id);
      }
    } else {
      // 如果没有图片，切换到文生图模型
      const genModel = imageModels.find(m => m.type === 'image-generation');
      if (genModel && currentModel?.type === 'image-edit') {
        setSelectedModel(genModel.id);
      }
    }
  }, [uploadedFiles, selectedModel, imageModels, currentModel]);

  const loadHistory = () => {
    const savedHistory = JSON.parse(localStorage.getItem('image_generation_history') || '[]');
    setHistory(savedHistory);
  };

  
  const generateImageWithAPI = async (prompt: string, referenceImages?: string[]) => {
    if (!currentModel) {
      throw new Error('请选择一个模型');
    }

    const providerConfig = getProviderConfig(currentModel.providerId);

    if (!providerConfig?.apiKey) {
      throw new Error(`请先配置${currentModel.providerName}的API密钥`);
    }

    // 判断是否为 ModelScope API
    const isModelScope = providerConfig.baseUrl.includes('modelscope.cn');

    // 使用代理路径或原始 URL
    let baseUrl;
    if (isModelScope) {
      baseUrl = '/api-modelscope/';
    } else {
      baseUrl = providerConfig.baseUrl.endsWith('/') ? providerConfig.baseUrl : providerConfig.baseUrl + '/';
    }

    // 根据模型类型构建不同的请求体
    let requestBody: any;

    if (currentModel.type === 'image-edit' && referenceImages && referenceImages.length > 0) {
      // 图生图模式 - 使用 ModelScope async API
      let imageUrl = referenceImages[0];

      // 暂时使用固定的测试图片URL，ModelScope API需要在线可访问的图片
      imageUrl = 'https://resources.modelscope.cn/aigc/image_edit.png'; // 使用Python示例中的测试图片

      // 给用户一个提示
      setTimeout(() => {
        message.info('当前使用测试图片进行图生图，完整功能需要图片上传服务支持');
      }, 1000);

      requestBody = {
        model: "Qwen/Qwen-Image-Edit", // 使用固定的模型ID，如Python示例
        prompt: prompt,
        image_url: imageUrl // 使用在线URL
      };
    } else {
      // 文生图模式 - 使用标准 OpenAI API
      requestBody = {
        model: selectedModel,
        prompt: prompt,
        n: 1,
        size: imageSize,
        quality: "standard",
        response_format: "url"
      };

      const response = await fetch(`${baseUrl}images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${providerConfig.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API错误响应:', errorText);
        throw new Error(`API请求失败: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('API响应数据:', data);

      // 处理不同的响应格式
      if (data.data && data.data.length > 0) {
        return data.data[0].url;
      } else if (data.images && data.images.length > 0) {
        return data.images[0].url;
      } else if (data.url) {
        return data.url;
      } else {
        throw new Error('API响应中未找到图片URL');
      }
    }

    // 图生图模式 - 使用 ModelScope async API
    const requestUrl = `${baseUrl}v1/images/generations`;

    // 简化请求体处理，直接使用JSON字符串
    const requestBodyStr = JSON.stringify(requestBody);

    console.log('发送请求到:', requestUrl);
    console.log('请求体:', requestBodyStr);
    console.log('请求头:', {
      'Authorization': `Bearer ${providerConfig.apiKey}`,
      'Content-Type': 'application/json',
      'X-ModelScope-Async-Mode': 'true'
    });

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${providerConfig.apiKey}`,
        'Content-Type': 'application/json',
        'X-ModelScope-Async-Mode': 'true'
      },
      body: requestBodyStr
    });

    console.log('响应状态:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API错误响应:', errorText);
      console.error('响应头:', response.headers);
      throw new Error(`API请求失败: ${response.status} - ${errorText}`);
    }

    const taskData = await response.json();
    console.log('任务创建响应:', taskData);

    if (!taskData.task_id) {
      throw new Error('未获取到任务ID');
    }

    const taskId = taskData.task_id;

    // 轮询任务状态 - 与Python示例保持一致
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒，与Python示例一致

      console.log('查询任务状态...');

      const resultResponse = await fetch(`${baseUrl}v1/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${providerConfig.apiKey}`,
          'X-ModelScope-Task-Type': 'image_generation'
        }
      });

      if (!resultResponse.ok) {
        const errorText = await resultResponse.text();
        console.error('任务状态查询失败:', errorText);
        throw new Error(`任务状态查询失败: ${resultResponse.status} - ${errorText}`);
      }

      const resultData = await resultResponse.json();
      console.log('任务状态:', resultData);

      if (resultData.task_status === 'SUCCEED') {
        if (resultData.output_images && resultData.output_images.length > 0) {
          return resultData.output_images[0];
        } else {
          throw new Error('任务成功但未返回图片URL');
        }
      } else if (resultData.task_status === 'FAILED') {
        throw new Error(`图片生成失败: ${resultData.message || '未知错误'}`);
      }

      // 任务仍在进行中（PENDING或RUNNING），继续轮询
      console.log(`任务状态: ${resultData.task_status}，继续等待...`);
    }
  };

  const saveImageToLocal = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const localUrl = URL.createObjectURL(blob);
      return localUrl;
    } catch (error) {
      console.error('保存图片失败:', error);
      return imageUrl;
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      message.warning('请输入提示词');
      return;
    }

    if (!currentModel) {
      message.error('请选择一个模型');
      return;
    }

    setLoading(true);
    setProgress(0);
    
    try {
      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 500);

      setProgress(20);
      const referenceImages = uploadedFiles.map(file => file.url).filter(Boolean) as string[];
      
      setProgress(40);
      const imageUrl = await generateImageWithAPI(prompt, referenceImages);
      
      setProgress(70);
      const localImageUrl = await saveImageToLocal(imageUrl);
      
      setProgress(90);
      setGeneratedImage(localImageUrl);
      
      const historyItem: GenerationItem = {
        id: Date.now().toString(),
        image: localImageUrl,
        prompt,
        timestamp: new Date().toISOString(),
        referenceImages: uploadedFiles.map(file => file.url).filter((url): url is string => Boolean(url)),
        imageSize: imageSize,
        model: selectedModel,
        providerId: currentModel.providerId
      };
      
      const existingHistory = JSON.parse(localStorage.getItem('image_generation_history') || '[]');
      const newHistory = [historyItem, ...existingHistory].slice(0, 50);
      localStorage.setItem('image_generation_history', JSON.stringify(newHistory));
      setHistory(newHistory);
      
      clearInterval(progressInterval);
      setProgress(100);
      
      setTimeout(() => {
        setProgress(0);
        message.success('图像生成成功！');
      }, 500);
      
    } catch (error) {
      console.error('生成图片失败:', error);
      message.error(`生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = (imageUrl: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `creative-ark-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearAll = () => {
    setPrompt('');
    setUploadedFiles([]);
    setGeneratedImage(null);
    message.success('已清空所有内容');
  };

  const clearHistory = () => {
    localStorage.removeItem('image_generation_history');
    setHistory([]);
    message.success('历史记录已清空');
  };

  const deleteHistoryItem = (id: string) => {
    const updatedHistory = history.filter(item => item.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('image_generation_history', JSON.stringify(updatedHistory));
  };

  const uploadProps = {
    beforeUpload: (file: File) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('只能上传图片文件！');
        return false;
      }
      
      if (uploadedFiles.length >= 3) {
        message.error('最多只能上传3张参考图片！');
        return false;
      }
      
      // 对于ModelScope图生图，需要将图片上传到可访问的URL
      // 这里先使用FileReader读取，但需要转换为在线URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const newFile: UploadFile = {
          uid: Date.now().toString() + Math.random(),
          name: file.name,
          status: 'done',
          url: e.target?.result as string, // 暂时使用Data URL，后面会处理
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

  const sizeOptions = [
    { label: '1:1 (1024×1024)', value: '1024x1024' },
    { label: '3:4 (768×1024)', value: '768x1024' },
    { label: '4:3 (1024×768)', value: '1024x768' },
    { label: '16:9 (1024×576)', value: '1024x576' },
    { label: '9:16 (576×1024)', value: '576x1024' },
  ];

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={{ height: '100vh', display: 'flex', gap: 24, padding: 24 }}>
      <div style={{ width: 400, flexShrink: 0 }}>
        <Card 
          style={{ 
            borderRadius: 12,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            border: 'none'
          }}
        >
          {/* Header */}
          <div style={{ 
            margin: '-24px -24px 20px -24px',
            padding: '16px 24px', 
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: '#fff',
            borderRadius: '12px 12px 0 0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <PictureOutlined style={{ fontSize: 20 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>AI图像生成</div>
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
                  onClick={clearAll}
                  style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}
                >
                  清空
                </Button>
              </Space>
            </div>
          </div>

          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <div style={{ marginBottom: 8, fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                生成模式
              </div>
              <div style={{ 
                padding: '12px 16px', 
                background: currentModel?.type === 'image-generation' ? '#e6f7ff' : '#fff7e6',
                border: `2px solid ${currentModel?.type === 'image-generation' ? '#91d5ff' : '#ffd591'}`,
                borderRadius: 8,
                fontSize: '13px',
                fontWeight: 500
              }}>
                {currentModel?.type === 'image-generation' ? '📝 文生图模式' : '🎨 图生图模式'}
              </div>
            </div>

            <div>
              <div style={{ marginBottom: 8, fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                选择模型
              </div>
              <Select
                value={selectedModel}
                onChange={setSelectedModel}
                style={{ width: '100%' }}
                placeholder="选择生成模型"
              >
                {imageModels.map(model => (
                  <Option key={model.id} value={model.id}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>{model.name}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Tag color={model.type === 'image-generation' ? 'blue' : 'green'}>
                          {model.type === 'image-generation' ? '文生图' : '图生图'}
                        </Tag>
                        <Tag color="orange">{model.providerName}</Tag>
                      </div>
                    </div>
                  </Option>
                ))}
              </Select>
            </div>

            <div>
              <div style={{ marginBottom: 8, fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                参考图片 (可选，最多3张)
              </div>
              <Upload {...uploadProps}>
                <div style={{ 
                  width: 104, 
                  height: 104, 
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
                  <PictureOutlined style={{ fontSize: 20, color: '#6b7280', marginBottom: 4 }} />
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>上传图片</div>
                </div>
              </Upload>
            </div>

            <div>
              <div style={{ marginBottom: 8, fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                图片尺寸
              </div>
              <Select
                value={imageSize}
                onChange={setImageSize}
                style={{ width: '100%' }}
                placeholder="选择图片尺寸"
              >
                {sizeOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </div>

            <div>
              <div style={{ marginBottom: 8, fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                提示词
              </div>
              <TextArea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="描述你想要生成的图片..."
                rows={6}
                style={{ 
                  resize: 'none',
                  borderRadius: 8,
                  border: '2px solid #e5e7eb'
                }}
              />
            </div>

            <div>
              {loading && progress > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <Progress 
                    percent={Math.round(progress)} 
                    strokeColor={{
                      '0%': '#f093fb',
                      '100%': '#f5576c',
                    }}
                    trailColor="#f0f0f0"
                    size={8}
                    showInfo={true}
                    format={(percent) => `生成中 ${percent}%`}
                  />
                </div>
              )}
              
              <Button 
                type="primary" 
                block 
                size="large"
                loading={loading}
                onClick={handleGenerate}
                style={{
                  height: 48,
                  borderRadius: 12,
                  background: loading 
                    ? 'linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%)'
                    : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  border: 'none',
                  fontSize: 16,
                  fontWeight: 600
                }}
              >
                {loading ? '生成中...' : '开始生成'}
              </Button>
            </div>
          </Space>
        </Card>
      </div>

      <div style={{ flex: 1 }}>
        <Card 
          style={{ 
            height: '100%',
            borderRadius: 12,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            border: 'none'
          }}
          bodyStyle={{ 
            height: 'calc(100% - 57px)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: 24
          }}
        >
          {generatedImage ? (
            <div style={{ textAlign: 'center', width: '100%' }}>
              <Image
                src={generatedImage}
                alt="Generated"
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: 'calc(100vh - 300px)', 
                  borderRadius: 12,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
                }}
              />
              <div style={{ marginTop: 24 }}>
                <Button 
                  type="primary" 
                  icon={<DownloadOutlined />}
                  onClick={() => downloadImage(generatedImage)}
                  style={{
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none'
                  }}
                >
                  下载图片
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ 
              textAlign: 'center', 
              color: '#9ca3af',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16
            }}>
              <div style={{ 
                width: 120, 
                height: 120, 
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 48
              }}>
                <PictureOutlined />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                  AI图像生成
                </div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>
                  输入提示词，让AI为您创作精美图片
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* History Drawer */}
      <Drawer
        title="生成历史"
        placement="right"
        onClose={() => setHistoryVisible(false)}
        open={historyVisible}
        width={500}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <Tag color="orange">图像生成</Tag>
            <span style={{ color: '#8c8c8c', fontSize: 14 }}>本地存储，仅在此设备可见</span>
          </div>
          <Space>
            <Button size="small" onClick={loadHistory}>刷新</Button>
            <Popconfirm
              title="确定要清空所有历史记录吗？"
              onConfirm={clearHistory}
              okText="确定"
              cancelText="取消"
            >
              <Button size="small" danger>清空历史</Button>
            </Popconfirm>
          </Space>
        </div>
        
        {history.length === 0 ? (
          <Empty description="暂无生成记录" />
        ) : (
          <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
            {history.map((item) => (
              <div key={item.id} style={{ 
                marginBottom: 16, 
                padding: 16, 
                background: '#f8fafc', 
                borderRadius: 12,
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Image
                    src={item.image}
                    alt="Generated"
                    style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }}
                    preview={{ mask: false }}
                  />
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      marginBottom: 8,
                      gap: 8
                    }}>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>
                        {formatTime(item.timestamp)}
                      </span>
                      {item.imageSize && (
                        <Tag color="blue">{item.imageSize}</Tag>
                      )}
                      {item.model && (
                        <Tag color="green">
                          {imageModels.find(m => m.id === item.model)?.name}
                        </Tag>
                      )}
                    </div>
                    
                    <div style={{ 
                      fontSize: 13, 
                      color: '#374151',
                      lineHeight: 1.5,
                      marginBottom: 12,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {item.prompt}
                    </div>
                    
                    {item.referenceImages && item.referenceImages.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>参考图片:</div>
                        <Image.PreviewGroup>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {item.referenceImages.map((refImg, index) => (
                              <Image
                                key={index}
                                src={refImg}
                                alt={`Reference ${index + 1}`}
                                style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 4 }}
                              />
                            ))}
                          </div>
                        </Image.PreviewGroup>
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button 
                        size="small" 
                        type="text"
                        onClick={() => navigator.clipboard.writeText(item.prompt)}
                      >
                        复制提示词
                      </Button>
                      <Button 
                        size="small" 
                        type="text" 
                        icon={<DownloadOutlined />}
                        onClick={() => downloadImage(item.image)}
                      >
                        下载
                      </Button>
                      <Popconfirm
                        title="确定要删除这条记录吗？"
                        onConfirm={() => deleteHistoryItem(item.id)}
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
                </div>
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default ImageGeneration;