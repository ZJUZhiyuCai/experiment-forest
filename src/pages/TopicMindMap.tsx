import { useState, useCallback, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  Node,
  Edge,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toast } from 'sonner';
import { projectService, experimentRecordService, experimentNoteService, sopService } from '@/lib/cachedStorage';
import { Project } from '@/types';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import CustomNode from '@/components/mindmap/CustomNode';
import { getLayoutedElements } from '@/lib/mindMapLayout';
import { mindMapAIService, MindMapGenerationOptions } from '@/lib/mindMapAIService';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const nodeTypes = {
  custom: CustomNode,
};

export default function TopicMindMap() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // AI Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerationOptions, setShowGenerationOptions] = useState(false);
  const [hasAIGenerated, setHasAIGenerated] = useState(false);
  const [generationOptions, setGenerationOptions] = useState<MindMapGenerationOptions>({
    includeExperiments: true,
    includeNotes: true,
    includeSOPs: true,
    maxNodes: 30,
    style: 'hierarchical',
    detailLevel: 'detailed'
  });

  const loadData = useCallback(() => {
    if (!id) return;
    setLoading(true);
    try {
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

      const initialNodes: Node[] = [];
      const initialEdges: Edge[] = [];

      // Root Node (Project)
      initialNodes.push({
        id: projectData.id,
        type: 'custom',
        data: { label: projectData.title, type: 'project', subLabel: `进度: ${projectData.progress}%` },
        position: { x: 0, y: 0 },
      });

      // Helper to add nodes and edges
      const addNodeAndEdge = (item: any, type: string, label: string) => {
        initialNodes.push({
          id: item.id,
          type: 'custom',
          data: { label, type, subLabel: item.status || 'Active' },
          position: { x: 0, y: 0 },
        });
        initialEdges.push({
          id: `e-${projectData.id}-${item.id}`,
          source: projectData.id,
          target: item.id,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#d1d5db' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#d1d5db' },
        });
      };

      records.forEach(r => addNodeAndEdge(r, 'record', r.title));
      notes.forEach(n => addNodeAndEdge(n, 'note', n.title));
      sops.forEach(s => addNodeAndEdge(s, 'sop', s.title));

      // Apply Layout
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        initialNodes,
        initialEdges,
        'LR' // Left to Right layout
      );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    } catch (error) {
      console.error(error);
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, setNodes, setEdges]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    if (node.data.type === 'project') return;

    // Improved navigation handling
    const pathMap: Record<string, string> = {
      record: 'records',
      note: 'notes',
      sop: 'sops'
    };

    if (pathMap[node.data.type]) {
      navigate(`/${pathMap[node.data.type]}/${node.id}`);
    }
  };

  const handleAIGeneration = async () => {
    if (!project || !id) return;
    setIsGenerating(true);
    setShowGenerationOptions(false);

    try {
      const records = experimentRecordService.getAll().filter(r => r.projectId === id);
      const notes = experimentNoteService.getAll().filter(n => n.projectId === id);
      const sops = sopService.getAll().filter(s => s.projectId === id);

      const aiResult = await mindMapAIService.generateProjectMindMap(
        project, records, notes, sops, generationOptions
      );

      // Convert AI result to React Flow nodes/edges
      const newNodes: Node[] = aiResult.nodes.map(n => ({
        id: n.id,
        type: 'custom',
        data: {
          label: n.title,
          type: n.relatedType === 'experiment' ? 'record' : (n.relatedType || 'default'),
        },
        position: { x: 0, y: 0 }
      }));

      const newEdges: Edge[] = aiResult.edges.map(e => ({
        id: `e-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        animated: true,
      }));

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        newNodes, newEdges, 'LR'
      );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      setHasAIGenerated(true);
      toast.success(`AI 生成成功: ${newNodes.length} 个节点`);

    } catch (e) {
      console.error(e);
      toast.error("AI 生成失败");
    } finally {
      setIsGenerating(false);
    }
  };


  if (loading || !project) return (
    <div className="h-screen flex items-center justify-center bg-organic-rice-paper">
      <div className="organic-card p-8 rounded-[2rem_1rem_2.5rem_1.5rem] text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-moss mb-4"></div>
        <p className="text-loam">加载中...</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-organic-rice-paper text-loam overflow-hidden">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={cn('flex-1 flex flex-col transition-all duration-500', sidebarCollapsed ? 'ml-16' : 'ml-64')}>
        <Header
          title={`思维导图: ${project.title}`}
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <div className="flex gap-2">
              <button
                onClick={() => setShowGenerationOptions(!showGenerationOptions)}
                className="organic-btn organic-btn--outline text-sm"
              >
                <i className={`fa-solid fa-magic mr-2 ${isGenerating ? 'animate-spin' : ''}`}></i>
                AI 生成
              </button>
              {hasAIGenerated && (
                <button
                  onClick={loadData}
                  className="organic-btn organic-btn--ghost text-sm"
                >
                  <i className="fa-solid fa-undo mr-2"></i> 重置
                </button>
              )}
              <Link to={`/projects/${id}`} className="organic-btn organic-btn--ghost text-sm">
                返回课题
              </Link>
            </div>
          }
        />

        <div className="flex-1 relative">
          {/* AI Options Panel */}
          <AnimatePresence>
            {showGenerationOptions && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-4 right-4 z-50 w-80 organic-card rounded-[1.5rem_1rem_2rem_1.2rem] p-5"
              >
                <h3 className="font-heading font-bold text-loam mb-4 flex items-center">
                  <i className="fa-solid fa-robot mr-2 text-moss"></i>
                  AI 导图生成
                </h3>

                <div className="space-y-4">
                  <div className="space-y-3">
                    <label className="flex items-center text-sm text-loam cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={generationOptions.includeExperiments}
                        onChange={e => setGenerationOptions({ ...generationOptions, includeExperiments: e.target.checked })}
                        className="w-4 h-4 mr-3 rounded border-bark/30 text-moss focus:ring-moss/30 bg-organic-rice-paper"
                      />
                      <span className="group-hover:text-moss transition-colors">包含实验记录</span>
                    </label>
                    <label className="flex items-center text-sm text-loam cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={generationOptions.includeNotes}
                        onChange={e => setGenerationOptions({ ...generationOptions, includeNotes: e.target.checked })}
                        className="w-4 h-4 mr-3 rounded border-bark/30 text-moss focus:ring-moss/30 bg-organic-rice-paper"
                      />
                      <span className="group-hover:text-moss transition-colors">包含研究笔记</span>
                    </label>
                    <label className="flex items-center text-sm text-loam cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={generationOptions.includeSOPs}
                        onChange={e => setGenerationOptions({ ...generationOptions, includeSOPs: e.target.checked })}
                        className="w-4 h-4 mr-3 rounded border-bark/30 text-moss focus:ring-moss/30 bg-organic-rice-paper"
                      />
                      <span className="group-hover:text-moss transition-colors">包含 SOP 文档</span>
                    </label>
                  </div>

                  <div className="pt-3 border-t border-timber-soft flex justify-end gap-2">
                    <button onClick={() => setShowGenerationOptions(false)} className="organic-btn organic-btn--ghost text-sm">取消</button>
                    <button
                      onClick={handleAIGeneration}
                      className="organic-btn organic-btn--primary text-sm"
                    >
                      开始生成
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
              nodeTypes={nodeTypes}
              fitView
              attributionPosition="bottom-right"
              className="bg-organic-rice-paper"
            >
              <Controls showInteractive={false} className="bg-timber-soft border-bark/20 shadow-organic rounded-lg overflow-hidden" />
              <Background color="#6B8E7B" gap={16} size={1} style={{ opacity: 0.08 }} />
              <MiniMap
                nodeColor={(n) => {
                  if (n.data.type === 'project') return '#6B8E7B'; // moss
                  if (n.data.type === 'record') return '#C19A6B'; // terracotta
                  if (n.data.type === 'note') return '#E6D5B8'; // sand
                  return '#D9D0C4'; // timber-soft
                }}
                className="border border-bark/20 shadow-organic rounded-lg overflow-hidden"
              />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>
    </div>
  );
}