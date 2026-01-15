import React, { useState, useEffect } from 'react';
import { Sample, SampleType, SampleStatus, StorageCondition } from '@/types';
import { cachedSampleService } from '@/lib/cachedStorage';
import { toast } from 'sonner';
import SampleForm from './SampleForm';

interface SampleListProps {
  onSelectSample?: (sample: Sample) => void;
  showActions?: boolean;
}

const SampleList: React.FC<SampleListProps> = ({
  onSelectSample,
  showActions = true
}) => {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [filteredSamples, setFilteredSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SampleStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<SampleType | 'all'>('all');
  const [storageFilter, setStorageFilter] = useState<StorageCondition | 'all'>('all');
  const [selectedSamples, setSelectedSamples] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingSample, setEditingSample] = useState<Sample | undefined>();
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'type' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadSamples();
  }, []);

  useEffect(() => {
    filterSamples();
  }, [samples, searchTerm, statusFilter, typeFilter, storageFilter, sortBy, sortOrder]);

  const loadSamples = async () => {
    try {
      setLoading(true);
      const sampleList = await cachedSampleService.getAll();
      setSamples(sampleList);
    } catch (error) {
      console.error('加载样本列表失败:', error);
      toast.error('加载样本列表失败');
    } finally {
      setLoading(false);
    }
  };

  const filterSamples = () => {
    let filtered = [...samples];

    // 搜索过滤
    if (searchTerm) {
      filtered = filtered.filter(sample =>
        sample.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sample.sampleId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sample.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 状态过滤
    if (statusFilter !== 'all') {
      filtered = filtered.filter(sample => sample.status === statusFilter);
    }

    // 类型过滤
    if (typeFilter !== 'all') {
      filtered = filtered.filter(sample => sample.type === typeFilter);
    }

    // 存储条件过滤
    if (storageFilter !== 'all') {
      filtered = filtered.filter(sample => sample.storage?.condition === storageFilter);
    }

    // 排序
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredSamples(filtered);
  };

  const handleSelectSample = (sample: Sample) => {
    if (onSelectSample) {
      onSelectSample(sample);
    }
  };

  const handleEditSample = (sample: Sample) => {
    setEditingSample(sample);
    setShowForm(true);
  };

  const handleDeleteSample = async (sample: Sample) => {
    if (window.confirm(`确定要删除样本"${sample.name}"吗？`)) {
      try {
        await cachedSampleService.delete(sample.id);
        toast.success('样本删除成功');
        loadSamples();
      } catch (error) {
        console.error('删除样本失败:', error);
        toast.error('删除样本失败');
      }
    }
  };

  const handleFormSubmit = async (sampleData: Sample) => {
    try {
      if (editingSample) {
        await cachedSampleService.update(editingSample.id, sampleData);
        toast.success('样本更新成功');
      } else {
        await cachedSampleService.create(sampleData);
        toast.success('样本创建成功');
      }

      setShowForm(false);
      setEditingSample(undefined);
      loadSamples();
    } catch (error) {
      console.error('保存样本失败:', error);
      toast.error('保存样本失败');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedSamples.length === 0) {
      toast.error('请先选择要删除的样本');
      return;
    }

    if (window.confirm(`确定要删除选中的${selectedSamples.length}个样本吗？`)) {
      try {
        await Promise.all(selectedSamples.map(id => cachedSampleService.delete(id)));
        toast.success(`成功删除${selectedSamples.length}个样本`);
        setSelectedSamples([]);
        loadSamples();
      } catch (error) {
        console.error('批量删除失败:', error);
        toast.error('批量删除失败');
      }
    }
  };

  const handleSelectAll = () => {
    if (selectedSamples.length === filteredSamples.length) {
      setSelectedSamples([]);
    } else {
      setSelectedSamples(filteredSamples.map(sample => sample.id));
    }
  };

  const getStatusColor = (status: SampleStatus): string => {
    const statusColors = {
      available: 'bg-status-success/10 text-status-success',
      in_use: 'bg-status-info/10 text-status-info',
      exhausted: 'bg-status-warning/10 text-status-warning',
      expired: 'bg-status-error/10 text-status-error',
      contaminated: 'bg-status-error/10 text-status-error',
      reserved: 'bg-forest-accent/20 text-forest-primary'
    };
    return statusColors[status] || statusColors.available;
  };

  const getStatusText = (status: SampleStatus): string => {
    const statusTexts = {
      available: '可用',
      in_use: '使用中',
      exhausted: '已用完',
      expired: '已过期',
      contaminated: '已污染',
      reserved: '已预留'
    };
    return statusTexts[status] || status;
  };

  const getTypeText = (type: SampleType): string => {
    const typeTexts = {
      biological: '生物样本',
      chemical: '化学样本',
      reagent: '试剂',
      standard: '标准品',
      control: '对照品',
      other: '其他'
    };
    return typeTexts[type] || type;
  };

  if (showForm) {
    return (
      <SampleForm
        sample={editingSample}
        onSubmit={handleFormSubmit}
        onCancel={() => {
          setShowForm(false);
          setEditingSample(undefined);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 操作按钮 */}
      {showActions && (
        <div className="flex justify-end">
          {selectedSamples.length > 0 && (
            <button
              onClick={handleBatchDelete}
              className="px-4 py-2 bg-status-error text-white rounded-xl hover:bg-status-error/90 focus:outline-none focus:ring-2 focus:ring-status-error/50 mr-3 shadow-sm transition-colors"
            >
              删除选中 ({selectedSamples.length})
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-forest-secondary text-white rounded-xl hover:bg-forest-primary focus:outline-none focus:ring-2 focus:ring-forest-secondary/50 shadow-sm transition-colors"
          >
            <i className="fa-solid fa-plus mr-2"></i>
            新建样本
          </button>
        </div>
      )}

      {/* 搜索和筛选 */}
      <div className="bg-white rounded-xl shadow-sm border border-forest-accent/30 py-4 px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索样本名称或编号"
                className="w-full pl-10 pr-3 py-2.5 border border-forest-accent/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-secondary/50 bg-earth-beige/50 text-text-main"
              />
              <i className="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted"></i>
            </div>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as SampleStatus | 'all')}
              className="w-full px-3 py-2.5 border border-forest-accent/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-secondary/50 bg-earth-beige/50 text-text-main"
            >
              <option value="all">所有状态</option>
              <option value="available">可用</option>
              <option value="in_use">使用中</option>
              <option value="exhausted">已用完</option>
              <option value="expired">已过期</option>
              <option value="contaminated">已污染</option>
              <option value="reserved">已预留</option>
            </select>
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as SampleType | 'all')}
              className="w-full px-3 py-2.5 border border-forest-accent/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-secondary/50 bg-earth-beige/50 text-text-main"
            >
              <option value="all">所有类型</option>
              <option value="biological">生物样本</option>
              <option value="chemical">化学样本</option>
              <option value="reagent">试剂</option>
              <option value="standard">标准品</option>
              <option value="control">对照品</option>
              <option value="other">其他</option>
            </select>
          </div>

          <div>
            <select
              value={storageFilter}
              onChange={(e) => setStorageFilter(e.target.value as StorageCondition | 'all')}
              className="w-full px-3 py-2.5 border border-forest-accent/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-secondary/50 bg-earth-beige/50 text-text-main"
            >
              <option value="all">所有存储条件</option>
              <option value="room_temperature">室温</option>
              <option value="refrigerated">冷藏(4°C)</option>
              <option value="frozen_minus_20">冷冻(-20°C)</option>
              <option value="frozen_minus_80">超低温(-80°C)</option>
              <option value="liquid_nitrogen">液氮</option>
              <option value="desiccated">干燥</option>
            </select>
          </div>

          <div>
            <div className="flex space-x-1">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="flex-1 px-3 py-2.5 border border-forest-accent/30 rounded-l-xl focus:outline-none focus:ring-2 focus:ring-forest-secondary/50 bg-earth-beige/50 text-text-main"
              >
                <option value="name">名称</option>
                <option value="status">状态</option>
                <option value="type">类型</option>
                <option value="createdAt">创建时间</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-2.5 border border-l-0 border-forest-accent/30 rounded-r-xl hover:bg-forest-accent/10 focus:outline-none focus:ring-2 focus:ring-forest-secondary/50 bg-white"
              >
                <i className={`fa-solid fa-sort-${sortOrder === 'asc' ? 'up' : 'down'} text-text-muted`}></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 样本列表 */}
      <div className="bg-white rounded-2xl shadow-sm border border-forest-accent/30 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <i className="fa-solid fa-spinner fa-spin text-2xl text-gray-400 mb-4"></i>
            <p className="text-gray-500 dark:text-gray-400">加载中...</p>
          </div>
        ) : filteredSamples.length === 0 ? (
          <div className="p-8 text-center">
            <i className="fa-solid fa-flask text-4xl text-gray-400 mb-4"></i>
            <p className="text-gray-500 dark:text-gray-400">
              {samples.length === 0 ? '暂无样本数据' : '没有找到符合条件的样本'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-forest-accent/20">
              <thead className="bg-forest-main/5">
                <tr>
                  {showActions && (
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedSamples.length === filteredSamples.length && filteredSamples.length > 0}
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-forest-secondary focus:ring-forest-secondary border-gray-300 rounded"
                      />
                    </th>
                  )}
                  <th className="px-6 py-3 text-left font-medium text-gray-700 text-base">
                    样本信息
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700 text-base">
                    类型/状态
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700 text-base">
                    存储信息
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700 text-base">
                    更新时间
                  </th>
                  {showActions && (
                    <th className="px-6 py-3 text-right font-medium text-gray-700 text-base">
                      操作
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-forest-accent/10">
                {filteredSamples.map((sample) => (
                  <tr
                    key={sample.id}
                    className="hover:bg-forest-main/5 cursor-pointer transition-colors"
                    onClick={() => handleSelectSample(sample)}
                  >
                    {showActions && (
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedSamples.includes(sample.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSamples([...selectedSamples, sample.id]);
                            } else {
                              setSelectedSamples(selectedSamples.filter(id => id !== sample.id));
                            }
                          }}
                          className="h-4 w-4 text-forest-secondary focus:ring-forest-secondary border-gray-300 rounded"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <span className="font-medium text-text-main">{sample.name}</span>
                        {sample.sampleId && <span className="text-text-soft ml-2">({sample.sampleId})</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-row items-center space-x-2">
                        <span className="px-2 py-1 text-sm font-medium rounded-md bg-forest-accent/20 text-forest-primary">
                          {getTypeText(sample.type)}
                        </span>
                        <span className={`px-2 py-1 text-sm font-medium rounded-md ${getStatusColor(sample.status)}`}>
                          {getStatusText(sample.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="font-medium">
                          {sample.storage?.condition === 'room_temperature' && '室温'}
                          {sample.storage?.condition === 'refrigerated' && '冷藏(4°C)'}
                          {sample.storage?.condition === 'frozen_minus_20' && '冷冻(-20°C)'}
                          {sample.storage?.condition === 'frozen_minus_80' && '超低温(-80°C)'}
                          {sample.storage?.condition === 'liquid_nitrogen' && '液氮'}
                          {sample.storage?.condition === 'desiccated' && '干燥'}
                          {sample.storage?.location && (
                            <span className="text-gray-600 ml-1"> · {sample.storage.location}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {new Date(sample.updatedAt).toLocaleDateString('zh-CN')}
                    </td>
                    {showActions && (
                      <td className="px-6 py-4 text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleEditSample(sample)}
                            className="text-text-soft hover:text-forest-primary transition-colors p-1"
                            title="编辑"
                          >
                            <i className="fa-solid fa-pen-to-square"></i>
                          </button>
                          <button
                            onClick={() => handleDeleteSample(sample)}
                            className="text-text-soft hover:text-status-error transition-colors p-1"
                            title="删除"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 统计信息 */}
      <div className="bg-white rounded-2xl shadow-sm border border-forest-accent/30 p-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-forest-secondary">
              {samples.length}
            </div>
            <div>总数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-forest-accent">
              {samples.filter(s => s.status === 'available').length}
            </div>
            <div>可用</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-forest-primary">
              {samples.filter(s => s.status === 'in_use').length}
            </div>
            <div>使用中</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-status-error">
              {samples.filter(s => ['exhausted', 'expired', 'contaminated'].includes(s.status)).length}
            </div>
            <div>不可用</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SampleList;