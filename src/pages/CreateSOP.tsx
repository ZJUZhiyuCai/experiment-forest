import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { sopService, topicService } from '@/lib/cachedStorage';
import { Project } from '@/types';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/Button';
import { useLocation } from 'react-router-dom';
import { TreePlantingCelebration } from '@/components/TreePlantingCelebration';
import { sopTemplates, getSOPTemplateById } from '@/utils/sopTemplates';
import { getExperimentCategoriesByGroup } from '@/utils/dataStandardization';

export default function CreateSOP() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
   const [formStep, setFormStep] = useState(1); // 多步骤表单控制
   const location = useLocation();
   const [topicId, setTopicId] = useState('');
   const [showTreeCelebration, setShowTreeCelebration] = useState(false);
   
   // 从URL参数获取课题ID
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const topicIdParam = searchParams.get('topicId');
    if (topicIdParam) {
      setTopicId(topicIdParam);
      setFormData(prev => ({ ...prev, projectId: topicIdParam }));
      console.log('已关联课题ID:', topicIdParam);
    }
  }, [location.search]);
  
  // 表单状态和验证错误
  // 获取所有课题
  const [topics, setTopics] = useState<Project[]>([]);
  
  useEffect(() => {
    const allTopics = topicService.getAll();
    setTopics(allTopics);
  }, []);
  
  // 表单状态
  const [formData, setFormData] = useState({
    title: '',
    version: '1.0',
    author: '',
    department: '',
    category: '',
    purpose: '',
    scope: '',
    content: '',
    approvalStatus: 'draft',
    references: '',
    projectId: ''
  });
  
  // 模板选择状态
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  
  const [errors, setErrors] = useState({
    title: '',
    author: '',
    department: '',
    category: '',
    purpose: '',
    content: ''
  });
  
  // 获取实验类型分组
  const experimentCategories = getExperimentCategoriesByGroup();
  
  // SOP分类选项（更新为新的分类系统）
  const categories = [
    { id: '', name: '请选择分类' },
    ...Object.entries(experimentCategories).flatMap(([group, cats]) => 
      cats.map(({ category, name }) => ({ id: category, name: `${group} - ${name}` }))
    ),
    { id: 'other', name: '其他' }
  ];
  
  // 默认作者名（实际应用中可能从用户信息获取）
  useEffect(() => {
    setFormData(prev => ({ 
      ...prev, 
      author: '实验管理员',
      department: '研发部'
    }));
  }, []);
  
  // 表单验证 - 根据当前步骤验证不同字段
  const validateStep = (step: number): boolean => {
    const newErrors: typeof errors = { 
      title: '', author: '', department: '', category: '', purpose: '', content: '' 
    };
    let isValid = true;
    
    if (step === 1) {
      // 基本信息验证
      if (!formData.title.trim()) {
        newErrors.title = '文档标题不能为空';
        isValid = false;
      }
      
      if (!formData.author.trim()) {
        newErrors.author = '作者名称不能为空';
        isValid = false;
      }
      
      if (!formData.department.trim()) {
        newErrors.department = '部门不能为空';
        isValid = false;
      }
      
      if (!formData.category.trim()) {
        newErrors.category = '请选择分类';
        isValid = false;
      }
    } else if (step === 2) {
      // 目的和范围验证
      if (!formData.purpose.trim()) {
        newErrors.purpose = '目的描述不能为空';
        isValid = false;
      }
    } else if (step === 3) {
      // 内容验证
      if (!formData.content.trim()) {
        newErrors.content = 'SOP内容不能为空';
        isValid = false;
      }
    }
    
    setErrors(newErrors);
    return isValid;
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // 清除对应字段的错误提示
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name as keyof typeof errors]: '' }));
    }
  };
  
  // 应用SOP模板
  const applyTemplate = (templateId: string) => {
    const template = getSOPTemplateById(templateId);
    if (template) {
      setFormData(prev => ({
        ...prev,
        title: template.title,
        category: template.category,
        author: template.author,
        department: template.department,
        purpose: template.purpose,
        scope: template.scope,
        content: template.content,
        version: template.version
      }));
      setSelectedTemplate(templateId);
      setShowTemplates(false);
      toast.success(`已应用模板：${template.title}`);
    }
  };
  
  // 清除模板选择
  const clearTemplate = () => {
    setFormData({
      title: '',
      version: '1.0',
      author: '实验管理员',
      department: '研发部',
      category: '',
      purpose: '',
      scope: '',
      content: '',
      approvalStatus: 'draft',
      references: '',
      projectId: topicId
    });
    setSelectedTemplate('');
    toast.info('已清除模板内容');
  };
  
  // 处理步骤导航
  const handleNextStep = () => {
    if (validateStep(formStep)) {
      setFormStep(prev => prev + 1);
      // 滚动到顶部
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  
  const handlePrevStep = () => {
    setFormStep(prev => prev - 1);
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 验证当前步骤
    if (!validateStep(formStep)) return;
    
    try {
      setIsSubmitting(true);
      
      // 创建新SOP文档 - 合并所有表单数据
      const newSOP = sopService.create({
        title: formData.title,
        version: formData.version,
        author: formData.author,
        department: formData.department,
        category: formData.category,
        purpose: formData.purpose,
        scope: formData.scope,
        content: formData.content,
        approvalStatus: formData.approvalStatus as 'draft' | 'pending' | 'approved' | 'rejected',
                       references: formData.references,
                       projectId: formData.projectId
      });
      
      if (newSOP) {
        toast.success('SOP文档创建成功');
        
        // 显示种树庆祝动画
        setShowTreeCelebration(true);
        
        // 延迟导航以确保用户看到成功提示
        setTimeout(() => {
          navigate('/sops');
        }, 3500); // 留出时间观看动画
      } else {
        toast.error('创建SOP文档失败，请重试');
        setIsSubmitting(false);
      }
    } catch (error) {
      toast.error('创建SOP文档失败，请重试');
      console.error('创建SOP文档失败:', error);
      setIsSubmitting(false);
    }
  };
  
  // 渲染步骤指示器
  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
          {formStep === 1 && '基本信息'}
          {formStep === 2 && '目的与范围'}
          {formStep === 3 && '操作流程'}
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          步骤 {formStep}/3
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${(formStep / 3) * 100}%` }}
        ></div>
      </div>
      <div className="flex justify-between mt-1">
        <span className={`text-xs ${formStep >= 1 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
          基本信息
        </span>
        <span className={`text-xs ${formStep >= 2 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
          目的与范围
        </span>
        <span className={`text-xs ${formStep >= 3 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
          操作流程
        </span>
      </div>
    </div>
  );
  
  // 渲染表单内容
  const renderFormContent = () => {
    switch(formStep) {
      case 1:
        return (
          <div className="space-y-6 animate-fadeIn">
            {/* SOP模板选择区域 */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 flex items-center">
                  <i className="fa-solid fa-magic mr-2"></i>
                  使用SOP模板（可选）
                </h4>
                <button
                  type="button"
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-sm"
                >
                  {showTemplates ? '隐藏模板' : '显示模板'}
                </button>
              </div>
              
              {showTemplates && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                    {sopTemplates.map(template => (
                      <div
                        key={template.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-all ${
                          selectedTemplate === template.id
                            ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/40'
                            : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
                        }`}
                        onClick={() => applyTemplate(template.id)}
                      >
                        <h5 className="font-medium text-sm text-gray-800 dark:text-gray-200 mb-1">
                          {template.title}
                        </h5>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                          {template.purpose.substring(0, 80)}...
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {template.templateTags.slice(0, 3).map((tag, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {selectedTemplate && (
                    <div className="flex justify-between items-center pt-3 border-t border-blue-200 dark:border-blue-700">
                      <span className="text-sm text-blue-700 dark:text-blue-300">
                        已选择模板：{getSOPTemplateById(selectedTemplate)?.title}
                      </span>
                      <button
                        type="button"
                        onClick={clearTemplate}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 text-sm"
                      >
                        清除模板
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                文档标题 <span className="text-red-500">*</span>
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
                placeholder="输入SOP文档标题"
                aria-invalid={!!errors.title}
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
                  版本号
                </label>
                <input
                  type="text"
                  name="version"
                  value={formData.version}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                  placeholder="例如: 1.0"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  SOP文档的版本号，用于版本控制
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  作者 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="author"
                  value={formData.author}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
                    errors.author 
                      ? 'border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/20' 
                      : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                  } text-gray-800 dark:text-gray-200`}
                  placeholder="输入作者名称"
                  aria-invalid={!!errors.author}
                />
                {errors.author && (
                  <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center">
                    <i className="fa-solid fa-exclamation-circle mr-1"></i> {errors.author}
                  </p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  部门 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
                    errors.department 
                      ? 'border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/20' 
                      : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                  } text-gray-800 dark:text-gray-200`}
                  placeholder="输入部门名称"
                  aria-invalid={!!errors.department}
                />
                {errors.department && (
                  <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center">
                    <i className="fa-solid fa-exclamation-circle mr-1"></i> {errors.department}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  分类 <span className="text-red-500">*</span>
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
                  aria-invalid={!!errors.category}
                >
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
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
                 >
                   <option value="">-- 不关联课题 --</option>
                   {topics.map(topic => (
                     <option key={topic.id} value={topic.id}>{topic.title}</option>
                   ))}
                 </select>
               </div>
             </div>
          </div>
        );
        
      case 2:
        return (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                目的 <span className="text-red-500">*</span>
              </label>
              <textarea
                name="purpose"
                value={formData.purpose}
                onChange={handleChange}
                className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
                  errors.purpose 
                    ? 'border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/20' 
                    : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                } text-gray-800 dark:text-gray-200 min-h-[120px] resize-y`}
                placeholder="描述本SOP的目的和预期目标..."
                aria-invalid={!!errors.purpose}
              ></textarea>
              {errors.purpose && (
                <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center">
                  <i className="fa-solid fa-exclamation-circle mr-1"></i> {errors.purpose}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                适用范围
              </label>
              <textarea
                name="scope"
                value={formData.scope}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 min-h-[120px] resize-y"
                placeholder="描述本SOP适用的场景、人员和设备..."
              ></textarea>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                参考资料
              </label>
              <textarea
                name="references"
                value={formData.references}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 min-h-[80px] resize-y"
                placeholder="列出相关的参考文档、标准或法规..."
              ></textarea>
            </div>
          </div>
        );
        
      case 3:
        return (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                操作流程 <span className="text-red-500">*</span>
              </label>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-2 border border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  <i className="fa-solid fa-lightbulb mr-1"></i> 提示: 使用编号列表描述操作步骤，使流程更清晰。
                </p>
                <textarea
                  name="content"
                  value={formData.content}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
                    errors.content 
                      ? 'border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/20' 
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                  } text-gray-800 dark:text-gray-200 min-h-[350px] resize-y font-mono text-sm leading-relaxed`}
                  placeholder="1. 准备工作：检查设备状态和所需材料...
2. 操作步骤：详细描述每一步操作...
   a. 子步骤1...
   b. 子步骤2...
3. 注意事项：列出操作过程中的安全注意事项...
4. 收尾工作：清理工作区域和设备..."
                  aria-invalid={!!errors.content}
                ></textarea>
              </div>
              {errors.content && (
                <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center">
                  <i className="fa-solid fa-exclamation-circle mr-1"></i> {errors.content}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                审批状态
              </label>
              <select
                name="approvalStatus"
                value={formData.approvalStatus}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              >
                <option value="draft">草稿</option>
                <option value="pending">待审批</option>
                <option value="approved">已批准</option>
                <option value="rejected">已拒绝</option>
              </select>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header 
          title="创建SOP文档" 
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <Button onClick={() => navigate('/sops')} variant="outline" className="transition-all duration-200">
              <i className="fa-solid fa-arrow-left mr-2"></i>
              <span>返回列表</span>
            </Button>
          }
        />
        
        <main className="container mx-auto px-4 py-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 p-6 max-w-3xl mx-auto hover:shadow-lg transition-shadow duration-300"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 步骤指示器 */}
              {renderStepIndicator()}
              
              {/* 表单内容 */}
              {renderFormContent()}
              
              {/* 导航按钮 */}
              <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
                {formStep > 1 ? (
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={handlePrevStep}
                    disabled={isSubmitting}
                    className="transition-all duration-200"
                  >
                    <i className="fa-solid fa-arrow-left mr-2"></i>
                    上一步
                  </Button>
                ) : (
                  <div></div> // 占位元素，保持按钮对齐
                )}
                
                {formStep < 3 ? (
                  <Button 
                    type="button" 
                    onClick={handleNextStep}
                    disabled={isSubmitting}
                    className="transition-all duration-200 ml-auto"
                  >
                    下一步
                    <i className="fa-solid fa-arrow-right ml-2"></i>
                  </Button>
                ) : (
                  <Button 
                    type="submit"
                    disabled={isSubmitting}
                    className="transition-all duration-200 ml-auto"
                  >
                    {isSubmitting ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                        保存中...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-save mr-2"></i>
                        保存文档
                      </>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </motion.div>
        </main>
      </div>
          
      {/* 种树庆祝动画 */}
      <TreePlantingCelebration
        isVisible={showTreeCelebration}
        type="sop"
        onClose={() => setShowTreeCelebration(false)}
      />
    </div>
  );
}