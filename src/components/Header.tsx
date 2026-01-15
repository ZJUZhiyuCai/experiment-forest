import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { GlobalSearch } from './GlobalSearch';
import { Link } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeaderProps {
  title: string;
  sidebarCollapsed: boolean;
  actions?: React.ReactNode;
  breadcrumb?: BreadcrumbItem[];
}

export function Header({ title, sidebarCollapsed, actions, breadcrumb }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);

  // 全局快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K 或 Cmd+K 打开全局搜索
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowGlobalSearch(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="bg-white/70 backdrop-blur-xl border-b border-forest-accent/20 sticky top-0 z-20 shadow-nature transition-all duration-300">
      <div className={cn('container mx-auto px-4 py-3', sidebarCollapsed ? 'ml-16' : 'ml-64')}>
        {/* 面包屑导航 */}
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="mb-2">
            <nav className="flex items-center space-x-2 text-sm text-gray-600">
              {breadcrumb.map((item, index) => (
                <div key={index} className="flex items-center space-x-2">
                  {index > 0 && <i className="fa-solid fa-chevron-right text-xs"></i>}
                  {item.href ? (
                    <Link to={item.href} className="hover:text-forest-primary transition-colors">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-forest-secondary font-bold">{item.label}</span>
                  )}
                </div>
              ))}
            </nav>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-2xl font-header font-bold text-forest-primary">{title}</h1>
          </div>

          <div className="flex items-center space-x-4">
            {/* 全局搜索按钮 */}
            <button
              onClick={() => setShowGlobalSearch(true)}
              className="relative hidden md:flex items-center space-x-2 px-4 py-2 rounded-xl border border-forest-accent/50 bg-forest-light/50 text-text-soft hover:bg-forest-light hover:text-forest-primary transition-all group shadow-sm"
            >
              <i className="fa-solid fa-search"></i>
              <span className="text-sm font-medium">搜索实验数据...</span>
              <div className="flex items-center space-x-1 ml-2 opacity-50">
                <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-forest-accent/30 rounded shadow-sm font-sans">
                  ⌘
                </kbd>
                <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-forest-accent/30 rounded shadow-sm font-sans">
                  K
                </kbd>
              </div>
            </button>

            {/* 移动端搜索按钮 */}
            <button
              onClick={() => setShowGlobalSearch(true)}
              className="md:hidden p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="搜索"
            >
              <i className="fa-solid fa-search text-gray-600 dark:text-gray-300"></i>
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
            >
              {theme === 'light' ? (
                <i className="fa-solid fa-moon text-gray-600 dark:text-gray-300"></i>
              ) : (
                <i className="fa-solid fa-sun text-yellow-400"></i>
              )}
            </button>

            {actions}
          </div>
        </div>
      </div>

      {/* 全局搜索模态框 */}
      <GlobalSearch
        isOpen={showGlobalSearch}
        onClose={() => setShowGlobalSearch(false)}
      />
    </header>
  );
}