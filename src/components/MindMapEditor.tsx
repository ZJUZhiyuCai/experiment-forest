import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  MindMap, 
  MindMapNode, 
  MindMapEdge, 
  MindMapNodeType, 
  NodeShape, 
  EdgeType 
} from '@/types';
import { MindMapRenderer, MindMapEvents } from '@/lib/mindMapRenderer';
import { mindMapService } from '@/lib/mindMapService';
import { toast } from 'sonner';

interface MindMapEditorProps {
  mindMapId?: string;
  readOnly?: boolean;
  className?: string;
  onSave?: (mindMap: MindMap) => void;
  onNodeSelect?: (node: MindMapNode | null) => void;
}

export const MindMapEditor: React.FC<MindMapEditorProps> = ({
  mindMapId,
  readOnly = false,
  className = '',
  onSave,
  onNodeSelect
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<MindMapRenderer | null>(null);
  const [mindMap, setMindMap] = useState<MindMap | null>(null);
  const [selectedNode, setSelectedNode] = useState<MindMapNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<MindMapEdge | null>(null);
  const [showToolbar, setShowToolbar] = useState(!readOnly);
  const [isLoading, setIsLoading] = useState(true);

  // 工具栏状态
  const [showNodeTypes, setShowNodeTypes] = useState(false);
  const [showNodeShapes, setShowNodeShapes] = useState(false);

  // 节点类型选项
  const nodeTypes: { type: MindMapNodeType; label: string; icon: string; color: string }[] = [
    { type: 'project', label: '项目', icon: 'fa-folder', color: '#0ea5e9' },
    { type: 'experiment', label: '实验', icon: 'fa-flask', color: '#22c55e' },
    { type: 'sample', label: '样本', icon: 'fa-vial', color: '#eab308' },
    { type: 'sop', label: 'SOP', icon: 'fa-file-alt', color: '#ec4899' },
    { type: 'note', label: '笔记', icon: 'fa-sticky-note', color: '#a855f7' },
    { type: 'milestone', label: '里程碑', icon: 'fa-flag', color: '#ef4444' },
    { type: 'resource', label: '资源', icon: 'fa-box', color: '#8b5cf6' },
    { type: 'analysis', label: '分析', icon: 'fa-chart-bar', color: '#10b981' },
    { type: 'custom', label: '自定义', icon: 'fa-shapes', color: '#6b7280' }
  ];

  // 节点形状选项
  const nodeShapes: { shape: NodeShape; label: string; icon: string }[] = [
    { shape: 'rectangle', label: '矩形', icon: 'fa-square' },
    { shape: 'circle', label: '圆形', icon: 'fa-circle' },
    { shape: 'diamond', label: '菱形', icon: 'fa-diamond' },
    { shape: 'ellipse', label: '椭圆', icon: 'fa-circle' },
    { shape: 'hexagon', label: '六边形', icon: 'fa-hexagon' }
  ];

  // 初始化组件
  useEffect(() => {
    loadMindMap();
    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy();
      }
    };
  }, [mindMapId]);

  // 初始化渲染器
  useEffect(() => {
    if (containerRef.current && mindMap) {
      initializeRenderer();
    }
  }, [mindMap, containerRef.current]);

  // 加载思维导图数据
  const loadMindMap = async () => {
    setIsLoading(true);
    try {
      if (mindMapId) {
        const loadedMindMap = mindMapService.getMindMap(mindMapId);
        if (loadedMindMap) {
          setMindMap(loadedMindMap);
        } else {
          toast.error('思维导图不存在');
        }
      } else {
        // 创建新的思维导图
        const newMindMap = mindMapService.createMindMap('新建思维导图', '点击节点开始编辑');
        setMindMap(newMindMap);
      }
    } catch (error) {
      console.error('加载思维导图失败:', error);
      toast.error('加载思维导图失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 初始化渲染器
  const initializeRenderer = () => {
    if (!containerRef.current || !mindMap) return;

    // 销毁旧的渲染器
    if (rendererRef.current) {
      rendererRef.current.destroy();
    }

    // 创建新的渲染器
    const events: MindMapEvents = {
      onNodeClick: handleNodeClick,
      onNodeDoubleClick: handleNodeDoubleClick,
      onNodeDrag: handleNodeDrag,
      onEdgeClick: handleEdgeClick,
      onCanvasClick: handleCanvasClick,
      onZoom: handleZoom
    };

    rendererRef.current = new MindMapRenderer(containerRef.current, events);
    rendererRef.current.render(mindMap);
  };

  // 节点点击事件
  const handleNodeClick = (node: MindMapNode, event: MouseEvent) => {
    if (readOnly) return;
    
    setSelectedNode(node);
    setSelectedEdge(null);
    onNodeSelect?.(node);
  };

  // 节点双击事件
  const handleNodeDoubleClick = (node: MindMapNode, event: MouseEvent) => {
    if (readOnly) return;
    
    // 进入编辑模式
    const newTitle = prompt('编辑节点标题:', node.title);
    if (newTitle && newTitle !== node.title && mindMap) {
      const success = mindMapService.updateNode(mindMap.id, node.id, { title: newTitle });
      if (success) {
        const updatedMindMap = mindMapService.getMindMap(mindMap.id);
        if (updatedMindMap) {
          setMindMap(updatedMindMap);
          onSave?.(updatedMindMap);
        }
      }
    }
  };

  // 节点拖拽事件
  const handleNodeDrag = (node: MindMapNode, x: number, y: number) => {
    if (readOnly || !mindMap) return;
    
    // 更新节点位置
    mindMapService.updateNode(mindMap.id, node.id, { 
      position: { x, y } 
    });
  };

  // 边点击事件
  const handleEdgeClick = (edge: MindMapEdge, event: MouseEvent) => {
    if (readOnly) return;
    
    setSelectedEdge(edge);
    setSelectedNode(null);
    onNodeSelect?.(null);
  };

  // 画布点击事件
  const handleCanvasClick = (x: number, y: number, event: MouseEvent) => {
    if (readOnly) return;
    
    setSelectedNode(null);
    setSelectedEdge(null);
    onNodeSelect?.(null);
  };

  // 缩放事件
  const handleZoom = (scale: number, x: number, y: number) => {
    // 可以在这里处理缩放相关的逻辑
  };

  // 添加节点
  const addNode = (type: MindMapNodeType) => {
    if (!mindMap || readOnly) return;

    const position = selectedNode 
      ? { x: selectedNode.position.x + 150, y: selectedNode.position.y }
      : { x: 0, y: 0 };

    const newNode = mindMapService.addNode(
      mindMap.id,
      `新${nodeTypes.find(t => t.type === type)?.label}`,
      type,
      position,
      selectedNode?.id
    );

    if (newNode && rendererRef.current) {
      const updatedMindMap = mindMapService.getMindMap(mindMap.id);
      if (updatedMindMap) {
        setMindMap(updatedMindMap);
        rendererRef.current.render(updatedMindMap);
        onSave?.(updatedMindMap);
      }
    }
    
    setShowNodeTypes(false);
  };

  // 删除选中节点
  const deleteSelectedNode = () => {
    if (!selectedNode || !mindMap || readOnly) return;

    if (window.confirm('确定要删除这个节点吗？')) {
      const success = mindMapService.deleteNode(mindMap.id, selectedNode.id);
      if (success && rendererRef.current) {
        const updatedMindMap = mindMapService.getMindMap(mindMap.id);
        if (updatedMindMap) {
          setMindMap(updatedMindMap);
          rendererRef.current.render(updatedMindMap);
          setSelectedNode(null);
          onSave?.(updatedMindMap);
        }
      }
    }
  };

  // 删除选中边
  const deleteSelectedEdge = () => {
    if (!selectedEdge || !mindMap || readOnly) return;

    if (window.confirm('确定要删除这个连接吗？')) {
      const success = mindMapService.deleteEdge(mindMap.id, selectedEdge.id);
      if (success && rendererRef.current) {
        const updatedMindMap = mindMapService.getMindMap(mindMap.id);
        if (updatedMindMap) {
          setMindMap(updatedMindMap);
          rendererRef.current.render(updatedMindMap);
          setSelectedEdge(null);
          onSave?.(updatedMindMap);
        }
      }
    }
  };

  // 更改节点形状
  const changeNodeShape = (shape: NodeShape) => {
    if (!selectedNode || !mindMap || readOnly) return;

    const success = mindMapService.updateNode(mindMap.id, selectedNode.id, {
      style: { ...selectedNode.style, shape }
    });

    if (success && rendererRef.current) {
      const updatedMindMap = mindMapService.getMindMap(mindMap.id);
      if (updatedMindMap) {
        setMindMap(updatedMindMap);
        rendererRef.current.render(updatedMindMap);
        onSave?.(updatedMindMap);
      }
    }

    setShowNodeShapes(false);
  };

  // 缩放控制
  const zoomIn = () => rendererRef.current?.zoomIn();
  const zoomOut = () => rendererRef.current?.zoomOut();
  const resetZoom = () => rendererRef.current?.resetZoom();

  // 保存思维导图
  const saveMindMap = () => {
    if (mindMap) {
      onSave?.(mindMap);
      toast.success('思维导图已保存');
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-50 rounded-xl ${className}`}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mb-4"></div>
          <p className="text-gray-600">加载思维导图...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      {/* 工具栏 */}
      {showToolbar && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 left-4 z-10 flex items-center space-x-2"
        >
          {/* 添加节点 */}
          <div className="relative">
            <button
              onClick={() => setShowNodeTypes(!showNodeTypes)}
              className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
            >
              <i className="fa-solid fa-plus text-emerald-500"></i>
              <span className="text-sm font-medium">添加节点</span>
            </button>

            {showNodeTypes && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute top-full left-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20"
              >
                <div className="p-2 grid grid-cols-2 gap-1">
                  {nodeTypes.map((type) => (
                    <button
                      key={type.type}
                      onClick={() => addNode(type.type)}
                      className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <i className={`fa-solid ${type.icon}`} style={{ color: type.color }}></i>
                      <span className="text-xs">{type.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* 节点形状 */}
          {selectedNode && (
            <div className="relative">
              <button
                onClick={() => setShowNodeShapes(!showNodeShapes)}
                className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
              >
                <i className="fa-solid fa-shapes text-blue-500"></i>
                <span className="text-sm font-medium">形状</span>
              </button>

              {showNodeShapes && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute top-full left-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20"
                >
                  <div className="p-2 space-y-1">
                    {nodeShapes.map((shape) => (
                      <button
                        key={shape.shape}
                        onClick={() => changeNodeShape(shape.shape)}
                        className="flex items-center space-x-2 w-full p-2 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <i className={`fa-solid ${shape.icon} text-gray-600`}></i>
                        <span className="text-sm">{shape.label}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* 删除操作 */}
          {(selectedNode || selectedEdge) && (
            <button
              onClick={selectedNode ? deleteSelectedNode : deleteSelectedEdge}
              className="flex items-center space-x-2 px-3 py-2 bg-white border border-red-300 text-red-600 rounded-lg shadow-sm hover:bg-red-50 transition-colors"
            >
              <i className="fa-solid fa-trash"></i>
              <span className="text-sm font-medium">删除</span>
            </button>
          )}
        </motion.div>
      )}

      {/* 缩放控制 */}
      <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2">
        <button
          onClick={zoomIn}
          className="w-10 h-10 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors flex items-center justify-center"
          title="放大"
        >
          <i className="fa-solid fa-plus text-gray-600"></i>
        </button>
        <button
          onClick={zoomOut}
          className="w-10 h-10 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors flex items-center justify-center"
          title="缩小"
        >
          <i className="fa-solid fa-minus text-gray-600"></i>
        </button>
        <button
          onClick={resetZoom}
          className="w-10 h-10 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors flex items-center justify-center"
          title="重置缩放"
        >
          <i className="fa-solid fa-expand text-gray-600"></i>
        </button>
      </div>

      {/* 保存按钮 */}
      {!readOnly && (
        <div className="absolute bottom-4 right-4 z-10">
          <button
            onClick={saveMindMap}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg shadow-md hover:from-emerald-600 hover:to-green-700 transition-all duration-300"
          >
            <i className="fa-solid fa-save"></i>
            <span className="text-sm font-medium">保存</span>
          </button>
        </div>
      )}

      {/* 渲染容器 */}
      <div 
        ref={containerRef} 
        className="w-full h-full"
        onClick={() => {
          setShowNodeTypes(false);
          setShowNodeShapes(false);
        }}
      />

      {/* 选中状态指示 */}
      {(selectedNode || selectedEdge) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-4 left-4 z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-3"
        >
          <div className="text-sm">
            {selectedNode && (
              <>
                <p className="font-medium text-gray-800">已选择节点</p>
                <p className="text-gray-600">{selectedNode.title}</p>
                <p className="text-xs text-gray-500 mt-1">双击编辑标题</p>
              </>
            )}
            {selectedEdge && (
              <>
                <p className="font-medium text-gray-800">已选择连接</p>
                <p className="text-gray-600">{selectedEdge.label || '无标签'}</p>
              </>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};