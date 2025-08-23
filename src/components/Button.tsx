import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';
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
     secondary: 'bg-white/80 backdrop-blur-sm text-[#555555] hover:bg-white border border-white/30 focus:ring-emerald-400 dark:bg-white/80 dark:text-[#555555] dark:hover:bg-white transition-all duration-300',
     outline: 'border border-white/50 bg-white/30 backdrop-blur-sm text-[#555555] hover:bg-white/50 focus:ring-emerald-400 dark:border-white/50 dark:bg-white/30 dark:text-[#555555] dark:hover:bg-white/50 transition-all duration-300',
     danger: 'bg-gradient-to-r from-pink-400 to-rose-500 text-white hover:from-pink-500 hover:to-rose-600 focus:ring-pink-400 dark:focus:ring-pink-400 transition-all duration-300 shadow-md hover:shadow-lg active:scale-95'
   };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };
  
   if (props.asChild && children) {
    const child = React.Children.only(children);
    return React.cloneElement(child, {
      className: cn(
        child.props.className,
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
