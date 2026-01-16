import { useState } from 'react';
import { ChatSession } from '@/types';
import { Sidebar } from '@/components/Sidebar';
import { AIChatComponent } from '@/components/AIChatComponent';
import { cn } from '@/lib/utils';

export default function AIChat() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [_currentSession, setCurrentSession] = useState<ChatSession | null>(null);

  const handleSessionChange = (session: ChatSession) => {
    setCurrentSession(session);
  };

  return (
    <div className="min-h-screen bg-organic-rice-paper">
      {/* 环境 Blob 背景 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="organic-blob organic-blob--moss w-[500px] h-[500px] -top-32 -right-32 opacity-15" />
        <div className="organic-blob organic-blob--terracotta w-[400px] h-[400px] bottom-0 -left-20 opacity-10" />
      </div>

      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={cn('transition-all duration-500 relative z-10', sidebarCollapsed ? 'ml-16' : 'ml-64')}>
        <main className="h-screen p-6">
          <div className="h-full max-w-5xl mx-auto">
            <div className="organic-card h-full overflow-hidden rounded-[2rem_1rem_2.5rem_1.5rem]">
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
