import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { experimentRecordService, projectService } from '@/lib/cachedStorage';
import { ExperimentRecord, Project } from '@/types';
import { Button } from './Button';
import { ExcelTable } from './ExcelTable';
import { ImageUpload } from './ImageUpload';
import { MarkdownRenderer } from './MarkdownRenderer';
import { TreePlantingCelebration } from './TreePlantingCelebration';

interface ExperimentRecordFormProps {
  record?: ExperimentRecord | null;
  projectId?: string;
  defaultDate?: string;
  onSubmit?: (record: ExperimentRecord) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  className?: string;
}

export function ExperimentRecordForm({
  record,
  projectId,
  defaultDate,
  onSubmit,
  onCancel,
  isSubmitting = false,
  className = ''
}: ExperimentRecordFormProps) {
  const [topics, setTopics] = useState<Project[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showTableEditor, setShowTableEditor] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [showTreeCelebration, setShowTreeCelebration] = useState(false);
  
  // 表单状态
  const [formData, setFormData] = useState({
    title: '',
    date: defaultDate || new Date().toISOString().split('T')[0],
    content: '',
    status: 'draft' as 'draft' | 'completed' | 'archived',
    category: '',
    tags: '',
    projectId: projectId || ''
  });
  
  // 错误状态
  const [errors, setErrors] = useState({
    title: '',
    date: '',
    content: '',
    category: ''
  });

  // 加载课题列表
  useEffect(() => {
    const allTopics = projectService.getAll();
    setTopics(allTopics);
  }, []);

  // 如果有现有记录，填充表单
  useEffect(() => {
    if (record) {
      setFormData({
        title: record.title,
        date: record.date,
        content: record.content,
        status: record.status,
        category: record.category as string,
        tags: record.tags.join(', '),
        projectId: record.projectId || ''
      });
    }
  }, [record]);

  const validateForm = (): boolean => {
    const newErrors = {
      title: !formData.title.trim() ? '请输入实验记录标题' : '',
      date: !formData.date ? '请选择实验日期' : '',
      content: !formData.content.trim() ? '请输入实验内容' : '',
      category: !formData.category ? '请选择实验分类' : ''
    };
    
    setErrors(newErrors);
    return Object.values(newErrors).every(error => !error);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // 清除对应字段的错误
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name as keyof typeof errors]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      const firstErrorField = document.querySelector('[aria-invalid="true"]');
      firstErrorField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    
    const tags = formData.tags.split(',').map(tag => tag.trim()).filter(Boolean);
    
    try {
      let savedRecord: ExperimentRecord;
      
      if (record) {
        // 更新现有记录
        const updatedRecord = experimentRecordService.update(record.id, {
          title: formData.title,
          date: formData.date,
          content: formData.content,
          status: formData.status,
          category: formData.category as any,
          tags,
          projectId: formData.projectId || undefined
        });
        
        if (!updatedRecord) {
          throw new Error('更新记录失败');
        }
        savedRecord = updatedRecord;
        toast.success('实验记录更新成功');
      } else {
        // 创建新记录
        savedRecord = experimentRecordService.create({
          title: formData.title,
          date: formData.date,
          content: formData.content,
          status: formData.status,
          category: formData.category as any,
          tags,
          projectId: formData.projectId || undefined
        });
        toast.success('实验记录创建成功');
        
        // 显示种树庆祝动画
        setShowTreeCelebration(true);
      }
      
      onSubmit?.(savedRecord);
    } catch (error) {
      console.error('保存实验记录失败:', error);
      toast.error('保存实验记录失败，请重试');
    }
  };

  // 插入表格到内容中
  const insertTable = (tableData: string[][]) => {
    if (!tableData || tableData.length === 0 || !tableData[0]) {
      setShowTableEditor(false);
      return;
    }
    
    // 生成Markdown表格
    let table = '| ';
    
    // 表头
    for (let i = 0; i < tableData[0].length; i++) {
      table += `${String.fromCharCode(65 + i)} |`;
    }
    table += '\n| ';
    
    // 分隔线
    for (let i = 0; i < tableData[0].length; i++) {
      table += '--- |';
    }
    
    // 行数据
    tableData.forEach(row => {
      table += '\n| ';
      row.forEach(cell => {
        table += `${cell || ''} |`;
      });
    });
     
    setFormData(prev => ({
      ...prev,
      content: prev.content + '\n\n' + table + '\n\n'
    }));
   
    setShowTableEditor(false);
  };
   
  // 插入图片到内容中
  const insertImage = (imageData: { url: string; alt: string; caption?: string; width?: number }) => {
    let imageMarkdown = `![${imageData.alt}](${imageData.url}`;
     
    // 添加尺寸信息
    if (imageData.width && imageData.width !== 400) {
      imageMarkdown += ` =x${imageData.width}`;
    }
     
    imageMarkdown += ')';
     
    // 添加说明文字
    if (imageData.caption) {
      imageMarkdown += `\n*${imageData.caption}*`;
    }
     
    setFormData(prev => ({
      ...prev,
      content: prev.content + '\n\n' + imageMarkdown + '\n\n'
    }));
     
    setShowImageUpload(false);
  };

  return (
    <>
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            实验标题 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
              errors.title 
                ? 'border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/20' 
                : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
            } text-gray-800 dark:text-gray-200`}
            placeholder="输入实验标题"
            aria-invalid={!!errors.title}
            disabled={isSubmitting}
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center">
              <i className="fa-solid fa-exclamation-circle mr-1"></i> {errors.title}
            </p>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              实验日期 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-200 ${
                errors.date 
                  ? 'border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/20' 
                  : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
              } text-gray-800 dark:text-gray-200`}
              aria-invalid={!!errors.date}
              disabled={isSubmitting}
            />
            {errors.date && (
              <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center">
                <i className="fa-solid fa-exclamation-circle mr-1"></i> {errors.date}
              </p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              实验状态
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-200"
              disabled={isSubmitting}
            >
              <option value="draft">草稿</option>
              <option value="completed">已完成</option>
              <option value="archived">已归档</option>
            </select>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            实验分类 <span className="text-red-500">*</span>
          </label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
              errors.category 
                ? 'border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/20' 
                : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
            } text-gray-800 dark:text-gray-200`}
            disabled={isSubmitting}
            aria-invalid={!!errors.category}
          >
            <option value="">-- 请选择实验分类 --</option>
            <option value="cell">细胞实验</option>
            <option value="animal">动物实验</option>
            <option value="chemical">化学实验</option>
            <option value="microbiology">微生物实验</option>
            <option value="other">其他实验</option>
          </select>
          {errors.category && (
            <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center">
              <i className="fa-solid fa-exclamation-circle mr-1"></i> {errors.category}
            </p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            关联课题
          </label>
          <select
            name="projectId"
            value={formData.projectId}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            disabled={isSubmitting}
          >
            <option value="">-- 不关联课题 --</option>
            {topics.map((topic: Project) => (
              <option key={topic.id} value={topic.id}>{topic.title}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            标签 (用逗号分隔)
          </label>
          <input
            type="text"
            name="tags"
            value={formData.tags}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            placeholder="例如: 化学, 滴定, 溶液"
            disabled={isSubmitting}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            实验内容 <span className="text-red-500">*</span>
          </label>
          <div className="mb-3 border border-gray-300 dark:border-gray-600 rounded-t-lg overflow-hidden shadow-sm">
            <div className="flex items-center bg-gray-50 dark:bg-gray-700 p-2 border-b border-gray-300 dark:border-gray-600">
              <button 
                type="button"
                onClick={() => setShowTableEditor(true)}
                className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded transition-all duration-200 transform hover:scale-105 mr-2"
                aria-label="插入表格"
              >
                <i className="fa-solid fa-table mr-1"></i>
                <span className="text-sm">插入表格</span>
              </button>
              
              <button 
                type="button"
                onClick={() => setShowImageUpload(true)}
                className="p-2 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-all duration-200 transform hover:scale-105 mr-2"
                aria-label="插入图片"
              >
                <i className="fa-solid fa-image mr-1"></i>
                <span className="text-sm">插入图片</span>
              </button>
              
              <button 
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className={`p-2 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-all duration-200 transform hover:scale-105 ${
                  showPreview 
                    ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30' 
                    : 'text-green-600 dark:text-green-400'
                }`}
                aria-label="预览内容"
              >
                <i className="fa-solid fa-eye mr-1"></i>
                <span className="text-sm">预览</span>
              </button>
            </div>
            
            <div className={`transition-all duration-300 ${showPreview ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : ''}`}>
              <div className={showPreview ? '' : 'w-full'}>
                <textarea
                  name="content"
                  value={formData.content}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 rounded-b-lg border-0 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-200 ${
                    errors.content 
                      ? 'bg-red-50 dark:bg-red-900/20' 
                      : 'bg-white dark:bg-gray-800'
                  } text-gray-800 dark:text-gray-200 min-h-[200px] resize-y`}
                  placeholder="详细描述实验目的、过程、结果和分析..."
                  aria-invalid={!!errors.content}
                  disabled={isSubmitting}
                ></textarea>
              </div>
              
              {/* 实时预览 */}
              {showPreview && (
                <div className="border-l border-gray-300 dark:border-gray-600 pl-4">
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg min-h-[200px] max-h-[400px] overflow-y-auto">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                      <i className="fa-solid fa-eye mr-2"></i>
                      实时预览
                    </h4>
                    {formData.content ? (
                      <MarkdownRenderer content={formData.content} />
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-sm italic">
                        在左侧输入内容后，预览将在此处显示...
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          {errors.content && (
            <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center">
              <i className="fa-solid fa-exclamation-circle mr-1"></i> {errors.content}
            </p>
          )}
          
          {/* Excel表格编辑器 */}
          <ExcelTable
            visible={showTableEditor}
            onClose={() => setShowTableEditor(false)}
            onInsert={insertTable}
          />
          
          {/* 图片上传组件 */}
          <ImageUpload
            visible={showImageUpload}
            onClose={() => setShowImageUpload(false)}
            onInsert={insertImage}
          />
        </div>
        
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          {onCancel && (
            <Button 
              type="button" 
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              取消
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                保存中...
              </>
            ) : (
              <>
                <i className="fa-solid fa-save mr-2"></i>
                {record ? '更新记录' : '保存记录'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
    
    {/* 种树庆祝动画 */}
    <TreePlantingCelebration
      isVisible={showTreeCelebration}
      type="record"
      onClose={() => setShowTreeCelebration(false)}
    />
    </>
  );
}