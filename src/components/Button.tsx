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

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  fullWidth = false,
  className,
  ...props
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variantClasses = {
    primary: 'bg-gradient-to-r from-emerald-400 to-teal-500 text-white hover:from-emerald-500 hover:to-teal-600 focus:ring-emerald-400 dark:focus:ring-emerald-400 transition-all duration-300 shadow-md hover:shadow-lg active:scale-95',
    secondary: 'bg-white/80 backdrop-blur-sm text-text-main hover:bg-white border border-white/30 focus:ring-emerald-400 dark:bg-white/80 dark:text-text-main dark:hover:bg-white transition-all duration-300',
    outline: 'border border-gray-200 bg-transparent text-text-main hover:bg-gray-50 focus:ring-forest-secondary dark:border-gray-700 dark:text-text-main dark:hover:bg-gray-800 transition-all duration-300',
    ghost: 'bg-transparent text-text-muted hover:text-forest-primary hover:bg-forest-primary/5 focus:ring-forest-secondary transition-colors duration-200',
    danger: 'bg-gradient-to-r from-pink-400 to-rose-500 text-white hover:from-pink-500 hover:to-rose-600 focus:ring-pink-400 dark:focus:ring-pink-400 transition-all duration-300 shadow-md hover:shadow-lg active:scale-95'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  if (props.asChild && children && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ...children.props,
      className: cn(
        children.props.className,
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        icon && children ? 'space-x-2' : '',
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
        icon && children ? 'space-x-2' : '',
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
