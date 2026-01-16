import { cn } from '@/lib/utils';
import React, { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  children?: ReactNode;
  fullWidth?: boolean;
  asChild?: boolean;
}

/**
 * 🌿 有机按钮组件 (Organic Button)
 * 药丸形状 + 带色调阴影 + 自然缩放动效
 */
export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  fullWidth = false,
  className,
  ...props
}: ButtonProps) {
  // 基础样式：药丸形状 + 自然过渡
  const baseClasses = cn(
    'inline-flex items-center justify-center font-semibold',
    'rounded-full transition-all duration-300 ease-natural',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'active:scale-95'
  );

  // 变体样式：有机自然风格
  const variantClasses = {
    primary: cn(
      'bg-moss text-moss-light',
      'shadow-moss hover:shadow-moss-lg',
      'hover:scale-105',
      'focus-visible:ring-moss/30'
    ),
    secondary: cn(
      'bg-terracotta text-white',
      'shadow-clay hover:shadow-clay-lg',
      'hover:scale-105',
      'focus-visible:ring-terracotta/30'
    ),
    outline: cn(
      'bg-transparent border-2 border-terracotta text-terracotta',
      'hover:bg-terracotta-light hover:scale-[1.02]',
      'focus-visible:ring-terracotta/30'
    ),
    ghost: cn(
      'bg-transparent text-moss',
      'hover:bg-moss-soft',
      'focus-visible:ring-moss/20'
    ),
    danger: cn(
      'bg-status-error text-white',
      'shadow-[0_4px_20px_-2px_rgba(168,84,72,0.25)]',
      'hover:shadow-[0_8px_30px_-4px_rgba(168,84,72,0.35)] hover:scale-105',
      'focus-visible:ring-status-error/30'
    ),
  };

  // 尺寸样式
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm h-10',
    md: 'px-6 py-2.5 text-base h-12',
    lg: 'px-8 py-3 text-lg h-14',
  };

  // asChild 模式：将样式传递给子元素
  if (props.asChild && children && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ...children.props,
      className: cn(
        children.props.className,
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        icon && children ? 'gap-2' : '',
        className
      ),
      ...props
    });
  }

  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        icon && children ? 'gap-2' : '',
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
