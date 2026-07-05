import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import App from './App';
import TabsPage from './TabsPage';
import TestPage from './TestPage';

function Root() {
  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem('guitar-theme') || 'light';
  });

  // 监听其他页面（如 App.jsx）修改 localStorage 后的变化
  useEffect(() => {
    const handler = () => {
      const saved = localStorage.getItem('guitar-theme') || 'light';
      setThemeMode(saved);
    };
    window.addEventListener('storage', handler);
    // 轮询兼容同页面修改
    const timer = setInterval(() => {
      const saved = localStorage.getItem('guitar-theme') || 'light';
      if (saved !== themeMode) setThemeMode(saved);
    }, 500);
    return () => {
      window.removeEventListener('storage', handler);
      clearInterval(timer);
    };
  }, [themeMode]);

  const isDark = useMemo(() => {
    if (themeMode === 'dark') return true;
    if (themeMode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  }, [themeMode]);

  // 设置 html 的 data-theme 属性（用于 CSS），所有路由共享
  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }, [isDark]);

  return (
    <React.StrictMode>
      <ConfigProvider
        theme={{
          algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: {
            colorPrimary: '#389e0d',
          },
        }}
      >
        <BrowserRouter basename="/guitar">
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/detail/:name" element={<TabsPage />} />
            <Route path="/test" element={<TestPage />} />
          </Routes>
        </BrowserRouter>
      </ConfigProvider>
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
