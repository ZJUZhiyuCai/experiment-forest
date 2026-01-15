import React, { useState, useEffect } from 'react';
import { Sample, SampleHistory } from '@/types';
import { cachedSampleService, cachedSampleHistoryService } from '@/lib/cachedStorage';
import { toast } from 'sonner';

interface SampleDetailProps {
  sampleId: string;
  onEdit?: () => void;
  onClose?: () => void;
}

const SampleDetail: React.FC<SampleDetailProps> = ({ sampleId, onEdit, onClose }) => {
  const [sample, setSample] = useState<Sample | null>(null);
  const [history, setHistory] = useState<SampleHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'qc'>('details');

  useEffect(() => {
    loadSampleData();
  }, [sampleId]);

  const loadSampleData = async () => {
    try {
      setLoading(true);
      const [sampleData, historyData] = await Promise.all([
        cachedSampleService.getById(sampleId),
        cachedSampleHistoryService.getBySampleId(sampleId)
      ]);

      setSample(sampleData);
      setHistory(historyData);
    } catch (error) {
      console.error('加载样本详情失败:', error);
      toast.error('加载样本详情失败');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string): string => {
    const statusColors: Record<string, string> = {
      available: 'bg-status-success/10 text-status-success',
      in_use: 'bg-status-info/10 text-status-info',
      exhausted: 'bg-status-warning/10 text-status-warning',
      expired: 'bg-status-error/10 text-status-error',
      contaminated: 'bg-status-error/10 text-status-error',
      reserved: 'bg-forest-accent/20 text-forest-primary'
    };
    return statusColors[status] || statusColors.available;
  };

  const getActionTypeColor = (actionType: string): string => {
    const actionColors: Record<string, string> = {
      created: 'bg-status-success/10 text-status-success',
      updated: 'bg-status-info/10 text-status-info',
      used: 'bg-status-warning/10 text-status-warning',
      moved: 'bg-forest-accent/20 text-forest-primary',
      status_changed: 'bg-earth-brown/10 text-earth-brown'
    };
    return actionColors[actionType] || 'bg-earth-beige/50 text-text-main';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <i className="fa-solid fa-spinner fa-spin text-3xl text-gray-400 mb-4"></i>
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (!sample) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <i className="fa-solid fa-exclamation-triangle text-3xl text-red-400 mb-4"></i>
          <p className="text-gray-500">样本不存在</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* 页面头部 */}
      <div className="bg-white rounded-2xl shadow-sm border border-forest-accent/30 mb-6">
        <div className="px-6 py-4 border-b border-forest-accent/20">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-forest-primary">
                {sample.name}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                样本编号: {sample.sampleId}
              </p>
              <div className="flex items-center space-x-4 mt-2">
                <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(sample.status)}`}>
                  {sample.status === 'available' && '可用'}
                  {sample.status === 'in_use' && '使用中'}
                  {sample.status === 'exhausted' && '已用完'}
                  {sample.status === 'expired' && '已过期'}
                  {sample.status === 'contaminated' && '已污染'}
                  {sample.status === 'reserved' && '已预留'}
                </span>
                <span className="text-sm text-gray-500">
                  类型: {sample.type === 'biological' ? '生物样本' :
                    sample.type === 'chemical' ? '化学样本' :
                      sample.type === 'reagent' ? '试剂' :
                        sample.type === 'standard' ? '标准品' :
                          sample.type === 'control' ? '对照品' : '其他'}
                </span>
              </div>
            </div>
            <div className="flex space-x-3">
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="px-4 py-2 bg-forest-secondary text-white rounded-xl hover:bg-forest-primary focus:outline-none focus:ring-2 focus:ring-forest-secondary/50 shadow-sm transition-all"
                >
                  <i className="fa-solid fa-pen-to-square mr-2"></i>
                  编辑
                </button>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-forest-accent/30 text-text-main rounded-xl hover:bg-forest-accent/10 focus:outline-none focus:ring-2 focus:ring-forest-secondary/50 transition-all"
                >
                  <i className="fa-solid fa-times mr-2"></i>
                  关闭
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 选项卡 */}
        <div className="px-6">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'details'
                ? 'border-forest-primary text-forest-primary'
                : 'border-transparent text-text-soft hover:text-text-main hover:border-forest-accent/30'
                }`}
            >
              详细信息
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'history'
                ? 'border-forest-primary text-forest-primary'
                : 'border-transparent text-text-soft hover:text-text-main hover:border-forest-accent/30'
                }`}
            >
              操作历史 ({history.length})
            </button>
            <button
              onClick={() => setActiveTab('qc')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'qc'
                ? 'border-forest-primary text-forest-primary'
                : 'border-transparent text-text-soft hover:text-text-main hover:border-forest-accent/30'
                }`}
            >
              质量控制
            </button>
          </nav>
        </div>
      </div>

      {/* 选项卡内容 */}
      <div className="bg-white rounded-2xl shadow-sm border border-forest-accent/30 p-6">
        {activeTab === 'details' && (
          <div className="space-y-8">
            {/* 基本信息 */}
            <div>
              <h3 className="text-lg font-semibold text-forest-primary mb-4">基本信息</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">样本编号</label>
                  <p className="mt-1 text-sm text-gray-900">{sample.sampleId}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">样本名称</label>
                  <p className="mt-1 text-sm text-gray-900">{sample.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">样本类型</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {sample.type === 'biological' ? '生物样本' :
                      sample.type === 'chemical' ? '化学样本' :
                        sample.type === 'reagent' ? '试剂' :
                          sample.type === 'standard' ? '标准品' :
                            sample.type === 'control' ? '对照品' : '其他'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">创建时间</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(sample.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">更新时间</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(sample.updatedAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                {sample.projectId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">项目ID</label>
                    <p className="mt-1 text-sm text-gray-900">{sample.projectId}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 来源信息 */}
            {sample.source && Object.keys(sample.source).some(key => sample.source?.[key as keyof typeof sample.source]) && (
              <div>
                <h3 className="text-lg font-semibold text-forest-primary mb-4">来源信息</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sample.source.donorId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">供体编号</label>
                      <p className="mt-1 text-sm text-gray-900">{sample.source.donorId}</p>
                    </div>
                  )}
                  {sample.source.donorAge && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">年龄</label>
                      <p className="mt-1 text-sm text-gray-900">{sample.source.donorAge}</p>
                    </div>
                  )}
                  {sample.source.donorGender && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">性别</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {sample.source.donorGender === 'male' ? '男性' :
                          sample.source.donorGender === 'female' ? '女性' : '未知'}
                      </p>
                    </div>
                  )}
                  {sample.source.species && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">物种</label>
                      <p className="mt-1 text-sm text-gray-900">{sample.source.species}</p>
                    </div>
                  )}
                  {sample.source.tissueType && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">组织类型</label>
                      <p className="mt-1 text-sm text-gray-900">{sample.source.tissueType}</p>
                    </div>
                  )}
                  {sample.source.cellLine && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">细胞系</label>
                      <p className="mt-1 text-sm text-gray-900">{sample.source.cellLine}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 量体信息 */}
            {sample.quantity && Object.keys(sample.quantity).some(key => sample.quantity?.[key as keyof typeof sample.quantity]) && (
              <div>
                <h3 className="text-lg font-semibold text-forest-primary mb-4">量体信息</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {sample.quantity.volume && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">体积</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {sample.quantity.volume} {sample.quantity.volumeUnit || 'mL'}
                      </p>
                    </div>
                  )}
                  {sample.quantity.concentration && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">浓度</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {sample.quantity.concentration} {sample.quantity.concentrationUnit || 'mg/mL'}
                      </p>
                    </div>
                  )}
                  {sample.quantity.weight && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">重量</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {sample.quantity.weight} {sample.quantity.weightUnit || 'g'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 存储信息 */}
            {sample.storage && Object.keys(sample.storage).some(key => sample.storage?.[key as keyof typeof sample.storage]) && (
              <div>
                <h3 className="text-lg font-semibold text-forest-primary mb-4">存储信息</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {sample.storage.condition && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">存储条件</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {sample.storage.condition === 'room_temperature' && '室温'}
                        {sample.storage.condition === 'refrigerated' && '冷藏(4°C)'}
                        {sample.storage.condition === 'frozen_minus_20' && '冷冻(-20°C)'}
                        {sample.storage.condition === 'frozen_minus_80' && '超低温(-80°C)'}
                        {sample.storage.condition === 'liquid_nitrogen' && '液氮'}
                        {sample.storage.condition === 'desiccated' && '干燥'}
                      </p>
                    </div>
                  )}
                  {sample.storage.location && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">存储位置</label>
                      <p className="mt-1 text-sm text-gray-900">{sample.storage.location}</p>
                    </div>
                  )}
                  {sample.storage.container && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">容器</label>
                      <p className="mt-1 text-sm text-gray-900">{sample.storage.container}</p>
                    </div>
                  )}
                  {sample.storage.containerType && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">容器类型</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {sample.storage.containerType === 'tube' ? '离心管' :
                          sample.storage.containerType === 'vial' ? '小瓶' :
                            sample.storage.containerType === 'plate' ? '培养板' :
                              sample.storage.containerType === 'flask' ? '培养瓶' :
                                sample.storage.containerType === 'box' ? '冻存盒' :
                                  sample.storage.containerType === 'bag' ? '样本袋' : sample.storage.containerType}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 标签 */}
            {sample.tags && sample.tags.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-forest-primary mb-4">标签</h3>
                <div className="flex flex-wrap gap-2">
                  {sample.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-block px-3 py-1 text-sm bg-forest-accent/20 text-forest-primary rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 备注 */}
            {sample.notes && (
              <div>
                <h3 className="text-lg font-semibold text-forest-primary mb-4">备注</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {sample.notes}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <h3 className="text-lg font-semibold text-forest-primary mb-4">操作历史</h3>
            {history.length === 0 ? (
              <div className="text-center py-8">
                <i className="fa-solid fa-history text-3xl text-gray-400 mb-4"></i>
                <p className="text-gray-500">暂无操作历史</p>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((record, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getActionTypeColor(record.actionType)}`}>
                            {record.actionType === 'created' && '创建'}
                            {record.actionType === 'updated' && '更新'}
                            {record.actionType === 'used' && '使用'}
                            {record.actionType === 'moved' && '移动'}
                            {record.actionType === 'status_changed' && '状态变更'}
                          </span>
                          <span className="text-sm text-gray-500">
                            {new Date(record.timestamp).toLocaleString('zh-CN')}
                          </span>
                          {record.userId && (
                            <span className="text-sm text-gray-500">
                              操作者: {record.userId}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-900">{record.description}</p>
                        {record.changes && Object.keys(record.changes).length > 0 && (
                          <div className="mt-2 text-xs text-gray-600">
                            变更详情: {JSON.stringify(record.changes, null, 2)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'qc' && (
          <div>
            <h3 className="text-lg font-semibold text-forest-primary mb-4">质量控制</h3>
            {sample.qualityControl && Object.keys(sample.qualityControl).some(key => sample.qualityControl?.[key as keyof typeof sample.qualityControl] !== undefined) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sample.qualityControl.purity && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">纯度</label>
                    <p className="mt-1 text-sm text-gray-900">{sample.qualityControl.purity}%</p>
                  </div>
                )}
                {sample.qualityControl.purityMethod && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">纯度检测方法</label>
                    <p className="mt-1 text-sm text-gray-900">{sample.qualityControl.purityMethod}</p>
                  </div>
                )}
                {sample.qualityControl.endotoxin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">内毒素</label>
                    <p className="mt-1 text-sm text-gray-900">{sample.qualityControl.endotoxin} EU/mL</p>
                  </div>
                )}
                {sample.qualityControl.viability && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">细胞活力</label>
                    <p className="mt-1 text-sm text-gray-900">{sample.qualityControl.viability}%</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-500">无菌检验</label>
                  <p className="mt-1 text-sm text-gray-900">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${sample.qualityControl.sterility
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                      }`}>
                      {sample.qualityControl.sterility ? '合格' : '不合格'}
                    </span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <i className="fa-solid fa-flask text-3xl text-gray-400 mb-4"></i>
                <p className="text-gray-500">暂无质量控制信息</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SampleDetail;