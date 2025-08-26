import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { experimentRecordService, projectService } from '@/lib/cachedStorage';
import { ExperimentRecord, Project, ExperimentCategory } from '@/types';
import { ExcelTable } from './ExcelTable';
import { ImageUpload } from './ImageUpload';
import { TreePlantingCelebration } from './TreePlantingCelebration';
import { EnhancedInput, EnhancedFormContainer } from './EnhancedForm';
import { 
  getExperimentCategoriesByGroup, 
  validateExperimentData,
  formatExperimentData,
  generateExperimentTemplate 
} from '@/utils/dataStandardization';

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
  isSubmitting = false
}: ExperimentRecordFormProps) {
  const [topics, setTopics] = useState<Project[]>([]);
  const [showTableEditor, setShowTableEditor] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [showTreeCelebration, setShowTreeCelebration] = useState(false);
  
  // 表单状态
  const [formData, setFormData] = useState({
    title: '',
    date: defaultDate || new Date().toISOString().split('T')[0],
    content: '',
    status: 'draft' as 'draft' | 'completed' | 'archived',
    category: '' as ExperimentCategory | '',
    subCategory: '',
    methodology: '',
    equipment: '',
    reagents: '',
    sampleType: '',
    sampleSize: '',
    relatedSamples: [] as string[], // 关联的样本ID数组
    dataFormat: 'mixed' as 'numerical' | 'categorical' | 'image' | 'sequence' | 'mixed',
    tags: '',
    projectId: projectId || '',
    // 实验条件
    temperature: '',
    humidity: '',
    ph: '',
    // 质量控制
    controls: '',
    replicates: '3',
    randomization: true
  });
  
  // 计算表单完成进度
  const calculateProgress = () => {
    const fields = [
      'title', 'date', 'content', 'category', 
      'methodology', 'equipment', 'reagents'
    ];
    const completedFields = fields.filter(field => {
      const value = formData[field as keyof typeof formData];
      return value && value.toString().trim() !== '';
    }).length;
    return Math.round((completedFields / fields.length) * 100);
  };
  
  const [progress, setProgress] = useState(0);
  
  // 更新进度
  useEffect(() => {
    setProgress(calculateProgress());
  }, [formData]);
  
  // 错误状态
  const [errors, setErrors] = useState({
    title: '',
    date: '',
    content: '',
    category: '',
    validation: [] as string[]
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
        category: record.category,
        subCategory: record.subCategory || '',
        methodology: record.methodology || '',
        equipment: record.equipment?.join(', ') || '',
        reagents: record.reagents?.join(', ') || '',
        sampleType: record.sampleType || '',
        sampleSize: record.sampleSize?.toString() || '',
        relatedSamples: (record as any).relatedSamples || [],
        dataFormat: record.dataFormat || 'mixed',
        tags: record.tags.join(', '),
        projectId: record.projectId || '',
        temperature: record.experimentalConditions?.temperature?.toString() || '',
        humidity: record.experimentalConditions?.humidity?.toString() || '',
        ph: record.experimentalConditions?.ph?.toString() || '',
        controls: record.qualityControl?.controls?.join(', ') || '',
        replicates: record.qualityControl?.replicates?.toString() || '3',
        randomization: record.qualityControl?.randomization ?? true
      });
    }
  }, [record]);

  const validateForm = (): boolean => {
    const newErrors = {
      title: !formData.title.trim() ? '请输入实验记录标题' : '',
      date: !formData.date ? '请选择实验日期' : '',
      content: !formData.content.trim() ? '请输入实验内容' : '',
      category: !formData.category ? '请选择实验分类' : '',
      validation: [] as string[]
    };
    
    // 数据标准化验证
    if (formData.category) {
      const recordData = buildRecordData();
      const validationResult = validateExperimentData(recordData);
      if (!validationResult.isValid) {
        newErrors.validation = validationResult.errors;
      }
    }
    
    setErrors(newErrors);
    return Object.values(newErrors).every(error => 
      Array.isArray(error) ? error.length === 0 : !error
    );
  };

  // 构建记录数据对象
  const buildRecordData = (): Partial<ExperimentRecord> => {
    const tags = formData.tags.split(',').map(tag => tag.trim()).filter(Boolean);
    const equipment = formData.equipment.split(',').map(item => item.trim()).filter(Boolean);
    const reagents = formData.reagents.split(',').map(item => item.trim()).filter(Boolean);
    const controls = formData.controls.split(',').map(item => item.trim()).filter(Boolean);
    
    return {
      title: formData.title,
      date: formData.date,
      content: formData.content,
      status: formData.status,
      category: formData.category as ExperimentCategory,
      subCategory: formData.subCategory || undefined,
      methodology: formData.methodology || undefined,
      equipment: equipment.length > 0 ? equipment : undefined,
      reagents: reagents.length > 0 ? reagents : undefined,
      sampleType: formData.sampleType || undefined,
      sampleSize: formData.sampleSize ? Number(formData.sampleSize) : undefined,
      relatedSamples: formData.relatedSamples.length > 0 ? formData.relatedSamples : undefined,
      dataFormat: formData.dataFormat,
      experimentalConditions: {
        temperature: formData.temperature ? Number(formData.temperature) : undefined,
        humidity: formData.humidity ? Number(formData.humidity) : undefined,
        ph: formData.ph ? Number(formData.ph) : undefined
      },
      qualityControl: {
        controls,
        replicates: Number(formData.replicates),
        randomization: formData.randomization
      },
      tags,
      projectId: formData.projectId || undefined
    };
  };

  // 处理实验类型变化
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    setFormData(prev => ({ ...prev, category: value as ExperimentCategory }));
    
    // 清除类型错误
    if (errors.category) {
      setErrors(prev => ({ ...prev, category: '' }));
    }
    
    // 如果选择了新类型，可以预填充一些模板数据
    if (value && !record) {
      const template = generateExperimentTemplate(value as ExperimentCategory);
      if (template.experimentalConditions) {
        setFormData(prev => ({
          ...prev,
          temperature: template.experimentalConditions?.temperature?.toString() || '',
          humidity: template.experimentalConditions?.humidity?.toString() || '',
          ph: template.experimentalConditions?.ph?.toString() || ''
        }));
      }
    }
  };

  const experimentCategories = getExperimentCategoriesByGroup();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form submission started with data:', formData);
    
    if (!validateForm()) {
      console.log('Form validation failed. Errors:', errors);
      
      // 特别检查ELISA的验证问题
      if (formData.category === 'elisa') {
        const recordData = buildRecordData();
        console.log('ELISA record data for validation:', recordData);
        const validationResult = validateExperimentData(recordData);
        console.log('ELISA validation result:', validationResult);
      }
      
      const firstErrorField = document.querySelector('[aria-invalid="true"]');
      firstErrorField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    
    try {
      const recordData = buildRecordData();
      console.log('Built record data:', recordData);
      
      const formattedData = formatExperimentData(recordData);
      console.log('Formatted record data:', formattedData);
      
      let savedRecord: ExperimentRecord;
      
      if (record) {
        // 更新现有记录
        const updatedRecord = experimentRecordService.update(record.id, formattedData);
        
        if (!updatedRecord) {
          throw new Error('更新记录失败');
        }
        savedRecord = updatedRecord;
        toast.success('实验记录更新成功');
      } else {
        // 创建新记录
        const createData = {
          title: formattedData.title!,
          date: formattedData.date!,
          content: formattedData.content!,
          status: formattedData.status!,
          category: formattedData.category!,
          subCategory: formattedData.subCategory,
          methodology: formattedData.methodology,
          equipment: formattedData.equipment,
          reagents: formattedData.reagents,
          sampleType: formattedData.sampleType,
          sampleSize: formattedData.sampleSize,
          dataFormat: formattedData.dataFormat,
          experimentalConditions: formattedData.experimentalConditions,
          qualityControl: formattedData.qualityControl,
          dataValidation: {
            isValidated: true,
            validationDate: new Date()
          },
          tags: formattedData.tags!,
          projectId: formattedData.projectId
        };
        savedRecord = experimentRecordService.create(createData);
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
      <EnhancedFormContainer
        title={record ? '编辑实验记录' : '创建实验记录'}
        subtitle={record ? '修改实验记录的详细信息' : '记录您的实验过程和结果'}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitText={record ? '更新记录' : '创建记录'}
        onCancel={onCancel}
        progress={progress}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EnhancedInput
            label="实验标题"
            value={formData.title}
            onChange={(value) => setFormData(prev => ({ ...prev, title: value }))}
            error={errors.title}
            icon="fa-flask"
            required
            placeholder="输入实验标题"
          />
          
          <EnhancedInput
            label="实验日期"
            type="date"
            value={formData.date}
            onChange={(value) => setFormData(prev => ({ ...prev, date: value }))}
            error={errors.date}
            icon="fa-calendar"
            required
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EnhancedInput
            label="实验状态"
            type="select"
            value={formData.status}
            onChange={(value) => setFormData(prev => ({ ...prev, status: value as 'draft' | 'completed' | 'archived' }))}
            icon="fa-info-circle"
            options={[
              { value: 'draft', label: '草稿' },
              { value: 'completed', label: '已完成' },
              { value: 'archived', label: '已归档' }
            ]}
          />
          
          <EnhancedInput
            label="实验分类"
            type="select"
            value={formData.category}
            onChange={(value) => {
              setFormData(prev => ({ ...prev, category: value as ExperimentCategory }));
              handleCategoryChange({ target: { value } } as any);
            }}
            error={errors.category}
            icon="fa-layer-group"
            required
            options={Object.entries(experimentCategories).flatMap(([_, categories]) => 
              categories.map(({ category, name }) => ({ value: category, label: name }))
            )}
          />
        </div>
        
        {/* 样本类型和实验方法 - ELISA等实验的必填字段 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EnhancedInput
            label="样本类型"
            value={formData.sampleType}
            onChange={(value) => setFormData(prev => ({ ...prev, sampleType: value }))}
            icon="fa-vial"
            placeholder="例如: 血清, 细胞培养上清, 组织提取物"
          />
          
          <EnhancedInput
            label="实验方法"
            value={formData.methodology}
            onChange={(value) => setFormData(prev => ({ ...prev, methodology: value }))}
            icon="fa-microscope"
            placeholder="例如: 夹心ELISA, 直接ELISA, 竞争性ELISA"
          />
        </div>
        
        <EnhancedInput
          label="关联课题"
          type="select"
          value={formData.projectId}
          onChange={(value) => setFormData(prev => ({ ...prev, projectId: value }))}
          icon="fa-project-diagram"
          options={[
            { value: '', label: '-- 不关联课题 --' },
            ...topics.map((topic: Project) => ({ value: topic.id, label: topic.title }))
          ]}
        />
        
        <EnhancedInput
          label="标签 (用逗号分隔)"
          value={formData.tags}
          onChange={(value) => setFormData(prev => ({ ...prev, tags: value }))}
          icon="fa-tags"
          placeholder="例如: 化学, 滴定, 溶液"
        />

        <EnhancedInput
          label="实验内容"
          type="textarea"
          value={formData.content}
          onChange={(value) => setFormData(prev => ({ ...prev, content: value }))}
          error={errors.content}
          icon="fa-file-alt"
          required
          placeholder="详细描述实验目的、过程、结果和分析..."
        />
        
      </EnhancedFormContainer>
      
      {/* 特效组件 */}
      <ExcelTable
        visible={showTableEditor}
        onClose={() => setShowTableEditor(false)}
        onInsert={insertTable}
      />
      
      <ImageUpload
        visible={showImageUpload}
        onClose={() => setShowImageUpload(false)}
        onInsert={insertImage}
      />
      
      <TreePlantingCelebration
        isVisible={showTreeCelebration}
        type="record"
        onClose={() => setShowTreeCelebration(false)}
      />
    </>
  );
}
