import React, { useState, useEffect } from 'react';
import { Button, Space, Image, Empty, Popconfirm, Typography, Tag } from 'antd';
import { DeleteOutlined, DownloadOutlined, MessageOutlined, EyeOutlined, PictureOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface TextMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
}

interface VisionMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  timestamp: string;
  model?: string;
}

interface ImageGenerationItem {
  id: string;
  image: string;
  prompt: string;
  timestamp: string;
  referenceImages?: string[];
  imageSize?: string;
  model?: string;
}

interface GenerationHistoryProps {
  chatType: 'text' | 'vision' | 'image';
}

const GenerationHistory: React.FC<GenerationHistoryProps> = ({ chatType }) => {
  const [textHistory, setTextHistory] = useState<TextMessage[]>([]);
  const [visionHistory, setVisionHistory] = useState<VisionMessage[]>([]);
  const [imageHistory, setImageHistory] = useState<ImageGenerationItem[]>([]);

  useEffect(() => {
    loadHistory();
  }, [chatType]);

  const loadHistory = () => {
    switch (chatType) {
      case 'text':
        const textData = JSON.parse(localStorage.getItem('text_chat_history') || '[]');
        setTextHistory(textData);
        break;
      case 'vision':
        const visionData = JSON.parse(localStorage.getItem('vision_chat_history') || '[]');
        setVisionHistory(visionData);
        break;
      case 'image':
        const imageData = JSON.parse(localStorage.getItem('image_generation_history') || '[]');
        setImageHistory(imageData);
        break;
    }
  };

  const clearHistory = () => {
    switch (chatType) {
      case 'text':
        localStorage.removeItem('text_chat_history');
        setTextHistory([]);
        break;
      case 'vision':
        localStorage.removeItem('vision_chat_history');
        setVisionHistory([]);
        break;
      case 'image':
        localStorage.removeItem('image_generation_history');
        setImageHistory([]);
        break;
    }
  };

  const deleteTextMessage = (id: string) => {
    const updatedHistory = textHistory.filter(item => item.id !== id);
    setTextHistory(updatedHistory);
    localStorage.setItem('text_chat_history', JSON.stringify(updatedHistory));
  };

  const deleteVisionMessage = (id: string) => {
    const updatedHistory = visionHistory.filter(item => item.id !== id);
    setVisionHistory(updatedHistory);
    localStorage.setItem('vision_chat_history', JSON.stringify(updatedHistory));
  };

  const deleteImageItem = (id: string) => {
    const updatedHistory = imageHistory.filter(item => item.id !== id);
    setImageHistory(updatedHistory);
    localStorage.setItem('image_generation_history', JSON.stringify(updatedHistory));
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const downloadImage = (imageUrl: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `creative-ark-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getEmptyDescription = () => {
    switch (chatType) {
      case 'text':
        return '暂无文本对话记录';
      case 'vision':
        return '暂无视觉对话记录';
      case 'image':
        return '暂无图像生成记录';
      default:
        return '暂无记录';
    }
  };

  const getCurrentHistory = () => {
    switch (chatType) {
      case 'text':
        return textHistory;
      case 'vision':
        return visionHistory;
      case 'image':
        return imageHistory;
      default:
        return [];
    }
  };

  const currentHistory = getCurrentHistory();

  if (currentHistory.length === 0) {
    return (
      <div className="empty-state">
        <Empty 
          description={getEmptyDescription()}
          style={{ padding: '40px 0' }}
        />
      </div>
    );
  }

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 16,
        padding: '0 4px'
      }}>
        <Space>
          {chatType === 'text' && <Tag icon={<MessageOutlined />} color="blue">文本对话</Tag>}
          {chatType === 'vision' && <Tag icon={<EyeOutlined />} color="green">视觉对话</Tag>}
          {chatType === 'image' && <Tag icon={<PictureOutlined />} color="orange">图像生成</Tag>}
          <span style={{ color: '#8c8c8c', fontSize: '14px' }}>
            仅保存在本地浏览器
          </span>
        </Space>
        <Space>
          <Button size="small" onClick={loadHistory}>刷新</Button>
          <Popconfirm
            title="确定要清空所有历史记录吗？"
            onConfirm={clearHistory}
            okText="确定"
            cancelText="取消"
          >
            <Button size="small" danger>清空</Button>
          </Popconfirm>
        </Space>
      </div>

      <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {chatType === 'text' && textHistory.map((message) => (
          <div key={message.id} className="history-item" style={{ marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: 8,
                gap: 8
              }}>
                <Tag color={message.role === 'user' ? 'blue' : 'green'}>
                  {message.role === 'user' ? '用户' : 'AI'}
                </Tag>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {formatDate(message.timestamp)}
                </Text>
                {message.model && (
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    {message.model.split('/').pop()}
                  </Text>
                )}
              </div>
              <div style={{ 
                fontSize: '14px', 
                color: '#262626',
                marginBottom: 8,
                lineHeight: '1.4',
                maxHeight: '100px',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {message.content}
              </div>
              <Space size="small">
                <Button 
                  size="small" 
                  type="text"
                  onClick={() => navigator.clipboard.writeText(message.content)}
                >
                  复制内容
                </Button>
                <Popconfirm
                  title="确定要删除这条记录吗？"
                  onConfirm={() => deleteTextMessage(message.id)}
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
              </Space>
            </div>
          </div>
        ))}

        {chatType === 'vision' && visionHistory.map((message) => (
          <div key={message.id} className="history-item" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {message.images && message.images.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <Image.PreviewGroup>
                    {message.images.map((img, index) => (
                      <Image
                        key={index}
                        src={img}
                        alt={`Image ${index + 1}`}
                        style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }}
                      />
                    ))}
                  </Image.PreviewGroup>
                </div>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: 8,
                gap: 8
              }}>
                <Tag color={message.role === 'user' ? 'blue' : 'green'}>
                  {message.role === 'user' ? '用户' : 'AI'}
                </Tag>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {formatDate(message.timestamp)}
                </Text>
                {message.model && (
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    {message.model.split('/').pop()}
                  </Text>
                )}
              </div>
              <div style={{ 
                fontSize: '14px', 
                color: '#262626',
                marginBottom: 8,
                lineHeight: '1.4',
                maxHeight: '100px',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {message.content}
              </div>
              <Space size="small">
                <Button 
                  size="small" 
                  type="text"
                  onClick={() => navigator.clipboard.writeText(message.content)}
                >
                  复制内容
                </Button>
                <Popconfirm
                  title="确定要删除这条记录吗？"
                  onConfirm={() => deleteVisionMessage(message.id)}
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
              </Space>
            </div>
          </div>
        ))}

        {chatType === 'image' && imageHistory.map((item) => (
          <div key={item.id} className="history-item" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Image
                src={item.image}
                alt="Generated"
                style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8 }}
                preview={{
                  mask: false,
                }}
              />
              {item.referenceImages && item.referenceImages.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <Text type="secondary" style={{ fontSize: '12px', width: '100%' }}>参考图片:</Text>
                  {item.referenceImages.map((refImg, index) => (
                    <Image
                      key={index}
                      src={refImg}
                      alt={`Reference ${index + 1}`}
                      style={{ width: 30, height: 30, objectFit: 'cover', borderRadius: 4 }}
                      preview={{
                        mask: false,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: 8,
                gap: 8
              }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {formatDate(item.timestamp)}
                </Text>
                {item.imageSize && (
                  <Tag color="blue" style={{ fontSize: '11px' }}>
                    {item.imageSize}
                  </Tag>
                )}
                {item.model && (
                  <Tag color="green" style={{ fontSize: '11px' }}>
                    {item.model.split('/').pop()}
                  </Tag>
                )}
              </div>
              <div style={{ 
                fontSize: '14px', 
                color: '#262626',
                marginBottom: 8,
                lineHeight: '1.4',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
                {item.prompt}
              </div>
              <Space size="small">
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
                  onConfirm={() => deleteImageItem(item.id)}
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
              </Space>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GenerationHistory;