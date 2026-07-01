import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import App from './App';
import TabsPage from './TabsPage';
import TestPage from './TestPage';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
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
  </React.StrictMode>,
);
