import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { projectService, experimentRecordService, experimentNoteService, sopService } from '@/lib/cachedStorage';
import { Project } from '@/types';
import { mindMapAIService, MindMapGenerationOptions } from '@/lib/mindMapAIService';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { Button } from '@/components/Button';
import * as d3 from 'd3';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import { select } from 'd3-selection';
import { drag } from 'd3-drag';

// 节点类型定义
interface MindMapNode {
  id: string;
  type: 'project' | 'record' | 'note' | 'sop';
  title: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  category?: string;
  status?: string;
  color: string;
}

// 连接线定义
interface MindMapLink {
  source: string;
  target: string;
}

export default function TopicMindMap() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [links, setLinks] = useState<MindMapLink[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  
  // AI生成相关状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerationOptions, setShowGenerationOptions] = useState(false);
  const [generationOptions, setGenerationOptions] = useState<MindMapGenerationOptions>({
    includeExperiments: true,
    includeNotes: true,
    includeSOPs: true,
    maxNodes: 30,
    style: 'hierarchical',
    detailLevel: 'detailed'
  });
  const [hasAIGenerated, setHasAIGenerated] = useState(false);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<MindMapNode, MindMapLink> | null>(null);
  
  // 颜色配置
  const nodeColors = {
    project: '#8B5CF6',      // 紫色 - 课题
    record: '#10B981',       // 绿色 - 实验记录
    note: '#F59E0B',         // 橙色 - 笔记
    sop: '#3B82F6',          // 蓝色 - SOP
  };

  // 加载数据
  useEffect(() => {
    if (!id) {
      navigate('/projects');
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        
        const projectData = projectService.getById(id);
        if (!projectData) {
          toast.error('未找到该课题');
          navigate('/projects');
          return;
        }
        
        setProject(projectData);
        
        const records = experimentRecordService.getAll().filter(r => r.projectId === id);
        const notes = experimentNoteService.getAll().filter(n => n.projectId === id);
        const sops = sopService.getAll().filter(s => s.projectId === id);
        
        const nodeList: MindMapNode[] = [
          {
            id: projectData.id,
            type: 'project',
            title: projectData.title,
            color: nodeColors.project,
            status: projectData.status
          },
          ...records.map((record): MindMapNode => ({
            id: record.id,
            type: 'record',
            title: record.title,
            color: nodeColors.record,
            category: record.category,
            status: record.status
          })),
          ...notes.map((note): MindMapNode => ({
            id: note.id,
            type: 'note',
            title: note.title,
            color: nodeColors.note
          })),
          ...sops.map((sop): MindMapNode => ({
            id: sop.id,
            type: 'sop',
            title: sop.title,
            color: nodeColors.sop,
            status: sop.approvalStatus
          }))
        ];
        
        const linkList: MindMapLink[] = nodeList
          .filter(node => node.type !== 'project')
          .map(node => ({
            source: projectData.id,
            target: node.id
          }));
        
        notes.forEach(note => {
          if (note.relatedRecordId && records.find(r => r.id === note.relatedRecordId)) {
            linkList.push({
              source: note.relatedRecordId,
              target: note.id
            });
          }
        });
        
        setNodes(nodeList);
        setLinks(linkList);
        
      } catch (error) {
        console.error('加载思维导图数据失败:', error);
        toast.error('加载数据失败');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [id, navigate]);

  // AI生成思维导图
  const handleAIGeneration = async () => {
    if (!project || !id) {
      toast.error('课题信息不完整');
      return;
    }

    setIsGenerating(true);
    setShowGenerationOptions(false);

    try {
      const records = experimentRecordService.getAll().filter(r => r.projectId === id);
      const notes = experimentNoteService.getAll().filter(n => n.projectId === id);
      const sops = sopService.getAll().filter(s => s.projectId === id);

      const generatedMindMap = await mindMapAIService.generateProjectMindMap(
        project,
        records,
        notes,
        sops,
        generationOptions
      );

      const convertedNodes: MindMapNode[] = generatedMindMap.nodes.map(node => ({
        id: node.id,
        type: mapNodeTypeToLocal(node.relatedType || 'experiment'),
        title: node.title,
        color: getNodeColor(node.relatedType || 'experiment'),
        category: node.type as string,
        status: 'active'
      }));

      const convertedLinks: MindMapLink[] = generatedMindMap.edges.map(edge => ({
        source: edge.source,
        target: edge.target
      }));

      setNodes(convertedNodes);
      setLinks(convertedLinks);
      setHasAIGenerated(true);

      toast.success(`AI成功生成了包含 ${generatedMindMap.nodes.length} 个节点的思维导图！`);

    } catch (error) {
      console.error('AI生成失败:', error);
      toast.error(error instanceof Error ? error.message : 'AI生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  // 类型映射函数
  const mapNodeTypeToLocal = (relatedType: string): 'project' | 'record' | 'note' | 'sop' => {
    const mapping: Record<string, 'project' | 'record' | 'note' | 'sop'> = {
      'project': 'project',
      'experiment': 'record',
      'sample': 'record',
      'note': 'note',
      'sop': 'sop'
    };
    return mapping[relatedType] || 'record';
  };

  const getNodeColor = (relatedType: string): string => {
    const colors: Record<string, string> = {
      'project': nodeColors.project,
      'experiment': nodeColors.record,
      'sample': nodeColors.record,
      'note': nodeColors.note,
      'sop': nodeColors.sop
    };
    return colors[relatedType] || nodeColors.record;
  };

  // 重新生成原始数据
  const handleResetToOriginal = () => {
    if (!id || !project) return;

    const records = experimentRecordService.getAll().filter(r => r.projectId === id);
    const notes = experimentNoteService.getAll().filter(n => n.projectId === id);
    const sops = sopService.getAll().filter(s => s.projectId === id);

    const nodeList: MindMapNode[] = [
      {
        id: project.id,
        type: 'project',
        title: project.title,
        color: nodeColors.project,
        status: project.status
      },
      ...records.map((record): MindMapNode => ({
        id: record.id,
        type: 'record',
        title: record.title,
        color: nodeColors.record,
        category: record.category,
        status: record.status
      })),
      ...notes.map((note): MindMapNode => ({
        id: note.id,
        type: 'note',
        title: note.title,
        color: nodeColors.note
      })),
      ...sops.map((sop): MindMapNode => ({
        id: sop.id,
        type: 'sop',
        title: sop.title,
        color: nodeColors.sop,
        status: sop.approvalStatus
      }))
    ];

    const linkList: MindMapLink[] = nodeList
      .filter(node => node.type !== 'project')
      .map(node => ({
        source: project.id,
        target: node.id
      }));

    setNodes(nodeList);
    setLinks(linkList);
    setHasAIGenerated(false);
    toast.success('已恢复到原始数据结构');
  };

  // 初始化D3力导向图
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0 || isSimulating) return;

    setIsSimulating(true);
    
    const svg = select(svgRef.current);
    const width = 800;
    const height = 600;
    
    svg.selectAll("*").remove();
    
    const simulation = forceSimulation(nodes)
      .force('link', forceLink(links).id((d: any) => d.id).distance(80))
      .force('charge', forceManyBody().strength(-300))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collision', forceCollide().radius(35));
    
    simulationRef.current = simulation;
    
    const link = svg.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2);
    
    const node = svg.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer');
    
    (node as any).append('circle')
      .attr('r', (d: any) => d.type === 'project' ? 30 : 20)
      .attr('fill', (d: any) => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);
    
    (node as any).append('text')
      .text((d: MindMapNode) => d.title.length > 12 ? d.title.substring(0, 12) + '...' : d.title)
      .attr('dy', (d: MindMapNode) => d.type === 'project' ? 40 : 30)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', (d: MindMapNode) => d.type === 'project' ? 'bold' : 'normal')
      .attr('fill', '#333');
    
    const dragBehavior = drag() as any;
    dragBehavior
      .on('start', (event: any, d: any) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event: any, d: any) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event: any, d: any) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    
    (node as any).call(dragBehavior);
    
    (node as any).on('click', (_event: any, d: MindMapNode) => {
      switch (d.type) {
        case 'project':
          navigate(`/projects/${d.id}`);
          break;
        case 'record':
          navigate(`/records/${d.id}`);
          break;
        case 'note':
          navigate(`/notes/${d.id}`);
          break;
        case 'sop':
          navigate(`/sops/${d.id}`);
          break;
      }
    });
    
    (node as any).on('mouseover', function(this: any, _event: any, d: any) {
      select(this).select('circle')
        .transition()
        .duration(200)
        .attr('r', d.type === 'project' ? 35 : 25);
    })
    .on('mouseout', function(this: any, _event: any, d: any) {
      select(this).select('circle')
        .transition()
        .duration(200)
        .attr('r', d.type === 'project' ? 30 : 20);
    });
    
    simulation.on('tick', () => {
      (link as any)
        .attr('x1', (d: any) => (d.source as any).x)
        .attr('y1', (d: any) => (d.source as any).y)
        .attr('x2', (d: any) => (d.target as any).x)
        .attr('y2', (d: any) => (d.target as any).y);
      
      (node as any).attr('transform', (d: any) => `translate(${d.x || 0},${d.y || 0})`);
    });
    
    simulation.on('end', () => {
      setIsSimulating(false);
    });
    
    return () => {
      simulation.stop();
    };
  }, [nodes, links, navigate, isSimulating]);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F6F2] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">加载思维导图中...</p>
        </div>
      </div>
    );
  }
  
  if (!project) {
    return (
      <div className="min-h-screen bg-[#F9F6F2] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">未找到该课题</p>
          <Link to="/projects" className="text-blue-600 hover:underline">
            返回课题列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F6F2] text-[#555555]">
      <Sidebar 
        isCollapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />
      
      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header 
          title="思维导图 - 由小森博士AI生成" 
          sidebarCollapsed={sidebarCollapsed} 
          actions={
            <div className="flex items-center space-x-3">
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setShowGenerationOptions(!showGenerationOptions)}
                disabled={isGenerating}
                className="relative"
              >
                <i className={`fa-solid fa-magic mr-2 ${isGenerating ? 'animate-spin' : ''}`}></i>
                {isGenerating ? 'AI生成中...' : 'AI生成'}
              </Button>
              
              {hasAIGenerated && (
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={handleResetToOriginal}
                  className="text-orange-600 hover:text-orange-700 border-orange-300 hover:border-orange-400"
                >
                  <i className="fa-solid fa-undo mr-2"></i>
                  还原原始
                </Button>
              )}
              
              <Button variant="outline" size="sm" asChild>
                <Link to={`/topics/${id}`}>
                  <i className="fa-solid fa-arrow-left mr-2"></i>
                  返回课题
                </Link>
              </Button>
            </div>
          }
        />
        
        <div className="p-6">
          {/* AI生成配置面板 */}
          <AnimatePresence>
            {showGenerationOptions && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6"
              >
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  🤖 小森博士 - AI思维导图生成配置
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-700">包含内容</h4>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={generationOptions.includeExperiments}
                          onChange={(e) => setGenerationOptions(prev => ({
                            ...prev,
                            includeExperiments: e.target.checked
                          }))}
                          className="mr-2 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-gray-600">实验记录</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={generationOptions.includeNotes}
                          onChange={(e) => setGenerationOptions(prev => ({
                            ...prev,
                            includeNotes: e.target.checked
                          }))}
                          className="mr-2 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-gray-600">研究笔记</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={generationOptions.includeSOPs}
                          onChange={(e) => setGenerationOptions(prev => ({
                            ...prev,
                            includeSOPs: e.target.checked
                          }))}
                          className="mr-2 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-gray-600">SOP文档</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-700">布局样式</h4>
                    <select
                      value={generationOptions.style}
                      onChange={(e) => setGenerationOptions(prev => ({
                        ...prev,
                        style: e.target.value as any
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                    >
                      <option value="hierarchical">层次化</option>
                      <option value="radial">放射状</option>
                      <option value="network">网络状</option>
                    </select>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-700">详细程度</h4>
                    <select
                      value={generationOptions.detailLevel}
                      onChange={(e) => setGenerationOptions(prev => ({
                        ...prev,
                        detailLevel: e.target.value as any
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                    >
                      <option value="basic">基本</option>
                      <option value="detailed">详细</option>
                      <option value="comprehensive">全面</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    最大节点数：
                    <input
                      type="number"
                      value={generationOptions.maxNodes}
                      onChange={(e) => setGenerationOptions(prev => ({
                        ...prev,
                        maxNodes: Math.max(10, Math.min(100, parseInt(e.target.value) || 30))
                      }))}
                      className="ml-2 w-16 px-2 py-1 border border-gray-300 rounded text-center focus:ring-1 focus:ring-emerald-500"
                      min="10"
                      max="100"
                    />
                  </div>
                  
                  <div className="flex space-x-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowGenerationOptions(false)}
                    >
                      取消
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAIGeneration}
                      disabled={isGenerating || (!generationOptions.includeExperiments && !generationOptions.includeNotes && !generationOptions.includeSOPs)}
                      className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
                    >
                      <i className="fa-solid fa-magic mr-2"></i>
                      开始生成
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
                🧠 课题思维导图: {project.title}
                {hasAIGenerated && (
                  <span className="ml-3 px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded-full">
                    AI生成
                  </span>
                )}
              </h1>
              <p className="text-gray-600">
                {hasAIGenerated 
                  ? '小森博士基于课题数据智能生成的思维导图，展示知识结构和关联关系'
                  : '可视化展示课题与相关实验记录、笔记、SOP的关系'
                }
              </p>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">图例</h3>
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: nodeColors.project }}></div>
                <span>课题</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: nodeColors.record }}></div>
                <span>实验记录</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: nodeColors.note }}></div>
                <span>实验笔记</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: nodeColors.sop }}></div>
                <span>SOP文档</span>
              </div>
            </div>
            
            <div className="flex gap-4 mt-3 text-xs text-gray-500">
              <span>节点数: {nodes.length}</span>
              <span>连接数: {links.length}</span>
              {hasAIGenerated && (
                <span className="text-emerald-600">✨ AI智能生成</span>
              )}
            </div>
          </div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-sm overflow-hidden"
          >
            <div className="p-4 border-b">
              <div className="flex justify-between items-center">
                <h3 className="font-medium text-gray-800">思维导图</h3>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-600">
                    节点数量: {nodes.length} | 连接数: {links.length}
                  </div>
                  {hasAIGenerated && (
                    <span className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded-full">
                      ✨ AI智能生成
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="relative" style={{ height: '600px' }}>
              {isGenerating ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mb-4"></div>
                    <p className="text-gray-600">AI正在生成思维导图...</p>
                    <p className="text-sm text-gray-500 mt-1">请稍候，这可能需要几分钟时间</p>
                  </div>
                </div>
              ) : (
                <svg
                  ref={svgRef}
                  width="100%"
                  height="100%"
                  viewBox="0 0 800 600"
                  style={{ background: '#fafafa' }}
                />
              )}
              
              {nodes.length === 1 && !isGenerating && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <p className="mb-2">暂无关联的实验记录、笔记或SOP</p>
                    <p className="text-sm mb-4">使用AI生成功能创建智能化思维导图，或添加相关数据：</p>
                    <div className="space-x-4">
                      <Link to={`/projects/${id}/records`} className="text-blue-600 hover:underline">
                        添加实验记录
                      </Link>
                      <Link to={`/projects/${id}/notes`} className="text-blue-600 hover:underline">
                        添加笔记
                      </Link>
                      <Link to={`/projects/${id}/sops`} className="text-blue-600 hover:underline">
                        添加SOP
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
          
          <div className="mt-4 text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p>💡 操作提示:</p>
            <ul className="mt-1 ml-4 list-disc text-xs">
              <li>点击节点可跳转到对应的详情页面</li>
              <li>拖拽节点可调整布局位置</li>
              <li>悬停在节点上可查看详细信息</li>
              {!hasAIGenerated && (
                <li className="text-emerald-600 font-medium">点击"AI生成"按钮，让小森博士为您智能创建思维导图</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}