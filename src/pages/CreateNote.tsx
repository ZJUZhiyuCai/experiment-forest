import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { experimentNoteService, experimentRecordService } from '@/lib/cachedStorage';
import { ExperimentRecord, ExperimentNote } from '@/types';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/Button';
import { TreePlantingCelebration } from '@/components/TreePlantingCelebration';
import { EnhancedInput, EnhancedFormContainer } from '@/components/EnhancedForm';





export default function CreateNote() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [records, setRecords] = useState<ExperimentRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTreeCelebration, setShowTreeCelebration] = useState(false);
  const [existingNote, setExistingNote] = useState<ExperimentNote | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // 判断是编辑模式还是创建模式
  const isEditMode = !!id;

  // 表单状态和验证错误
  const [formData, setFormData] = useState({
    title: '',
    relatedRecordId: '',
    content: ''
  });

  const [errors, setErrors] = useState({
    title: '',
    content: ''
  });

  useEffect(() => {
    // 获取所有实验记录（用于关联选择）
    const allRecords = experimentRecordService.getAll();
    setRecords(allRecords);

    // 如果是编辑模式，加载现有笔记
    if (isEditMode && id) {
      setLoading(true);
      try {
        const note = experimentNoteService.getById(id);
        if (note) {
          setExistingNote(note);
          setFormData({
            title: note.title,
            relatedRecordId: note.relatedRecordId || '',
            content: note.content
          });
        } else {
          toast.error('未找到要编辑的笔记');
          navigate('/notes');
        }
      } catch (error) {
        console.error('加载笔记失败:', error);
        toast.error('加载笔记失败');
        navigate('/notes');
      } finally {
        setLoading(false);
      }
    }
  }, [id, isEditMode, navigate]);

  // 表单验证
  const validateForm = (): boolean => {
    const newErrors: typeof errors = { title: '', content: '' };
    let isValid = true;

    if (!formData.title.trim()) {
      newErrors.title = '笔记标题不能为空';
      isValid = false;
    }

    if (!formData.content.trim()) {
      newErrors.content = '笔记内容不能为空';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  // 原有的handleChange函数，已更换为直接在组件中传递onChange
  // const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  //   const { name, value } = e.target;
  //   setFormData(prev => ({ ...prev, [name]: value }));
  //   
  //   // 清除对应字段的错误提示
  //   if (errors[name as keyof typeof errors]) {
  //     setErrors(prev => ({ ...prev, [name]: '' }));
  //   }
  // };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 表单验证
    if (!validateForm()) {
      return;
    }

    // 检查内容是否为空（修复潜在的空格提交问题）
    if (!formData.content.trim()) {
      setErrors(prev => ({ ...prev, content: '笔记内容不能为空' }));
      return;
    }

    try {
      setIsSubmitting(true);

      if (isEditMode && existingNote) {
        // 更新现有笔记
        const updatedNote = experimentNoteService.update(existingNote.id, {
          title: formData.title,
          relatedRecordId: formData.relatedRecordId || undefined,
          content: formData.content
        });

        if (updatedNote) {
          toast.success('实验笔记更新成功');
          navigate('/notes');
        } else {
          toast.error('更新实验笔记失败，请重试');
          setIsSubmitting(false);
        }
      } else {
        // 创建新实验笔记
        const newNote = experimentNoteService.create({
          title: formData.title,
          relatedRecordId: formData.relatedRecordId || undefined,
          content: formData.content
        });

        if (newNote) {
          toast.success('实验笔记创建成功');

          // 显示种树庆祝动画
          setShowTreeCelebration(true);

          // 延迟导航以确保用户看到成功提示
          setTimeout(() => {
            navigate('/notes');
          }, 3500); // 留出时间观看动画
        } else {
          toast.error('创建实验笔记失败，请重试');
          setIsSubmitting(false);
        }
      }
    } catch (error) {
      toast.error(isEditMode ? '更新实验笔记失败，请重试' : '创建实验笔记失败，请重试');
      console.error(isEditMode ? '更新实验笔记失败:' : '创建实验笔记失败:', error);
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-earth-beige flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mb-4"></div>
          <p className="text-text-main">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-earth-beige text-text-main">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header
          title={isEditMode ? '编辑实验笔记' : '创建实验笔记'}
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <Button onClick={() => navigate('/notes')} variant="outline">
              <i className="fa-solid fa-arrow-left mr-2"></i>
              <span>返回列表</span>
            </Button>
          }
        />

        <main className="container mx-auto px-4 py-6">
          <EnhancedFormContainer
            title={isEditMode ? '编辑实验笔记' : '创建实验笔记'}
            subtitle={isEditMode ? '修改笔记的详细信息' : '记录您的实验观察和想法'}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitText={isEditMode ? '更新笔记' : '保存笔记'}
            onCancel={() => navigate('/notes')}
          >
            <EnhancedInput
              label="笔记标题"
              value={formData.title}
              onChange={(value) => setFormData(prev => ({ ...prev, title: value }))}
              error={errors.title}
              icon="fa-sticky-note"
              required
              placeholder="输入笔记标题"
            />

            <EnhancedInput
              label="关联实验记录"
              type="select"
              value={formData.relatedRecordId}
              onChange={(value) => setFormData(prev => ({ ...prev, relatedRecordId: value }))}
              icon="fa-link"
              options={[
                { value: '', label: '-- 不关联实验记录 --' },
                ...records.map(record => ({ value: record.id, label: record.title }))
              ]}
            />

            <EnhancedInput
              label="笔记内容"
              type="textarea"
              value={formData.content}
              onChange={(value) => setFormData(prev => ({ ...prev, content: value }))}
              error={errors.content}
              icon="fa-file-alt"
              required
              placeholder="记录实验中的观察、想法、问题或其他重要信息..."
            />
          </EnhancedFormContainer>
        </main>
      </div>

      {/* 种树庆祝动画 */}
      <TreePlantingCelebration
        isVisible={showTreeCelebration}
        type="note"
        onClose={() => setShowTreeCelebration(false)}
      />
    </div>
  );
}