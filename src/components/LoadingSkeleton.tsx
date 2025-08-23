import React from 'react';

interface LoadingSkeletonProps {
  type?: 'card' | 'list' | 'table';
  count?: number;
}

export function LoadingSkeleton({ type = 'card', count = 3 }: LoadingSkeletonProps) {
  const skeletons = Array.from({ length: count }, (_, i) => i);

  if (type === 'card') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {skeletons.map((_, index) => (
          <div key={index} className="bg-white rounded-xl shadow-md border border-gray-200 p-6 animate-pulse">
            {/* 标题骨架 */}
            <div className="h-6 bg-gray-200 rounded mb-4"></div>
            
            {/* 日期骨架 */}
            <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
            
            {/* 状态标签骨架 */}
            <div className="h-6 bg-gray-200 rounded w-16 mb-4"></div>
            
            {/* 内容骨架 */}
            <div className="space-y-2 mb-4">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
            
            {/* 标签骨架 */}
            <div className="flex space-x-2 mb-4">
              <div className="h-6 bg-gray-200 rounded w-16"></div>
              <div className="h-6 bg-gray-200 rounded w-20"></div>
              <div className="h-6 bg-gray-200 rounded w-14"></div>
            </div>
            
            {/* 操作按钮骨架 */}
            <div className="flex justify-between items-center">
              <div className="h-4 bg-gray-200 rounded w-20"></div>
              <div className="flex space-x-2">
                <div className="h-8 w-8 bg-gray-200 rounded"></div>
                <div className="h-8 w-8 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="space-y-4">
        {skeletons.map((_, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
              <div className="h-8 w-20 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
        {skeletons.map((_, index) => (
          <div key={index} className="p-4 border-b border-gray-200 last:border-b-0 animate-pulse">
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}