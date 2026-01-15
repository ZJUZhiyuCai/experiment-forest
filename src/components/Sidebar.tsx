import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { projectService } from '@/lib/cachedStorage';

interface MenuItem {
  path: string;
  icon: string;
  label: string;
  children?: {
    path: string;
    icon?: string;
    label: string;
    children?: {
      path: string;
      icon: string;
      label: string;
    }[];
  }[];
}

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // 基础导航项，设置始终可见，融合日历功能
  const [navItems, setNavItems] = useState<MenuItem[]>([
    { path: '/', icon: 'fa-home', label: '首页' },
    { path: '/forest', icon: 'fa-seedling', label: '我的森林' },
    {
      path: '/projects',
      icon: 'fa-project-diagram',
      label: '课题管理',
      children: [] // 这里将动态填充课题列表
    },
    { path: '/calendar', icon: 'fa-calendar-alt', label: '实验日历' },
    { path: '/records', icon: 'fa-flask', label: '实验记录' },
    { path: '/notes', icon: 'fa-sticky-note', label: '实验笔记' },
    { path: '/sops', icon: 'fa-file-alt', label: 'SOP文档' },
    { path: '/samples', icon: 'fa-vials', label: '样本管理' },
    { path: '/settings', icon: 'fa-cog', label: '设置' }
  ]);

  // 获取课题数据并更新导航项
  useEffect(() => {
    const updateNavItems = () => {
      try {
        const allProjects = projectService.getAll();

        // 更新课题管理的子项，包含AI助手、思维导图和所有课题
        setNavItems(prev => prev.map(item => {
          if (item.path === '/projects') {
            const projectChildren = allProjects.map(project => ({
              path: `/projects/${project.id}`,
              icon: 'fa-folder',
              label: project.title,
              children: [
                {
                  path: `/chat`,
                  icon: 'fa-robot',
                  label: '小森博士'
                },
                {
                  path: `/topics/${project.id}/mindmap`,
                  icon: 'fa-sitemap',
                  label: '思维导图'
                },
                {
                  path: `/projects/${project.id}/records`,
                  icon: 'fa-flask',
                  label: '实验记录'
                },
                {
                  path: `/projects/${project.id}/notes`,
                  icon: 'fa-sticky-note',
                  label: '实验笔记'
                },
                {
                  path: `/projects/${project.id}/sops`,
                  icon: 'fa-file-alt',
                  label: 'SOP文档'
                }
              ]
            }));

            return {
              ...item,
              children: projectChildren
            };
          }
          return item;
        }));
      } catch (error) {
        console.error('获取课题数据失败:', error);
      }
    };

    // 只在初始加载时更新一次
    updateNavItems();
  }, []);

  // 根据当前路径自动展开相关菜单
  useEffect(() => {
    const currentPath = location.pathname;
    const newExpandedItems = [...expandedItems];

    // 如果在课题相关页面，自动展开课题管理菜单
    if (currentPath.startsWith('/projects')) {
      if (!newExpandedItems.includes('/projects')) {
        newExpandedItems.push('/projects');
      }

      // 如果在具体课题的子页面，也展开对应的课题
      const projectMatch = currentPath.match(/^\/projects\/([^/]+)/);
      if (projectMatch) {
        const projectPath = `/projects/${projectMatch[1]}`;
        if (!newExpandedItems.includes(projectPath)) {
          newExpandedItems.push(projectPath);
        }
      }
    }

    setExpandedItems(newExpandedItems);
  }, [location.pathname]);

  // 切换子菜单展开/折叠状态
  const toggleSubMenu = (path: string) => {
    setExpandedItems(prev =>
      prev.includes(path)
        ? prev.filter(item => item !== path)
        : [...prev, path]
    );
  };

  // 检查是否为当前路径或子路径
  const isActivePath = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };


  return (
    <motion.div
      className={cn(
        'fixed h-full bg-white border-r border-forest-accent/30 z-30 transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-16' : 'w-64',
        'shadow-nature rounded-r-2xl'
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-forest-light">
        <div className={cn('flex items-center', !isCollapsed && 'space-x-2')}>
          <i className="fa-solid fa-seedling text-forest-secondary text-xl"></i>
          {!isCollapsed && (
            <div>
              <h1 className="text-xl font-header font-bold text-forest-primary">实验小森林</h1>
              <p className="text-[10px] text-forest-secondary/70 tracking-wider">记录每一次科学的萌芽</p>
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-full hover:bg-forest-light text-forest-secondary transition-colors"
        >
          <i className={`fa-solid ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
        </button>
      </div>

      <nav className="mt-6 px-2">
        <ul className="space-y-1.5">
          {navItems.map((item) => (
            <li key={item.path} className="mb-1">
              {/* 主菜单项 */}
              <NavLink
                to={item.path}
                className={cn(
                  'flex items-center px-4 py-3 rounded-xl transition-all duration-300 cursor-pointer w-full group',
                  isActivePath(item.path)
                    ? 'bg-forest-secondary text-white shadow-md'
                    : 'text-text-soft hover:bg-forest-light hover:text-forest-primary'
                )}
                onClick={() => {
                  if (item.children && item.children.length > 0) {
                    // 展开/折叠子菜单，但不阻止导航
                    toggleSubMenu(item.path);
                  }
                }}
              >
                <i className={`fa-solid ${item.icon} ${!isCollapsed && 'mr-3'}`}></i>
                {!isCollapsed && <span>{item.label}</span>}
                {item.children && item.children.length > 0 && !isCollapsed && (
                  <i className={`fa-solid ml-auto ${expandedItems.includes(item.path) ? 'fa-chevron-down' : 'fa-chevron-right'}`}></i>
                )}
              </NavLink>

              {/* 子菜单项 */}
              {item.children && item.children.length > 0 && expandedItems.includes(item.path) && !isCollapsed && (
                <ul className="pl-10 mt-1 space-y-1">
                  {item.children.map((child) => (
                    <li key={child.path}>
                      {child.children ? (
                        // 如果子项还有子菜单，渲染为可展开项
                        <div>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              toggleSubMenu(child.path);
                            }}
                            className={cn(
                              'flex items-center px-3 py-2 rounded-lg text-sm transition-all duration-200 w-full text-left',
                              expandedItems.includes(child.path)
                                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium'
                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                            )}
                          >
                            <i className={`fa-solid ${child.icon || 'fa-folder'} mr-3`}></i>
                            <span>{child.label}</span>
                            <i className={`fa-solid ml-auto ${expandedItems.includes(child.path) ? 'fa-chevron-down' : 'fa-chevron-right'}`}></i>
                          </button>

                          {/* 课题的子菜单 */}
                          {expandedItems.includes(child.path) && (
                            <ul className="pl-10 mt-1 space-y-1">
                              {child.children.map((subChild) => (
                                <li key={subChild.path}>
                                  <NavLink
                                    to={subChild.path}
                                    className={({ isActive }) =>
                                      cn(
                                        'flex items-center px-3 py-2 rounded-lg text-sm transition-all duration-200',
                                        isActive
                                          ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium'
                                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                      )
                                    }
                                  >
                                    <i className={`fa-solid ${subChild.icon} mr-3`}></i>
                                    <span>{subChild.label}</span>
                                  </NavLink>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : (
                        // 普通子项
                        <NavLink
                          to={child.path}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center px-3 py-2 rounded-lg text-sm transition-all duration-200',
                              isActive
                                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium'
                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                            )
                          }
                        >
                          <i className={`fa-solid ${child.icon} mr-3`}></i>
                          <span>{child.label}</span>
                        </NavLink>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className={cn('absolute bottom-0 w-full p-4 border-t border-gray-200 dark:border-gray-700', isCollapsed ? 'flex justify-center' : 'block')}>
        {!isCollapsed ? (
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <i className="fa-solid fa-user text-blue-600 dark:text-blue-400"></i>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-white">实验员</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">个人账号</p>
            </div>
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
            <i className="fa-solid fa-user text-blue-600 dark:text-blue-400"></i>
          </div>
        )}
      </div>
    </motion.div>
  );
}