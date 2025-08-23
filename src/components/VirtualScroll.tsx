// 虚拟滚动组件
// 用于优化大数据量列表的渲染性能，只渲染可见区域的元素

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface VirtualScrollProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number; // 预渲染额外项目数量
  className?: string;
  onScroll?: (scrollTop: number) => void;
  getItemKey?: (item: T, index: number) => string | number;
}

export function VirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = '',
  onScroll,
  getItemKey
}: VirtualScrollProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  // 计算可见区域的起始和结束索引
  const { startIndex, endIndex, totalHeight } = useMemo(() => {
    const visibleStartIndex = Math.floor(scrollTop / itemHeight);
    const visibleEndIndex = Math.min(
      items.length - 1,
      Math.floor((scrollTop + containerHeight) / itemHeight)
    );

    return {
      startIndex: Math.max(0, visibleStartIndex - overscan),
      endIndex: Math.min(items.length - 1, visibleEndIndex + overscan),
      totalHeight: items.length * itemHeight
    };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  // 获取可见项目
  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex + 1);
  }, [items, startIndex, endIndex]);

  // 处理滚动事件
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);
  }, [onScroll]);

  // 滚动到指定项目
  const scrollToItem = useCallback((index: number, alignment: 'start' | 'center' | 'end' = 'start') => {
    if (!scrollElementRef.current) return;

    let scrollTop: number;
    const itemTop = index * itemHeight;

    switch (alignment) {
      case 'center':
        scrollTop = itemTop - (containerHeight - itemHeight) / 2;
        break;
      case 'end':
        scrollTop = itemTop - containerHeight + itemHeight;
        break;
      default:
        scrollTop = itemTop;
    }

    scrollElementRef.current.scrollTop = Math.max(0, Math.min(scrollTop, totalHeight - containerHeight));
  }, [itemHeight, containerHeight, totalHeight]);

  // 获取项目键值
  const getKey = useCallback((item: T, index: number) => {
    return getItemKey ? getItemKey(item, index) : index;
  }, [getItemKey]);

  return (
    <div
      ref={scrollElementRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${startIndex * itemHeight}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.map((item, index) => {
            const actualIndex = startIndex + index;
            return (
              <div
                key={getKey(item, actualIndex)}
                style={{ height: itemHeight }}
              >
                {renderItem(item, actualIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// 动态高度虚拟滚动组件（更复杂但支持不同高度的项目）
interface VirtualScrollDynamicProps<T> {
  items: T[];
  estimatedItemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
  onScroll?: (scrollTop: number) => void;
  getItemKey?: (item: T, index: number) => string | number;
}

export function VirtualScrollDynamic<T>({
  items,
  estimatedItemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = '',
  onScroll,
  getItemKey
}: VirtualScrollDynamicProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [itemHeights, setItemHeights] = useState<number[]>([]);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 测量项目高度
  const measureItemHeight = useCallback((index: number, height: number) => {
    setItemHeights(prev => {
      const newHeights = [...prev];
      newHeights[index] = height;
      return newHeights;
    });
  }, []);

  // 计算累积高度
  const cumulativeHeights = useMemo(() => {
    const heights = new Array(items.length + 1).fill(0);
    for (let i = 0; i < items.length; i++) {
      heights[i + 1] = heights[i] + (itemHeights[i] || estimatedItemHeight);
    }
    return heights;
  }, [items.length, itemHeights, estimatedItemHeight]);

  // 查找可见区域
  const { startIndex, endIndex } = useMemo(() => {
    let start = 0;
    let end = items.length - 1;

    // 二分查找起始索引
    for (let i = 0; i < items.length; i++) {
      if (cumulativeHeights[i + 1] > scrollTop) {
        start = Math.max(0, i - overscan);
        break;
      }
    }

    // 二分查找结束索引
    for (let i = start; i < items.length; i++) {
      if (cumulativeHeights[i] > scrollTop + containerHeight) {
        end = Math.min(items.length - 1, i + overscan);
        break;
      }
    }

    return { startIndex: start, endIndex: end };
  }, [scrollTop, containerHeight, cumulativeHeights, items.length, overscan]);

  // 可见项目
  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex + 1);
  }, [items, startIndex, endIndex]);

  // 处理滚动
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);
  }, [onScroll]);

  // 项目ref回调
  const itemRefCallback = useCallback((index: number) => {
    return (element: HTMLDivElement | null) => {
      itemRefs.current[index] = element;
      if (element) {
        const resizeObserver = new ResizeObserver(entries => {
          const entry = entries[0];
          if (entry) {
            measureItemHeight(index, entry.contentRect.height);
          }
        });
        resizeObserver.observe(element);
        
        // 初始测量
        measureItemHeight(index, element.offsetHeight);

        return () => {
          resizeObserver.disconnect();
        };
      }
    };
  }, [measureItemHeight]);

  return (
    <div
      ref={scrollElementRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: cumulativeHeights[items.length], position: 'relative' }}>
        {visibleItems.map((item, index) => {
          const actualIndex = startIndex + index;
          const key = getItemKey ? getItemKey(item, actualIndex) : actualIndex;
          
          return (
            <div
              key={key}
              ref={itemRefCallback(actualIndex)}
              style={{
                position: 'absolute',
                top: cumulativeHeights[actualIndex],
                left: 0,
                right: 0
              }}
            >
              {renderItem(item, actualIndex)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Grid虚拟滚动组件（用于网格布局）
interface VirtualGridProps<T> {
  items: T[];
  itemWidth: number;
  itemHeight: number;
  containerWidth: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  gap?: number;
  overscan?: number;
  className?: string;
  getItemKey?: (item: T, index: number) => string | number;
}

export function VirtualGrid<T>({
  items,
  itemWidth,
  itemHeight,
  containerWidth,
  containerHeight,
  renderItem,
  gap = 0,
  overscan = 5,
  className = '',
  getItemKey
}: VirtualGridProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  // 计算列数
  const columnsCount = Math.floor((containerWidth + gap) / (itemWidth + gap));
  const rowsCount = Math.ceil(items.length / columnsCount);

  // 计算可见行
  const { startRow, endRow } = useMemo(() => {
    const visibleStartRow = Math.floor(scrollTop / (itemHeight + gap));
    const visibleEndRow = Math.ceil((scrollTop + containerHeight) / (itemHeight + gap));

    return {
      startRow: Math.max(0, visibleStartRow - overscan),
      endRow: Math.min(rowsCount - 1, visibleEndRow + overscan)
    };
  }, [scrollTop, itemHeight, gap, containerHeight, rowsCount, overscan]);

  // 获取可见项目
  const visibleItems = useMemo(() => {
    const items_: Array<{ item: T; index: number; row: number; col: number }> = [];
    
    for (let row = startRow; row <= endRow; row++) {
      for (let col = 0; col < columnsCount; col++) {
        const index = row * columnsCount + col;
        if (index < items.length) {
          items_.push({ item: items[index], index, row, col });
        }
      }
    }
    
    return items_;
  }, [items, startRow, endRow, columnsCount]);

  // 处理滚动
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const totalHeight = rowsCount * (itemHeight + gap) - gap;

  return (
    <div
      ref={scrollElementRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index, row, col }) => {
          const key = getItemKey ? getItemKey(item, index) : index;
          
          return (
            <div
              key={key}
              style={{
                position: 'absolute',
                top: row * (itemHeight + gap),
                left: col * (itemWidth + gap),
                width: itemWidth,
                height: itemHeight
              }}
            >
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 虚拟滚动Hook
export function useVirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5
}: {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);

  const { startIndex, endIndex, totalHeight } = useMemo(() => {
    const visibleStartIndex = Math.floor(scrollTop / itemHeight);
    const visibleEndIndex = Math.min(
      items.length - 1,
      Math.floor((scrollTop + containerHeight) / itemHeight)
    );

    return {
      startIndex: Math.max(0, visibleStartIndex - overscan),
      endIndex: Math.min(items.length - 1, visibleEndIndex + overscan),
      totalHeight: items.length * itemHeight
    };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex + 1).map((item, index) => ({
      item,
      index: startIndex + index
    }));
  }, [items, startIndex, endIndex]);

  return {
    visibleItems,
    startIndex,
    endIndex,
    totalHeight,
    scrollTop,
    setScrollTop
  };
}