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
import { Button } from '@/components/Button';
import CustomNode from '@/components/mindmap/CustomNode';
import { getLayoutedElements } from '@/lib/mindMapLayout';
import { mindMapAIService, MindMapGenerationOptions } from '@/lib/mindMapAIService';
import { motion, AnimatePresence } from 'framer-motion';

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


  if (loading || !project) return <div className="h-screen flex items-center justify-center bg-earth-beige/50 text-forest-primary">加载中...</div>;

  return (
    <div className="flex h-screen bg-earth-beige/20 text-text-main overflow-hidden">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        <Header
          title={`思维导图: ${project.title}`}
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGenerationOptions(!showGenerationOptions)}
                className="bg-white hover:bg-forest-main/5 text-forest-primary border-forest-accent/30"
              >
                <i className={`fa-solid fa-magic mr-2 ${isGenerating ? 'animate-spin' : ''}`}></i>
                AI 生成
              </Button>
              {hasAIGenerated && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadData}
                  className="text-text-muted hover:text-text-main"
                >
                  <i className="fa-solid fa-undo mr-2"></i> 重置
                </Button>
              )}
              <Link to={`/projects/${id}`}>
                <Button variant="ghost" size="sm">返回课题</Button>
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
                className="absolute top-4 right-4 z-50 w-80 bg-white rounded-2xl shadow-xl border border-forest-accent/20 p-5"
              >
                <h3 className="font-bold text-forest-primary mb-4 flex items-center">
                  <i className="fa-solid fa-robot mr-2"></i>
                  AI 导图生成
                </h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="flex items-center text-sm text-text-main">
                      <input
                        type="checkbox"
                        checked={generationOptions.includeExperiments}
                        onChange={e => setGenerationOptions({ ...generationOptions, includeExperiments: e.target.checked })}
                        className="mr-2 text-forest-secondary focus:ring-forest-secondary rounded"
                      />
                      包含实验记录
                    </label>
                    <label className="flex items-center text-sm text-text-main">
                      <input
                        type="checkbox"
                        checked={generationOptions.includeNotes}
                        onChange={e => setGenerationOptions({ ...generationOptions, includeNotes: e.target.checked })}
                        className="mr-2 text-forest-secondary focus:ring-forest-secondary rounded"
                      />
                      包含研究笔记
                    </label>
                    <label className="flex items-center text-sm text-text-main">
                      <input
                        type="checkbox"
                        checked={generationOptions.includeSOPs}
                        onChange={e => setGenerationOptions({ ...generationOptions, includeSOPs: e.target.checked })}
                        className="mr-2 text-forest-secondary focus:ring-forest-secondary rounded"
                      />
                      包含 SOP 文档
                    </label>
                  </div>

                  <div className="pt-2 border-t border-forest-accent/10 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setShowGenerationOptions(false)}>取消</Button>
                    <Button
                      size="sm"
                      onClick={handleAIGeneration}
                      className="bg-forest-secondary hover:bg-forest-primary text-white"
                    >
                      开始生成
                    </Button>
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
              className="bg-earth-beige/20"
            >
              <Controls showInteractive={false} className="bg-white border-forest-accent/20 shadow-md rounded-lg overflow-hidden" />
              <Background color="#10b981" gap={16} size={1} style={{ opacity: 0.1 }} />
              <MiniMap
                nodeColor={(n) => {
                  if (n.data.type === 'project') return '#059669';
                  if (n.data.type === 'record') return '#34d399';
                  if (n.data.type === 'note') return '#fbbf24';
                  return '#e5e7eb';
                }}
                className="border border-forest-accent/20 shadow-lg rounded-lg overflow-hidden"
              />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>
    </div>
  );
}