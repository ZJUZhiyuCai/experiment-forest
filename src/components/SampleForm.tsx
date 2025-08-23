import React, { useState, useEffect } from 'react';
import { Sample, SampleType, SampleStatus, StorageCondition } from '@/types';
import { toast } from 'sonner';

interface SampleFormProps {
  sample?: Sample;
  onSubmit: (sample: Sample) => void;
  onCancel: () => void;
}

const SampleForm: React.FC<SampleFormProps> = ({ sample, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<Partial<Sample>>({
    sampleId: '',
    name: '',
    type: 'biological' as SampleType,
    status: 'available' as SampleStatus,
    source: {
      donorId: '',
      donorAge: '',
      donorGender: undefined,
      species: '',
      tissueType: '',
      cellLine: '',
      collectionDate: '',
      collectionMethod: ''
    },
    quantity: {
      volume: '',
      volumeUnit: 'mL',
      concentration: '',
      concentrationUnit: 'mg/mL',
      weight: '',
      weightUnit: 'g'
    },
    storage: {
      condition: 'room_temperature' as StorageCondition,
      location: '',
      container: '',
      containerType: ''
    },
    dates: {
      receivedDate: '',
      expiryDate: '',
      lastAccessDate: ''
    },
    qualityControl: {
      purity: '',
      purityMethod: '',
      sterility: false,
      endotoxin: '',
      viability: ''
    },
    projectId: '',
    tags: [],
    notes: ''
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (sample) {
      setFormData(sample);
    }
  }, [sample]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (name.includes('.')) {
      const [section, field] = name.split('.');
      setFormData(prev => {
        const currentSection = prev[section as keyof Sample] as any;
        return {
          ...prev,
          [section]: {
            ...(currentSection || {}),
            [field]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
          }
        };
      });
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
      }));
    }

    // 清除错误
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.sampleId?.trim()) {
      newErrors.sampleId = '样本编号不能为空';
    }

    if (!formData.name?.trim()) {
      newErrors.name = '样本名称不能为空';
    }

    if (!formData.type) {
      newErrors.type = '样本类型不能为空';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('请填写必填字段');
      return;
    }

    setIsSubmitting(true);

    try {
      const sampleData: Sample = {
        ...formData,
        id: sample?.id || `sample_${Date.now()}`,
        sampleId: formData.sampleId!,
        name: formData.name!,
        type: formData.type!,
        status: formData.status!,
        source: formData.source || {},
        quantity: formData.quantity || {},
        storage: formData.storage || {},
        dates: formData.dates || {},
        qualityControl: formData.qualityControl || {},
        projectId: formData.projectId || '',
        tags: formData.tags || [],
        notes: formData.notes || '',
        createdAt: sample?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      onSubmit(sampleData);
      toast.success(sample ? '样本更新成功' : '样本创建成功');
    } catch (error) {
      console.error('保存样本失败:', error);
      toast.error('保存样本失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[#4A7C59]">
            {sample ? '编辑样本' : '新建样本'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-500 hover:text-[#4A7C59]"
          >
            <i className="fa-solid fa-times text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 基本信息 */}
          <div>
            <h3 className="text-lg font-semibold text-[#4A7C59] mb-4">基本信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  样本编号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="sampleId"
                  value={formData.sampleId || ''}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    errors.sampleId ? 'border-red-500' : 'border-gray-300'
                  } bg-white text-gray-900`}
                  placeholder="输入样本编号"
                />
                {errors.sampleId && (
                  <p className="mt-1 text-sm text-red-500">{errors.sampleId}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  样本名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  } bg-white text-gray-900`}
                  placeholder="输入样本名称"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-500">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  样本类型 <span className="text-red-500">*</span>
                </label>
                <select
                  name="type"
                  value={formData.type || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                >
                  <option value="biological">生物样本</option>
                  <option value="chemical">化学样本</option>
                  <option value="reagent">试剂</option>
                  <option value="standard">标准品</option>
                  <option value="control">对照品</option>
                  <option value="other">其他</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  样本状态
                </label>
                <select
                  name="status"
                  value={formData.status || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                >
                  <option value="available">可用</option>
                  <option value="in_use">使用中</option>
                  <option value="exhausted">已用完</option>
                  <option value="expired">已过期</option>
                  <option value="contaminated">已污染</option>
                  <option value="reserved">已预留</option>
                </select>
              </div>
            </div>
          </div>

          {/* 来源信息 */}
          <div>
            <h3 className="text-lg font-semibold text-[#4A7C59] mb-4">来源信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  供体编号
                </label>
                <input
                  type="text"
                  name="source.donorId"
                  value={formData.source?.donorId || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                  placeholder="供体编号"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  年龄
                </label>
                <input
                  type="text"
                  name="source.donorAge"
                  value={formData.source?.donorAge || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                  placeholder="年龄"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  性别
                </label>
                <select
                  name="source.donorGender"
                  value={formData.source?.donorGender || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                >
                  <option value="">请选择</option>
                  <option value="male">男性</option>
                  <option value="female">女性</option>
                  <option value="unknown">未知</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  物种
                </label>
                <input
                  type="text"
                  name="source.species"
                  value={formData.source?.species || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                  placeholder="如：Homo sapiens"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  组织类型
                </label>
                <input
                  type="text"
                  name="source.tissueType"
                  value={formData.source?.tissueType || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                  placeholder="组织类型"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  细胞系
                </label>
                <input
                  type="text"
                  name="source.cellLine"
                  value={formData.source?.cellLine || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                  placeholder="如：HeLa, 293T"
                />
              </div>
            </div>
          </div>

          {/* 量体信息 */}
          <div>
            <h3 className="text-lg font-semibold text-[#4A7C59] mb-4">量体信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    体积
                  </label>
                  <input
                    type="number"
                    name="quantity.volume"
                    value={formData.quantity?.volume || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                    placeholder="体积"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    单位
                  </label>
                  <select
                    name="quantity.volumeUnit"
                    value={formData.quantity?.volumeUnit || 'mL'}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                  >
                    <option value="μL">μL</option>
                    <option value="mL">mL</option>
                    <option value="L">L</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    浓度
                  </label>
                  <input
                    type="number"
                    name="quantity.concentration"
                    value={formData.quantity?.concentration || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                    placeholder="浓度"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    单位
                  </label>
                  <select
                    name="quantity.concentrationUnit"
                    value={formData.quantity?.concentrationUnit || 'mg/mL'}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                  >
                    <option value="mg/mL">mg/mL</option>
                    <option value="μg/mL">μg/mL</option>
                    <option value="ng/mL">ng/mL</option>
                    <option value="M">M</option>
                    <option value="mM">mM</option>
                    <option value="μM">μM</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    重量
                  </label>
                  <input
                    type="number"
                    name="quantity.weight"
                    value={formData.quantity?.weight || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                    placeholder="重量"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    单位
                  </label>
                  <select
                    name="quantity.weightUnit"
                    value={formData.quantity?.weightUnit || 'g'}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                  >
                    <option value="mg">mg</option>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* 存储信息 */}
          <div>
            <h3 className="text-lg font-semibold text-[#4A7C59] mb-4">存储信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  存储条件
                </label>
                <select
                  name="storage.condition"
                  value={formData.storage?.condition || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                >
                  <option value="room_temperature">室温</option>
                  <option value="refrigerated">冷藏(4°C)</option>
                  <option value="frozen_minus_20">冷冻(-20°C)</option>
                  <option value="frozen_minus_80">超低温(-80°C)</option>
                  <option value="liquid_nitrogen">液氮</option>
                  <option value="desiccated">干燥</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  存储位置
                </label>
                <input
                  type="text"
                  name="storage.location"
                  value={formData.storage?.location || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                  placeholder="如：冰箱A-2层-3号位置"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  容器
                </label>
                <input
                  type="text"
                  name="storage.container"
                  value={formData.storage?.container || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                  placeholder="容器编号"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  容器类型
                </label>
                <select
                  name="storage.containerType"
                  value={formData.storage?.containerType || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                >
                  <option value="">请选择</option>
                  <option value="tube">离心管</option>
                  <option value="vial">小瓶</option>
                  <option value="plate">培养板</option>
                  <option value="flask">培养瓶</option>
                  <option value="box">冻存盒</option>
                  <option value="bag">样本袋</option>
                </select>
              </div>
            </div>
          </div>

          {/* 日期信息 */}
          <div>
            <h3 className="text-lg font-semibold text-[#4A7C59] mb-4">日期信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  接收日期
                </label>
                <input
                  type="date"
                  name="dates.receivedDate"
                  value={formData.dates?.receivedDate ? formData.dates.receivedDate.split('T')[0] : ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  到期日期
                </label>
                <input
                  type="date"
                  name="dates.expiryDate"
                  value={formData.dates?.expiryDate ? formData.dates.expiryDate.split('T')[0] : ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最后访问日期
                </label>
                <input
                  type="date"
                  name="dates.lastAccessDate"
                  value={formData.dates?.lastAccessDate ? formData.dates.lastAccessDate.split('T')[0] : ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                />
              </div>
            </div>
          </div>

          {/* 质量控制 */}
          <div>
            <h3 className="text-lg font-semibold text-[#4A7C59] mb-4">质量控制</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  纯度 (%)
                </label>
                <input
                  type="number"
                  name="qualityControl.purity"
                  value={formData.qualityControl?.purity || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                  placeholder="纯度"
                  step="0.01"
                  min="0"
                  max="100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  纯度检测方法
                </label>
                <input
                  type="text"
                  name="qualityControl.purityMethod"
                  value={formData.qualityControl?.purityMethod || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                  placeholder="如：HPLC, GC-MS"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  内毒素 (EU/mL)
                </label>
                <input
                  type="number"
                  name="qualityControl.endotoxin"
                  value={formData.qualityControl?.endotoxin || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                  placeholder="内毒素含量"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  细胞活力 (%)
                </label>
                <input
                  type="number"
                  name="qualityControl.viability"
                  value={formData.qualityControl?.viability || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                  placeholder="细胞活力"
                  step="0.01"
                  min="0"
                  max="100"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="sterility"
                  name="qualityControl.sterility"
                  checked={formData.qualityControl?.sterility || false}
                  onChange={handleChange}
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                />
                <label htmlFor="sterility" className="text-sm font-medium text-gray-700">
                  无菌检验合格
                </label>
              </div>
            </div>
          </div>

          {/* 项目关联和标签 */}
          <div>
            <h3 className="text-lg font-semibold text-[#4A7C59] mb-4">项目关联</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  关联项目ID
                </label>
                <input
                  type="text"
                  name="projectId"
                  value={formData.projectId || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                  placeholder="项目编号"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  标签 (用逗号分隔)
                </label>
                <input
                  type="text"
                  name="tags"
                  value={formData.tags?.join(', ') || ''}
                  onChange={(e) => {
                    setFormData(prev => ({
                      ...prev,
                      tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag)
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                  placeholder="如：重要, 紧急, 高优先级"
                />
              </div>
            </div>
          </div>

          {/* 备注 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              备注
            </label>
            <textarea
              name="notes"
              value={formData.notes || ''}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
              placeholder="输入样本相关备注信息..."
            />
          </div>

          {/* 表单按钮 */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:from-emerald-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SampleForm;