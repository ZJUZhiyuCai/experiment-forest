import React, { useState } from 'react';
import { Sample } from '@/types';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import SampleList from '@/components/SampleList';
import SampleDetail from '@/components/SampleDetail';
import SampleForm from '@/components/SampleForm';

const SampleManagement: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState<'list' | 'detail' | 'form'>('list');
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
  const [editingSample, setEditingSample] = useState<Sample | undefined>();

  const handleSelectSample = (sample: Sample) => {
    setSelectedSample(sample);
    setCurrentView('detail');
  };

  // 移动到列表组件中处理
  // const handleEditSample = (sample?: Sample) => {
  //   setEditingSample(sample);
  //   setCurrentView('form');
  // };

  const handleFormSubmit = () => {
    // 表单提交逻辑在SampleForm组件内处理
    // 这里只需要切换回列表视图
    setCurrentView('list');
    setEditingSample(undefined);
  };

  const handleFormCancel = () => {
    setCurrentView('list');
    setEditingSample(undefined);
  };

  const handleDetailClose = () => {
    setCurrentView('list');
    setSelectedSample(null);
  };

  const handleDetailEdit = () => {
    if (selectedSample) {
      setEditingSample(selectedSample);
      setCurrentView('form');
    }
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'detail':
        return selectedSample ? (
          <SampleDetail
            sampleId={selectedSample.id}
            onEdit={handleDetailEdit}
            onClose={handleDetailClose}
          />
        ) : null;

      case 'form':
        return (
          <SampleForm
            sample={editingSample}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
          />
        );

      case 'list':
      default:
        return (
          <SampleList
            onSelectSample={handleSelectSample}
            showActions={true}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F6F2] text-[#555555]">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header 
          title="样本管理" 
          sidebarCollapsed={sidebarCollapsed}
        />
        
        <main className="container mx-auto px-4 py-4">
          <nav className="flex mb-4" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-4">
              <li>
                <div className="flex items-center">
                  <button
                    onClick={() => setCurrentView('list')}
                    className={`font-medium ${
                      currentView === 'list'
                        ? 'text-[#7FB069]'
                        : 'text-gray-500 hover:text-[#7FB069]'
                    }`}
                  >
                    样本管理
                  </button>
                </div>
              </li>
              {currentView === 'detail' && selectedSample && (
                <>
                  <li>
                    <div className="flex items-center">
                      <i className="fa-solid fa-chevron-right text-gray-400 mr-4"></i>
                      <span className="font-medium text-[#4A7C59]">
                        {selectedSample.name}
                      </span>
                    </div>
                  </li>
                </>
              )}
              {currentView === 'form' && (
                <>
                  <li>
                    <div className="flex items-center">
                      <i className="fa-solid fa-chevron-right text-gray-400 mr-4"></i>
                      <span className="font-medium text-[#4A7C59]">
                        {editingSample ? '编辑样本' : '新建样本'}
                      </span>
                    </div>
                  </li>
                </>
              )}
            </ol>
          </nav>

          {/* 主要内容区域 */}
          {renderCurrentView()}
        </main>
      </div>
    </div>
  );
};

export default SampleManagement;