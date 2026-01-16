import React, { useState } from 'react';
import { Sample } from '@/types';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import SampleList from '@/components/SampleList';
import SampleDetail from '@/components/SampleDetail';
import SampleForm from '@/components/SampleForm';
import { cn } from '@/lib/utils';

const SampleManagement: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState<'list' | 'detail' | 'form'>('list');
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
  const [editingSample, setEditingSample] = useState<Sample | undefined>();

  const handleSelectSample = (sample: Sample) => {
    setSelectedSample(sample);
    setCurrentView('detail');
  };

  const handleFormSubmit = () => {
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
    <div className="min-h-screen bg-organic-rice-paper text-loam">
      {/* 环境 Blob 背景 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="organic-blob organic-blob--moss w-[400px] h-[400px] -top-20 -right-20 opacity-15" />
        <div className="organic-blob organic-blob--sand w-[300px] h-[300px] bottom-10 -left-20 opacity-12" />
      </div>

      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={cn('transition-all duration-500 relative z-10', sidebarCollapsed ? 'ml-16' : 'ml-64')}>
        <Header
          title="样本管理"
          sidebarCollapsed={sidebarCollapsed}
        />

        <main className="container mx-auto px-6 py-6">
          {/* 面包屑导航 */}
          <nav className="flex mb-6" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-3">
              <li>
                <button
                  onClick={() => setCurrentView('list')}
                  className={cn(
                    'font-medium transition-colors px-3 py-1.5 rounded-full',
                    currentView === 'list'
                      ? 'text-moss bg-moss-soft'
                      : 'text-grass hover:text-moss hover:bg-moss-soft/50'
                  )}
                >
                  <i className="fa-solid fa-flask mr-2"></i>
                  样本管理
                </button>
              </li>
              {currentView === 'detail' && selectedSample && (
                <>
                  <li className="text-timber-soft">/</li>
                  <li>
                    <span className="font-medium text-loam px-3 py-1.5 bg-organic-stone rounded-full">
                      {selectedSample.name}
                    </span>
                  </li>
                </>
              )}
              {currentView === 'form' && (
                <>
                  <li className="text-timber-soft">/</li>
                  <li>
                    <span className="font-medium text-terracotta px-3 py-1.5 bg-terracotta-light rounded-full">
                      <i className={cn('fa-solid mr-2', editingSample ? 'fa-pen' : 'fa-plus')}></i>
                      {editingSample ? '编辑样本' : '新建样本'}
                    </span>
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