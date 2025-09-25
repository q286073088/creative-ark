import React, { useState } from 'react';
import { Layout, Menu, Button, Modal } from 'antd';
import { MessageOutlined, PictureOutlined, SettingOutlined } from '@ant-design/icons';
import ChatInterface from './components/ChatInterface';
import ImageGeneration from './components/ImageGeneration';
import ApiConfig from './components/ApiConfig';
import './App.css';

const { Header, Content, Sider } = Layout;

type AppMode = 'chat' | 'image';

const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<AppMode>('chat');
  const [configModalVisible, setConfigModalVisible] = useState(false);

  const menuItems = [
    {
      key: 'chat',
      icon: <MessageOutlined />,
      label: 'AI对话',
    },
    {
      key: 'image',
      icon: <PictureOutlined />,
      label: '图像生成',
    },
  ];

  const renderContent = () => {
    switch (currentMode) {
      case 'chat':
        return <ChatInterface />;
      case 'image':
        return <ImageGeneration />;
      default:
        return <ChatInterface />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        background: '#fff', 
        padding: '0 24px', 
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ 
            width: 32, 
            height: 32, 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 8,
            marginRight: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: 16
          }}>
            CA
          </div>
          <div>
            <h1 style={{ margin: 0, color: '#1f2937', fontSize: '20px', fontWeight: 600 }}>
              Creative Ark
            </h1>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: -2 }}>
              多模态AI创作平台
            </div>
          </div>
        </div>
        <div>
          <Button 
            type="text" 
            icon={<SettingOutlined />}
            onClick={() => setConfigModalVisible(true)}
            style={{ 
              borderRadius: 8,
              color: '#6b7280',
              border: '1px solid #e5e7eb'
            }}
          >
            设置
          </Button>
        </div>
      </Header>
      
      <Layout>
        <Sider 
          width={200} 
          style={{ 
            background: '#fff', 
            borderRight: '1px solid #f0f0f0',
            boxShadow: '2px 0 8px rgba(0,0,0,0.06)'
          }}
        >
          <Menu
            mode="inline"
            selectedKeys={[currentMode]}
            items={menuItems}
            onClick={({ key }) => setCurrentMode(key as AppMode)}
            style={{ 
              height: '100%', 
              borderRight: 0,
              paddingTop: 16
            }}
          />
        </Sider>
        
        <Content style={{ background: '#f8fafc' }}>
          {renderContent()}
        </Content>
      </Layout>

      <ApiConfig 
        visible={configModalVisible}
        onCancel={() => setConfigModalVisible(false)}
      />
    </Layout>
  );
};

export default App;