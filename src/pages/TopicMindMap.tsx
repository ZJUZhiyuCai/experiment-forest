import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { projectService, experimentRecordService, experimentNoteService, sopService } from '@/lib/cachedStorage';
import { Project } from '@/types';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { Button } from '@/components/Button';
// @ts-ignore
import * as d3 from 'd3-force';

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
        
        // 获取项目信息
        const projectData = projectService.getById(id);
        if (!projectData) {
          toast.error('未找到该课题');
          navigate('/projects');
          return;
        }
        
        setProject(projectData);
        
        // 获取相关数据
        const records = experimentRecordService.getAll().filter(r => r.projectId === id);
        const notes = experimentNoteService.getAll().filter(n => n.projectId === id);
        const sops = sopService.getAll().filter(s => s.projectId === id);
        
        // 构建节点
        const nodeList: MindMapNode[] = [
          // 主节点 - 课题
          {
            id: projectData.id,
            type: 'project',
            title: projectData.title,
            color: nodeColors.project,
            status: projectData.status
          },
          // 实验记录节点
          ...records.map((record): MindMapNode => ({
            id: record.id,
            type: 'record',
            title: record.title,
            color: nodeColors.record,
            category: record.category,
            status: record.status
          })),
          // 笔记节点
          ...notes.map((note): MindMapNode => ({
            id: note.id,
            type: 'note',
            title: note.title,
            color: nodeColors.note
          })),
          // SOP节点
          ...sops.map((sop): MindMapNode => ({
            id: sop.id,
            type: 'sop',
            title: sop.title,
            color: nodeColors.sop,
            status: sop.approvalStatus
          }))
        ];
        
        // 构建连接线（所有子节点都连接到主节点）
        const linkList: MindMapLink[] = nodeList
          .filter(node => node.type !== 'project')
          .map(node => ({
            source: projectData.id,
            target: node.id
          }));
        
        // 添加笔记与实验记录的关联
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

  // 初始化D3力导向图
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0 || isSimulating) return;

    setIsSimulating(true);
    
    // @ts-ignore
    const svg = d3.select(svgRef.current);
    const width = 800;
    const height = 600;
    
    // 清除之前的内容
    svg.selectAll("*").remove();
    
    // 创建力模拟
    // @ts-ignore
    const simulation = d3.forceSimulation<MindMapNode>(nodes)
      // @ts-ignore
      .force('link', d3.forceLink<MindMapNode, MindMapLink>(links).id((d: any) => d.id).distance(80))
      // @ts-ignore
      .force('charge', d3.forceManyBody().strength(-300))
      // @ts-ignore
      .force('center', d3.forceCenter(width / 2, height / 2))
      // @ts-ignore
      .force('collision', d3.forceCollide().radius(35));
    
    simulationRef.current = simulation;
    
    // 创建连接线
    // @ts-ignore
    const link = svg.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2);
    
    // 创建节点组
    // @ts-ignore
    const node = svg.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer');
    
    // 添加圆形节点
    // @ts-ignore
    const circles = node.append('circle')
      .attr('r', (d: any) => d.type === 'project' ? 30 : 20)
      .attr('fill', (d: any) => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);
    
    // 添加文本标签
    node.append('text')
      .text((d: MindMapNode) => d.title.length > 12 ? d.title.substring(0, 12) + '...' : d.title)
      .attr('dy', (d: MindMapNode) => d.type === 'project' ? 40 : 30)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', (d: MindMapNode) => d.type === 'project' ? 'bold' : 'normal')
      .attr('fill', '#333');
    
    // 节点拖拽行为
    // @ts-ignore
    const drag = d3.drag()
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
    
    node.call(drag);
    
    // 节点点击事件
    node.on('click', (_event: any, d: MindMapNode) => {
      // 根据节点类型跳转到相应页面
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
    
    // 节点悬停效果
    node.on('mouseover', function(_event: any, d: any) {
      // @ts-ignore
      d3.select(this).select('circle')
        .transition()
        .duration(200)
        .attr('r', d.type === 'project' ? 35 : 25);
      
      // 显示tooltip（简单实现）
      const tooltip = svg.append('g')
        .attr('class', 'tooltip')
        .attr('transform', `translate(${d.x || 0}, ${d.y || 0})`);
      
      tooltip.append('rect')
        .attr('x', -50)
        .attr('y', -60)
        .attr('width', 100)
        .attr('height', 30)
        .attr('fill', 'rgba(0,0,0,0.8)')
        .attr('rx', 4);
      
      tooltip.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', -40)
        .attr('fill', 'white')
        .attr('font-size', '10px')
        .text(d.title);
    })
    .on('mouseout', function(_event: any, d: any) {
      // @ts-ignore
      d3.select(this).select('circle')
        .transition()
        .duration(200)
        .attr('r', d.type === 'project' ? 30 : 20);
      
      svg.select('.tooltip').remove();
    });
    
    // 更新位置
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => (d.source as any).x)
        .attr('y1', (d: any) => (d.source as any).y)
        .attr('x2', (d: any) => (d.target as any).x)
        .attr('y2', (d: any) => (d.target as any).y);
      
      node.attr('transform', (d: any) => `translate(${d.x || 0},${d.y || 0})`);
    });
    
    // 模拟完成后的清理
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
        <Header title="思维导图" sidebarCollapsed={sidebarCollapsed} />
        
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                课题思维导图: {project.title}
              </h1>
              <p className="text-gray-600">
                可视化展示课题与相关实验记录、笔记、SOP的关系
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => navigate(`/projects/${id}`)}
              >
                返回课题详情
              </Button>
            </div>
          </div>
          
          {/* 图例 */}
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
          </div>
          
          {/* 思维导图画布 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-sm overflow-hidden"
          >
            <div className="p-4 border-b">
              <div className="flex justify-between items-center">
                <h3 className="font-medium text-gray-800">思维导图</h3>
                <div className="text-sm text-gray-600">
                  节点数量: {nodes.length} | 连接数: {links.length}
                </div>
              </div>
            </div>
            
            <div className="relative" style={{ height: '600px' }}>
              <svg
                ref={svgRef}
                width="100%"
                height="100%"
                viewBox="0 0 800 600"
                style={{ background: '#fafafa' }}
              />
              
              {nodes.length === 1 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <p className="mb-2">暂无关联的实验记录、笔记或SOP</p>
                    <p className="text-sm">
                      <Link to={`/projects/${id}/records`} className="text-blue-600 hover:underline mr-4">
                        添加实验记录
                      </Link>
                      <Link to={`/projects/${id}/notes`} className="text-blue-600 hover:underline mr-4">
                        添加笔记
                      </Link>
                      <Link to={`/projects/${id}/sops`} className="text-blue-600 hover:underline">
                        添加SOP
                      </Link>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
          
          {/* 操作提示 */}
          <div className="mt-4 text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p>💡 操作提示:</p>
            <ul className="mt-1 ml-4 list-disc text-xs">
              <li>点击节点可跳转到对应的详情页面</li>
              <li>拖拽节点可调整布局位置</li>
              <li>悬停在节点上可查看详细信息</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}