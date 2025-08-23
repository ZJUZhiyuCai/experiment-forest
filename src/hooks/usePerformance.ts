import { useEffect, useRef } from 'react';

interface PerformanceMetrics {
  componentName: string;
  renderTime: number;
  renderCount: number;
}

// 性能监控Hook
export function usePerformanceMonitor(componentName: string, dependencies?: any[]) {
  const renderCount = useRef(0);
  const startTime = useRef<number>();
  
  // 开始计时
  if (!startTime.current) {
    startTime.current = performance.now();
  }
  
  useEffect(() => {
    renderCount.current += 1;
    const endTime = performance.now();
    const renderTime = endTime - (startTime.current || 0);
    
    // 只在开发环境下输出性能信息
    if (import.meta.env.DEV) {
      const metrics: PerformanceMetrics = {
        componentName,
        renderTime,
        renderCount: renderCount.current
      };
      
      // 如果渲染时间超过16ms (60fps阈值)，输出警告
      if (renderTime > 16) {
        console.warn(`🐌 慢渲染警告 - ${componentName}:`, metrics);
      } else if (renderTime > 8) {
        console.info(`⚠️ 渲染性能提醒 - ${componentName}:`, metrics);
      }
      
      // 如果渲染次数过多，输出警告
      if (renderCount.current > 10 && renderCount.current % 5 === 0) {
        console.warn(`🔄 频繁重渲染警告 - ${componentName} 已渲染 ${renderCount.current} 次`);
      }
    }
    
    // 重置计时器
    startTime.current = performance.now();
  }, dependencies);
  
  return {
    renderCount: renderCount.current,
    componentName
  };
}

// 内存使用监控Hook
export function useMemoryMonitor(componentName: string) {
  useEffect(() => {
    if (import.meta.env.DEV && 'memory' in performance) {
      const memInfo = (performance as any).memory;
      const memoryUsage = {
        usedJSHeapSize: memInfo.usedJSHeapSize,
        totalJSHeapSize: memInfo.totalJSHeapSize,
        jsHeapSizeLimit: memInfo.jsHeapSizeLimit
      };
      
      // 如果内存使用超过阈值，输出警告
      const usagePercent = (memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100;
      if (usagePercent > 80) {
        console.warn(`🧠 内存使用警告 - ${componentName}:`, {
          usagePercent: `${usagePercent.toFixed(2)}%`,
          ...memoryUsage
        });
      }
    }
  });
}

// 组件大小监控Hook
export function useComponentSizeMonitor(ref: React.RefObject<HTMLElement>, componentName: string) {
  useEffect(() => {
    if (!ref.current || !import.meta.env.DEV) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        
        // 如果组件尺寸异常大，输出警告
        if (width > 2000 || height > 1500) {
          console.warn(`📏 组件尺寸警告 - ${componentName}:`, {
            width: `${width}px`,
            height: `${height}px`,
            element: entry.target
          });
        }
      }
    });
    
    resizeObserver.observe(ref.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [ref, componentName]);
}

// 综合性能监控Hook
export function usePerformanceProfiler(componentName: string, dependencies?: any[]) {
  const elementRef = useRef<HTMLDivElement>(null);
  
  const performanceData = usePerformanceMonitor(componentName, dependencies);
  useMemoryMonitor(componentName);
  useComponentSizeMonitor(elementRef, componentName);
  
  return {
    ref: elementRef,
    ...performanceData
  };
}