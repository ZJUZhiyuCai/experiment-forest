import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeaderProps {
  title: string;
  breadcrumb?: BreadcrumbItem[];
  sidebarCollapsed?: boolean;
  actions?: React.ReactNode;
}

/**
 * 🌿 有机头部组件 (Organic Header)
 * 浮动药丸导航 + 毛玻璃效果
 */
export function Header({ title, sidebarCollapsed, breadcrumb, actions }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={cn(
      'sticky top-0 z-20 transition-all duration-500',
      scrolled
        ? 'py-3'
        : 'py-6'
    )}>
      <div className={cn(
        'mx-4 transition-all duration-500',
        scrolled && 'bg-organic-card/80 backdrop-blur-md rounded-full border border-timber-soft shadow-moss px-6 py-2'
      )}>
        <div className="flex flex-col space-y-1">
          {/* 面包屑导航 - 柔和有机风格 */}
          {breadcrumb && breadcrumb.length > 0 && !scrolled && (
            <nav className="flex items-center space-x-2 text-xs text-grass">
              {breadcrumb.map((item, index) => (
                <div key={index} className="flex items-center space-x-2">
                  {index > 0 && <span className="text-timber">/</span>}
                  {item.href ? (
                    <Link
                      to={item.href}
                      className="hover:text-moss transition-colors duration-300"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-bark font-medium">{item.label}</span>
                  )}
                </div>
              ))}
            </nav>
          )}

          <div className="flex items-center justify-between">
            {/* 标题 - Fraunces 衬线字体 */}
            <h1 className={cn(
              'font-heading font-bold tracking-tight text-loam transition-all duration-300',
              scrolled ? 'text-xl' : 'text-3xl'
            )}>
              {title}
            </h1>

            <div className="flex items-center space-x-3">
              {/* 有机搜索框 */}
              <div className={cn(
                'relative group hidden md:block',
                scrolled && 'hidden lg:block'
              )}>
                <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-xs text-grass group-focus-within:text-moss transition-colors"></i>
                <input
                  type="text"
                  placeholder="搜索..."
                  className={cn(
                    'bg-organic-stone/50 border border-timber-soft',
                    'rounded-full pl-10 pr-4 py-2 text-sm',
                    'placeholder:text-grass text-bark',
                    'outline-none transition-all duration-300',
                    'w-40 focus:w-56 focus:border-moss focus:bg-organic-card',
                    'focus:shadow-[0_0_0_3px_rgba(93,112,82,0.1)]'
                  )}
                />
              </div>

              {actions && <div className="flex items-center space-x-2">{actions}</div>}

              {/* 主题切换按钮 - 有机圆形 */}
              <button
                onClick={toggleTheme}
                className={cn(
                  'w-10 h-10 rounded-full',
                  'bg-organic-stone/50 border border-timber-soft',
                  'flex items-center justify-center text-sm text-grass',
                  'hover:bg-moss hover:text-moss-light hover:border-moss hover:shadow-moss',
                  'transition-all duration-300'
                )}
              >
                <i className={cn('fa-solid', isDark ? 'fa-sun' : 'fa-moon')}></i>
              </button>

              {/* 通知按钮 */}
              <button className={cn(
                'w-10 h-10 rounded-full',
                'bg-organic-stone/50 border border-timber-soft',
                'flex items-center justify-center text-sm text-grass',
                'hover:bg-terracotta hover:text-white hover:border-terracotta hover:shadow-clay',
                'transition-all duration-300'
              )}>
                <i className="fa-solid fa-bell"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}