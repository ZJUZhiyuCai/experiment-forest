import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from './Button';
import { fixJson } from '@/lib/utils';
import { MindMapNode } from '@/lib/mockAI';
import { analyzeTopic } from '@/lib/mockAI';

interface AIAnalysisModalProps {
  visible: boolean;
  onClose: () => void;
  onInsert: (content: string) => void;
}

export function AIAnalysisModal({ visible, onClose, onInsert }: AIAnalysisModalProps) {
  // 获取AI设置状态
  const [aiSettings, setAiSettings] = useState(() => {
    const saved = localStorage.getItem('aiSettings');
    return saved ? JSON.parse(saved) : { useCustomAPI: false };
  });
  
  // 监听localStorage变化以更新AI设置状态
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('aiSettings');
      setAiSettings(saved ? JSON.parse(saved) : { useCustomAPI: false });
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  
  // 添加ESC键关闭模态框的支持
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        console.log('ESC key pressed to close modal');
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);
  
  const [topic, setTopic] = useState('');
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  
  // 确保onClose是稳定的引用
  const stableOnClose = useCallback(() => {
    console.log('AIAnalysisModal: Closing modal');
    onClose();
  }, [onClose]);
  
  // 处理AI分析
  const handleAnalyze = async () => {
    if (!topic.trim()) {
      setError('请输入课题名称');
      return;
    }
    
    setError('');
    setIsAnalyzing(true);
    
      try {
        // 获取AI设置
        const aiSettings = JSON.parse(localStorage.getItem('aiSettings') || '{"useCustomAPI": false}');
        
        // 检查是否启用了自定义API但未配置完整
        if (aiSettings.useCustomAPI && (!aiSettings.apiEndpoint || !aiSettings.apiKey || !aiSettings.model)) {
          setError('API配置不完整，请检查设置');
          toast.error('API配置不完整，请检查设置');
          setIsAnalyzing(false);
          return;
        }
        
         // 调用AI分析服务
         const result = await analyzeTopic(topic);
         
         // 验证AI返回结果的基本结构
         if (!result || typeof result !== 'object') {
           throw new Error('AI返回结果结构无效');
         }
        setAnalysisResult(result);
        
        // 分析完成后自动插入结果并关闭模态框
        handleInsert();
        
        // 显示成功提示
         toast.success('AI分析完成，内容已自动填充');
      } catch (err) {
           // 增强错误处理和用户反馈
           const errorMessage = err instanceof Error 
             ? `分析失败: ${err.message}` 
             : '分析失败，请检查AI配置或尝试使用不同的课题名称';
           setError(errorMessage);
           console.error('AI分析失败详情:', err);
           toast.error(errorMessage);
      } finally {
        setIsAnalyzing(false);
      }
  };
  
    // 直接保存分析内容
    const handleInsert = () => {
      if (!analysisResult) return;
      
      try {
           // 将分析结果转换为JSON字符串
           let analysisContent;
           try {
             analysisContent = JSON.stringify(analysisResult);
           } catch (stringifyError) {
             console.error('Failed to stringify analysis result:', stringifyError);
             toast.error('分析结果格式错误，无法序列化');
             return;
           }
           
           // 调用回调函数插入内容
           onInsert(analysisContent);
           toast.success("AI分析结果已保存");
           
           // 添加延迟确保动画完成后再关闭
           setTimeout(() => {
             stableOnClose();
           }, 500);
       } catch (error) {
         console.error("保存内容失败:", error);
         const errorMessage = error instanceof Error ? error.message : "未知错误";
         toast.error(`保存失败: ${errorMessage}`);
       }
     };
   
  // 重置分析
  const handleReset = () => {
    setTopic('');
    setAnalysisResult(null);
    setError('');
  };
  
  // 添加模态框引用
  const modalRef = useRef<HTMLDivElement>(null);
  
  // 强制关闭函数，作为最后的备选方案
  const forceClose = () => {
    console.log('Force closing modal through emergency mechanism');
    
    // 1. Try regular close first
    stableOnClose();
    
    // 2. Direct DOM manipulation fallback
    if (modalRef.current) {
      modalRef.current.style.display = 'none';
    }
    
    // 3. Additional safety measure - navigate away if needed
    setTimeout(() => {
      // Only navigate if modal is still visible
      if (visible) {
        toast.error('检测到模态框关闭异常，已自动跳转');
        window.location.href = '/records';
      }
    }, 1000);
  };
  
  return (
    <div ref={modalRef}>
      {/* Emergency close button - always visible */}
      <button
        onClick={forceClose}
        className="fixed top-4 right-4 bg-red-500 text-white p-3 rounded-full shadow-lg z-[200]"
        aria-label="Emergency close"
      >
        <i className="fa-solid fa-times text-xl"></i>
      </button>
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[150] p-4"
        onClick={forceClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-white rounded-xl shadow-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* 顶部栏 - 增加关闭按钮的可点击区域 */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">AI课题分析</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                输入课题名称，AI将为您分析并生成实验方案
              </p>
            </div>
            <Button 
              type="button"
              variant="outline"
              size="sm"
              onClick={stableOnClose}
              className="ml-4 z-10 bg-white/80 hover:bg-white p-2" // 增加内边距，扩大点击区域
            >
              <i className="fa-solid fa-times text-lg"></i>
            </Button>
          </div>
          
          <div className="p-6 flex-1 overflow-auto">
            {!analysisResult ? (
              <div className="space-y-6">
                 {/* API配置状态显示 */}
                 <div className={`
                   ${(aiSettings.apiEndpoint && aiSettings.apiKey && aiSettings.model 
                     ? "bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800" 
                     : "bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800")}
                 rounded-lg p-4`}>
                   <div className="flex items-start">
                     <i className={`fa-solid ${
                       (aiSettings.apiEndpoint && aiSettings.apiKey && aiSettings.model 
                         ? "fa-check-circle text-green-500" 
                         : "fa-exclamation-circle text-red-500")
                     } mt-0.5 mr-3 text-lg`}></i>
                     <div className="flex-1">
                       <h4 className={`font-medium ${
                         (aiSettings.apiEndpoint && aiSettings.apiKey && aiSettings.model 
                           ? "text-green-800 dark:text-green-300" 
                           : "text-red-800 dark:text-red-300")
                       }`}>
                         {(aiSettings.apiEndpoint && aiSettings.apiKey && aiSettings.model 
                           ? "AI API已配置" 
                           : "API配置不完整")}
                       </h4>
                       <p className={`text-sm ${
                         (aiSettings.apiEndpoint && aiSettings.apiKey && aiSettings.model 
                           ? "text-green-700 dark:text-green-400" 
                           : "text-red-700 dark:text-red-400")
                       } mt-1`}>
                         {(aiSettings.apiEndpoint && aiSettings.apiKey && aiSettings.model 
                           ? `当前使用: ${aiSettings.model}` 
                           : "请完成API端点、密钥和模型的配置")}
                       </p>
                       <div className="mt-3 flex justify-end">
                         <Button 
                           variant="outline"
                           size="sm"
                           onClick={() => {
                             stableOnClose();
                             window.location.href = '/settings#ai-api-settings';
                           }}
                           className={(aiSettings.apiEndpoint && aiSettings.apiKey && aiSettings.model 
                             ? "text-green-700 dark:text-green-300 border-green-300 dark:border-green-700" 
                             : "text-red-700 dark:text-red-300 border-red-300 dark:border-red-700")}
                         >
                           <i className="fa-solid fa-cog mr-1"></i> 管理API
                         </Button>
                       </div>
                     </div>
                   </div>
                 </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    课题名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      error ? 'border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/20' : 
                      'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                    } text-gray-800 dark:text-gray-200`}
                    placeholder="例如：细胞分裂观察实验"
                  />
                  {error && (
                    <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center">
                      <i className="fa-solid fa-exclamation-circle mr-1"></i> {error}
                    </p>
                  )}
                </div>
                
                <div className="pt-4">
                  <Button 
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !topic.trim()}
                    className="w-full"
                  >
                    {isAnalyzing ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                        分析中...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-lightbulb mr-2"></i>
                        开始AI分析
                      </>
                    )}
                  </Button>
                </div>
                
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-100 dark:border-emerald-800">
                  <h4 className="font-medium text-emerald-700 dark:text-emerald-300 mb-2">
                    <i className="fa-solid fa-info-circle mr-2"></i>AI分析功能说明
                  </h4>
                  <ul className="text-sm text-emerald-600 dark:text-emerald-400 space-y-1">
                    <li>• 输入您的实验课题，AI将自动生成结构化分析结果</li>
                    <li>• 分析结果包含研究背景、实验设计、预期成果等模块</li>
                  </ul>
                </div>
                
                {/* 紧急关闭按钮 - 作为最后的备选方案 */}
                <div className="text-center pt-2">
                  <button
                    onClick={forceClose}
                    className="text-sm text-red-500 hover:text-red-700 underline"
                  >
                    无法关闭？点击这里强制关闭
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                    {topic} - AI分析结果
                  </h4>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg max-h-[400px] overflow-auto">
                    <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
{JSON.stringify(analysisResult, null, 2)}
                    </pre>
                  </div>
                </div>
                
                <div className="flex space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={stableOnClose}
                    className="flex-1"
                  >
                    <i className="fa-solid fa-times mr-2"></i>
                    关闭
                  </Button>
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={handleReset}
                    className="flex-1"
                  >
                    <i className="fa-solid fa-rotate-left mr-2"></i>
                    重新分析
                  </Button>
                  <Button 
                    onClick={handleInsert}
                    className="flex-1"
                  >
                    <i className="fa-solid fa-file-import mr-2"></i>
                    保存分析结果
                  </Button>
                </div>
                
                {/* 紧急关闭按钮 - 作为最后的备选方案 */}
                <div className="text-center pt-2">
                  <button
                    onClick={forceClose}
                    className="text-sm text-red-500 hover:text-red-700 underline"
                  >
                    无法关闭？点击这里强制关闭
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}