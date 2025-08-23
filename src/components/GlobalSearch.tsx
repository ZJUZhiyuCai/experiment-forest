import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { experimentRecordService, experimentNoteService, sopService, projectService } from '@/lib/cachedStorage';
import { ExperimentRecord, ExperimentNote, SOP, Project } from '@/types';

interface SearchResult {
  id: string;
  type: 'record' | 'note' | 'sop' | 'project';
  title: string;
  content: string;
  link: string;
  date?: string;
  tags?: string[];
  matchedText?: string;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // 当组件打开时聚焦搜索框
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } else {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedIndex(-1);
    }
  }, [isOpen]);

  // 执行搜索
  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const results: SearchResult[] = [];
    const searchTerm = query.toLowerCase().trim();

    try {
      // 搜索实验记录
      const records = experimentRecordService.getAll();
      records.forEach((record: ExperimentRecord) => {
        const titleMatch = record.title.toLowerCase().includes(searchTerm);
        const contentMatch = record.content.toLowerCase().includes(searchTerm);
        const tagsMatch = record.tags.some(tag => tag.toLowerCase().includes(searchTerm));
        
        if (titleMatch || contentMatch || tagsMatch) {
          // 提取匹配的文本片段
          let matchedText = '';
          if (contentMatch) {
            const contentLower = record.content.toLowerCase();
            const index = contentLower.indexOf(searchTerm);
            const start = Math.max(0, index - 50);
            const end = Math.min(record.content.length, index + searchTerm.length + 50);
            matchedText = record.content.substring(start, end);
            if (start > 0) matchedText = '...' + matchedText;
            if (end < record.content.length) matchedText = matchedText + '...';
          }

          results.push({
            id: record.id,
            type: 'record',
            title: record.title,
            content: record.content.substring(0, 100),
            link: `/records/${record.id}`,
            date: record.date,
            tags: record.tags,
            matchedText
          });
        }
      });

      // 搜索实验笔记
      const notes = experimentNoteService.getAll();
      notes.forEach((note: ExperimentNote) => {
        const titleMatch = note.title.toLowerCase().includes(searchTerm);
        const contentMatch = note.content.toLowerCase().includes(searchTerm);
        
        if (titleMatch || contentMatch) {
          let matchedText = '';
          if (contentMatch) {
            const contentLower = note.content.toLowerCase();
            const index = contentLower.indexOf(searchTerm);
            const start = Math.max(0, index - 50);
            const end = Math.min(note.content.length, index + searchTerm.length + 50);
            matchedText = note.content.substring(start, end);
            if (start > 0) matchedText = '...' + matchedText;
            if (end < note.content.length) matchedText = matchedText + '...';
          }

          results.push({
            id: note.id,
            type: 'note',
            title: note.title,
            content: note.content.substring(0, 100),
            link: `/notes/${note.id}`,
            date: note.createdAt.toISOString().split('T')[0],
            matchedText
          });
        }
      });

      // 搜索SOP文档
      const sops = sopService.getAll();
      sops.forEach((sop: SOP) => {
        const titleMatch = sop.title.toLowerCase().includes(searchTerm);
        const contentMatch = sop.content.toLowerCase().includes(searchTerm);
        
        if (titleMatch || contentMatch) {
          let matchedText = '';
          if (contentMatch) {
            const contentLower = sop.content.toLowerCase();
            const index = contentLower.indexOf(searchTerm);
            const start = Math.max(0, index - 50);
            const end = Math.min(sop.content.length, index + searchTerm.length + 50);
            matchedText = sop.content.substring(start, end);
            if (start > 0) matchedText = '...' + matchedText;
            if (end < sop.content.length) matchedText = matchedText + '...';
          }

          results.push({
            id: sop.id,
            type: 'sop',
            title: sop.title,
            content: sop.content.substring(0, 100),
            link: `/sops/${sop.id}`,
            date: sop.lastUpdated.toISOString().split('T')[0],
            matchedText
          });
        }
      });

      // 搜索课题
      const projects = projectService.getAll();
      projects.forEach((project: Project) => {
        const titleMatch = project.title.toLowerCase().includes(searchTerm);
        const descMatch = project.description.toLowerCase().includes(searchTerm);
        const tagsMatch = project.tags.some(tag => tag.toLowerCase().includes(searchTerm));
        
        if (titleMatch || descMatch || tagsMatch) {
          let matchedText = '';
          if (descMatch) {
            const descLower = project.description.toLowerCase();
            const index = descLower.indexOf(searchTerm);
            const start = Math.max(0, index - 50);
            const end = Math.min(project.description.length, index + searchTerm.length + 50);
            matchedText = project.description.substring(start, end);
            if (start > 0) matchedText = '...' + matchedText;
            if (end < project.description.length) matchedText = matchedText + '...';
          }

          results.push({
            id: project.id,
            type: 'project',
            title: project.title,
            content: project.description.substring(0, 100),
            link: `/projects/${project.id}`,
            date: project.createdAt.toISOString().split('T')[0],
            tags: project.tags,
            matchedText
          });
        }
      });

      // 按相关性排序（标题匹配优先）
      results.sort((a, b) => {
        const aTitle = a.title.toLowerCase().includes(searchTerm);
        const bTitle = b.title.toLowerCase().includes(searchTerm);
        if (aTitle && !bTitle) return -1;
        if (!aTitle && bTitle) return 1;
        return 0;
      });

      setSearchResults(results.slice(0, 20)); // 限制结果数量
      setSelectedIndex(-1);
    } catch (error) {
      console.error('搜索失败:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 防抖搜索的引用
  const debounceTimeoutRef = useRef<number | null>(null);

  // 处理搜索输入
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // 清除之前的定时器
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // 防抖搜索
    debounceTimeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // 处理键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(searchResults.length - 1, prev + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(-1, prev - 1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      const result = searchResults[selectedIndex];
      if (result) {
        window.location.href = result.link;
        onClose();
      }
    }
  };

  // 获取类型图标和颜色
  const getTypeInfo = (type: SearchResult['type']) => {
    switch (type) {
      case 'record':
        return { icon: 'fa-flask', color: 'text-emerald-600', bg: 'bg-emerald-100', label: '实验记录' };
      case 'note':
        return { icon: 'fa-sticky-note', color: 'text-emerald-600', bg: 'bg-emerald-100', label: '实验笔记' };
      case 'sop':
        return { icon: 'fa-file-alt', color: 'text-emerald-600', bg: 'bg-emerald-100', label: 'SOP文档' };
      case 'project':
        return { icon: 'fa-project-diagram', color: 'text-emerald-600', bg: 'bg-emerald-100', label: '课题' };
      default:
        return { icon: 'fa-file', color: 'text-gray-600', bg: 'bg-gray-100', label: '文档' };
    }
  };

  // 高亮搜索词
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 text-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-20 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
        {/* 搜索输入框 */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <i className="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              placeholder="搜索实验记录、笔记、SOP文档..."
              className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <button
              onClick={onClose}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <i className="fa-solid fa-times"></i>
            </button>
          </div>
          
          {/* 搜索提示 */}
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="mr-4">↑↓ 导航</span>
            <span className="mr-4">Enter 打开</span>
            <span>Esc 关闭</span>
          </div>
        </div>

        {/* 搜索结果 */}
        <div ref={resultsRef} className="max-h-96 overflow-y-auto">
          {isSearching ? (
            <div className="p-8 text-center">
              <i className="fa-solid fa-spinner fa-spin text-2xl text-gray-400 mb-2"></i>
              <p className="text-gray-500 dark:text-gray-400">搜索中...</p>
            </div>
          ) : searchQuery && searchResults.length === 0 ? (
            <div className="p-8 text-center">
              <i className="fa-solid fa-search text-2xl text-gray-400 mb-2"></i>
              <p className="text-gray-500 dark:text-gray-400 mb-1">未找到相关结果</p>
              <p className="text-sm text-gray-400">尝试使用不同的关键词</p>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {searchResults.map((result, index) => {
                const typeInfo = getTypeInfo(result.type);
                return (
                  <Link
                    key={`${result.type}-${result.id}`}
                    to={result.link}
                    onClick={onClose}
                    className={`block p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      selectedIndex === index ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full ${typeInfo.bg} flex items-center justify-center`}>
                        <i className={`fa-solid ${typeInfo.icon} ${typeInfo.color} text-sm`}></i>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`text-xs px-2 py-1 rounded-full ${typeInfo.bg} ${typeInfo.color} font-medium`}>
                            {typeInfo.label}
                          </span>
                          {result.date && (
                            <span className="text-xs text-gray-500">
                              {result.date}
                            </span>
                          )}
                        </div>
                        
                        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                          {highlightText(result.title, searchQuery)}
                        </h3>
                        
                        {result.matchedText && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            {highlightText(result.matchedText, searchQuery)}
                          </p>
                        )}
                        
                        {result.tags && result.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {result.tags.slice(0, 3).map((tag, tagIndex) => (
                              <span
                                key={tagIndex}
                                className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded"
                              >
                                {highlightText(tag, searchQuery)}
                              </span>
                            ))}
                            {result.tags.length > 3 && (
                              <span className="text-xs text-gray-500">
                                +{result.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center">
              <i className="fa-solid fa-search text-2xl text-gray-400 mb-2"></i>
              <p className="text-gray-500 dark:text-gray-400 mb-1">开始搜索</p>
              <p className="text-sm text-gray-400">输入关键词搜索实验数据</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}