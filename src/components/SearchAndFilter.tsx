import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SearchAndFilterProps {
  onSearch?: (query: string) => void;
  onFilter?: (filters: Record<string, any>) => void;
  onSort?: (sortBy: string, order: 'asc' | 'desc') => void;
  searchPlaceholder?: string;
  filterOptions?: FilterOption[];
  sortOptions?: SortOption[];
  className?: string;
  children?: ReactNode;
}

interface FilterOption {
  key: string;
  label: string;
  type: 'select' | 'multiselect' | 'daterange' | 'toggle';
  options?: { value: string; label: string }[];
  icon?: string;
}

interface SortOption {
  value: string;
  label: string;
  icon?: string;
}

export const SearchAndFilter: React.FC<SearchAndFilterProps> = ({
  onSearch,
  onFilter,
  onSort,
  searchPlaceholder = '搜索...',
  filterOptions = [],
  sortOptions = [],
  className,
  children
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  // 搜索防抖
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      onSearch?.(searchQuery);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, onSearch]);

  // 计算活跃筛选器数量
  useEffect(() => {
    const count = Object.values(filters).filter(value => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== '' && value !== null;
    }).length;
    setActiveFiltersCount(count);
  }, [filters]);

  // 处理筛选器变化
  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilter?.(newFilters);
  };

  // 处理排序变化
  const handleSortChange = (newSortBy: string) => {
    let newOrder: 'asc' | 'desc' = 'desc';
    
    if (sortBy === newSortBy) {
      newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    }
    
    setSortBy(newSortBy);
    setSortOrder(newOrder);
    onSort?.(newSortBy, newOrder);
  };

  // 清除所有筛选器
  const clearAllFilters = () => {
    setFilters({});
    setSearchQuery('');
    onFilter?.({});
    onSearch?.('');
  };

  return (
    <motion.div
      className={cn('bg-white rounded-xl shadow-sm border border-gray-200 p-6', className)}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* 搜索栏 */}
      <div className="relative mb-6">
        <motion.div
          className="relative"
          whileFocus={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <motion.i 
              className="fa-solid fa-search text-gray-400"
              animate={{ 
                scale: searchQuery ? 1.2 : 1,
                color: searchQuery ? '#059669' : '#9ca3af'
              }}
              transition={{ duration: 0.2 }}
            />
          </div>
          
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg
                     focus:border-emerald-500 focus:outline-none transition-all duration-300
                     bg-gray-50 focus:bg-white hover:border-emerald-300"
          />
          
          {/* 清除搜索按钮 */}
          <AnimatePresence>
            {searchQuery && (
              <motion.button
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 
                         hover:text-gray-600"
                onClick={() => setSearchQuery('')}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <i className="fa-solid fa-times"></i>
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* 筛选和排序控制栏 */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center space-x-4">
          {/* 筛选器按钮 */}
          {filterOptions.length > 0 && (
            <motion.button
              className={cn(
                'flex items-center space-x-2 px-4 py-2 rounded-lg border-2 transition-all duration-300',
                isFilterOpen 
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-300'
              )}
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <i className="fa-solid fa-filter"></i>
              <span>筛选</span>
              {activeFiltersCount > 0 && (
                <motion.span
                  className="bg-emerald-500 text-white text-xs rounded-full px-2 py-1"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500 }}
                >
                  {activeFiltersCount}
                </motion.span>
              )}
            </motion.button>
          )}

          {/* 清除筛选器按钮 */}
          <AnimatePresence>
            {activeFiltersCount > 0 && (
              <motion.button
                className="flex items-center space-x-2 px-3 py-2 text-gray-500 
                         hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-300"
                onClick={clearAllFilters}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                whileHover={{ scale: 1.05 }}
              >
                <i className="fa-solid fa-times"></i>
                <span>清除筛选</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* 排序选项 */}
        {sortOptions.length > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">排序:</span>
            <div className="flex space-x-1">
              {sortOptions.map((option) => (
                <motion.button
                  key={option.value}
                  className={cn(
                    'flex items-center space-x-1 px-3 py-2 rounded-lg text-sm transition-all duration-300',
                    sortBy === option.value
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                  onClick={() => handleSortChange(option.value)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {option.icon && <i className={`fa-solid ${option.icon}`}></i>}
                  <span>{option.label}</span>
                  {sortBy === option.value && (
                    <motion.i
                      className={`fa-solid fa-chevron-${sortOrder === 'asc' ? 'up' : 'down'}`}
                      animate={{ rotate: sortOrder === 'asc' ? 0 : 180 }}
                      transition={{ duration: 0.2 }}
                    />
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 筛选器面板 */}
      <AnimatePresence>
        {isFilterOpen && (
          <motion.div
            className="border-t border-gray-200 pt-4 mb-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterOptions.map((filter) => (
                <FilterControl
                  key={filter.key}
                  filter={filter}
                  value={filters[filter.key]}
                  onChange={(value) => handleFilterChange(filter.key, value)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 自定义内容 */}
      {children && (
        <div className="border-t border-gray-200 pt-4">
          {children}
        </div>
      )}
    </motion.div>
  );
};

// 筛选器控制组件
interface FilterControlProps {
  filter: FilterOption;
  value: any;
  onChange: (value: any) => void;
}

const FilterControl: React.FC<FilterControlProps> = ({ filter, value, onChange }) => {
  const renderControl = () => {
    switch (filter.type) {
      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg
                     focus:border-emerald-500 focus:outline-none transition-colors duration-300"
          >
            <option value="">请选择</option>
            {filter.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'toggle':
        return (
          <motion.button
            className={cn(
              'w-full px-3 py-2 rounded-lg border-2 transition-all duration-300',
              value
                ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                : 'bg-white border-gray-300 text-gray-600 hover:border-emerald-300'
            )}
            onClick={() => onChange(!value)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center justify-center space-x-2">
              <motion.i
                className={`fa-solid ${value ? 'fa-toggle-on' : 'fa-toggle-off'}`}
                animate={{ scale: value ? 1.2 : 1 }}
                transition={{ duration: 0.2 }}
              />
              <span>{value ? '开启' : '关闭'}</span>
            </div>
          </motion.button>
        );

      default:
        return null;
    }
  };

  return (
    <motion.div
      className="space-y-2"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
        {filter.icon && <i className={`fa-solid ${filter.icon}`}></i>}
        <span>{filter.label}</span>
      </label>
      {renderControl()}
    </motion.div>
  );
};