import React, { useState } from 'react';
import { ChatSession } from '@/types';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { AIChatComponent } from '@/components/AIChatComponent';

export default function AIChat() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);

  const handleSessionChange = (session: ChatSession) => {
    setCurrentSession(session);
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #F2EDE2 0%, #A6B7A1 50%, #88A588 100%)' }}>
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header 
          title="🌲 小森博士 - AI智能助手" 
          sidebarCollapsed={sidebarCollapsed}
        />
        
        <main className="h-[calc(100vh-64px)] p-6">
          <div className="h-full max-w-5xl mx-auto">
            <div 
              className="rounded-2xl shadow-lg h-full overflow-hidden backdrop-blur-sm border border-white/20"
              style={{ 
                background: 'linear-gradient(135deg, rgba(242, 237, 226, 0.95) 0%, rgba(166, 183, 161, 0.85) 50%, rgba(136, 165, 136, 0.75) 100%)'
              }}
            >
              <AIChatComponent
                onSessionChange={handleSessionChange}
                className="h-full"
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}