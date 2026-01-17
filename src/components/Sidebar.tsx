import { useState, useEffect } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { projectService } from '@/lib/cachedStorage';
import { Project } from '@/types';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

interface NavGroup {
  title?: string;
  items: NavItem[];
}

/**
 * 🌿 有机侧边栏组件 (Organic Sidebar)
 * 温暖亲切的导航体验 - 分组层级结构
 */
export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);

  useEffect(() => {
    setProjects(projectService.getAll());

    const handleProjectsUpdate = () => {
      setProjects(projectService.getAll());
    };

    window.addEventListener('projects-updated', handleProjectsUpdate);
    return () => window.removeEventListener('projects-updated', handleProjectsUpdate);
  }, []);

  // 分组导航结构
  const navGroups: NavGroup[] = [
    {
      items: [{ path: '/', icon: 'fa-chart-pie', label: '控制台' }]
    },
    {
      title: '实验研究',
      items: [
        { path: '/projects', icon: 'fa-folder-tree', label: '实验课题' },
        { path: '/records', icon: 'fa-seedling', label: '实验记录' },
        { path: '/notes', icon: 'fa-leaf', label: '实验笔记' },
        { path: '/sops', icon: 'fa-book-medical', label: 'SOP文档' },
        { path: '/samples', icon: 'fa-vial', label: '样本管理' },
      ]
    },
    {
      title: '计划管理',
      items: [{ path: '/calendar', icon: 'fa-calendar-days', label: '实验日历' }]
    },
    {
      title: '系统工具',
      items: [
        { path: '/chat', icon: 'fa-robot', label: 'AI 助手' },
        { path: '/settings', icon: 'fa-gear', label: '系统设置' },
      ]
    }
  ];

  // 渲染单个导航项
  const renderNavItem = (item: NavItem) => {
    const isActive = location.pathname === item.path ||
      (item.path !== '/' && location.pathname.startsWith(item.path));

    return (
      <NavLink
        key={item.path}
        to={item.path}
        className={cn(
          'flex items-center px-3 py-2.5 rounded-xl transition-all duration-300 group relative',
          isActive
            ? 'bg-moss-soft text-moss'
            : 'text-bark hover:text-moss hover:bg-moss-soft/50'
        )}
      >
        <div className={cn(
          'w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-300',
          isActive
            ? 'bg-moss text-moss-light shadow-moss'
            : 'bg-organic-stone/50 group-hover:bg-moss group-hover:text-moss-light group-hover:shadow-moss'
        )}>
          <i className={cn('fa-solid text-sm', item.icon)}></i>
        </div>
        {!isCollapsed && (
          <span className="ml-3 font-medium text-sm">
            {item.label}
          </span>
        )}

        {/* 活跃指示器 - 有机竖条 */}
        {isActive && (
          <div className="absolute left-0 w-1 h-5 bg-moss rounded-full" />
        )}
      </NavLink>
    );
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-30 transition-all duration-500',
        'bg-organic-card/95 backdrop-blur-sm',
        'border-r border-timber-soft shadow-moss',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* 折叠按钮 - 有机圆形 */}
      <button
        onClick={onToggle}
        className={cn(
          'absolute -right-3 top-20 z-40',
          'w-6 h-6 rounded-full',
          'bg-organic-card border border-timber',
          'flex items-center justify-center',
          'text-[10px] text-grass',
          'hover:text-moss hover:border-moss hover:scale-110',
          'shadow-moss transition-all duration-300'
        )}
      >
        <i className={cn('fa-solid', isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left')}></i>
      </button>

      <div className="flex flex-col h-full overflow-hidden">
        {/* Logo 区域 - 有机温暖风格 */}
        <div className="p-5 mb-2">
          <Link to="/" className="flex items-center group">
            <div className={cn(
              'w-10 h-10 rounded-2xl',
              'bg-moss flex items-center justify-center',
              'shadow-moss group-hover:shadow-moss-lg',
              'transition-all duration-300 group-hover:scale-105'
            )}>
              <i className="fa-solid fa-seedling text-moss-light text-lg"></i>
            </div>
            {!isCollapsed && (
              <span className="ml-3 font-heading font-bold text-xl text-loam tracking-tight">
                实验小森林
              </span>
            )}
          </Link>
        </div>

        {/* 导航区域 - 分组显示 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-1">
          {navGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="mb-2">
              {/* 分组标题 */}
              {group.title && !isCollapsed && (
                <div className="px-3 py-2 mt-4 first:mt-0">
                  <span className="text-xs font-semibold uppercase tracking-wider text-grass">
                    {group.title}
                  </span>
                </div>
              )}
              {/* 分组分割线（折叠状态） */}
              {group.title && isCollapsed && (
                <div className="h-px bg-timber-soft mx-2 my-3" />
              )}
              {/* 导航项 */}
              <div className="space-y-1">
                {group.items.map(renderNavItem)}
              </div>
            </div>
          ))}

          <div className="h-px bg-timber-soft mx-3 my-4" />

          {/* 课题列表 */}
          <div className="px-2">
            <button
              onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
              className={cn(
                'flex items-center justify-between w-full px-2 py-2 mb-2 rounded-lg',
                'text-xs font-semibold uppercase tracking-wider text-grass',
                'hover:text-moss hover:bg-moss-soft/30 transition-all duration-300'
              )}
            >
              {!isCollapsed && <span>活跃课题</span>}
              {isCollapsed && <i className="fa-solid fa-folder-open text-sm mx-auto"></i>}
              {!isCollapsed && (
                <i className={cn(
                  'fa-solid fa-chevron-down transition-transform duration-300 text-[10px]',
                  !isProjectsExpanded && '-rotate-90'
                )}></i>
              )}
            </button>
            <AnimatePresence>
              {isProjectsExpanded && !isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1 overflow-hidden"
                >
                  {projects.length > 0 ? (
                    projects.slice(0, 5).map(project => (
                      <Link
                        key={project.id}
                        to={`/projects/${project.id}`}
                        className={cn(
                          'flex items-center px-3 py-2 rounded-lg text-sm',
                          'text-bark hover:text-moss hover:bg-moss-soft/30',
                          'transition-all duration-300'
                        )}
                      >
                        <span className="w-2 h-2 rounded-full bg-terracotta mr-3"></span>
                        <span className="truncate">{project.title}</span>
                      </Link>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-grass italic">
                      暂无活跃课题
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* 底部信息 - 有机卡片风格 */}
        {!isCollapsed && (
          <div className="p-4">
            <div className={cn(
              'rounded-2xl p-4',
              'bg-organic-stone/50 border border-timber-soft'
            )}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-grass">版本</span>
                <span className="text-xs font-mono font-semibold text-moss">v2.0.0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-grass">状态</span>
                <div className="flex items-center">
                  <span className="w-2 h-2 rounded-full bg-status-success animate-pulse mr-2"></span>
                  <span className="text-xs font-medium text-loam">正常运行</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}