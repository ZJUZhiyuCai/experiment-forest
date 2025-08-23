import { 
  MindMap, 
  MindMapNode, 
  MindMapEdge, 
  MindMapTemplate,
  MindMapNodeType,
  EdgeType,
  ExperimentCategory 
} from '@/types';

// 思维导图服务类
export class MindMapService {
  private mindMaps: Map<string, MindMap> = new Map();
  private templates: Map<string, MindMapTemplate> = new Map();

  constructor() {
    this.loadMindMaps();
    this.initializeTemplates();
  }

  // 从localStorage加载思维导图数据
  private loadMindMaps(): void {
    try {
      const saved = localStorage.getItem('mindMaps');
      if (saved) {
        const mapsData = JSON.parse(saved);
        Object.entries(mapsData).forEach(([id, mindMap]) => {
          this.mindMaps.set(id, mindMap as MindMap);
        });
      }
    } catch (error) {
      console.error('加载思维导图失败:', error);
    }
  }

  // 保存思维导图数据到localStorage
  private saveMindMaps(): void {
    try {
      const mapsObj = Object.fromEntries(this.mindMaps);
      localStorage.setItem('mindMaps', JSON.stringify(mapsObj));
    } catch (error) {
      console.error('保存思维导图失败:', error);
    }
  }

  // 初始化内置模板
  private initializeTemplates(): void {
    const builtInTemplates: MindMapTemplate[] = [
      {
        id: 'project_overview',
        name: '项目总览模板',
        description: '适用于项目整体规划和管理的思维导图模板',
        category: 'project',
        templateNodes: [
          { title: '项目背景', content: '', type: 'project', position: { x: 0, y: -200 }, size: { width: 120, height: 60 }, style: { color: '#f0f9ff', borderColor: '#0ea5e9', textColor: '#0c4a6e', shape: 'rectangle' } },
          { title: '研究目标', content: '', type: 'milestone', position: { x: -200, y: -100 }, size: { width: 120, height: 60 }, style: { color: '#f0fdf4', borderColor: '#22c55e', textColor: '#15803d', shape: 'rectangle' } },
          { title: '实验设计', content: '', type: 'experiment', position: { x: 0, y: 0 }, size: { width: 120, height: 60 }, style: { color: '#fefce8', borderColor: '#eab308', textColor: '#a16207', shape: 'rectangle' } },
          { title: '数据分析', content: '', type: 'analysis', position: { x: 200, y: -100 }, size: { width: 120, height: 60 }, style: { color: '#fdf2f8', borderColor: '#ec4899', textColor: '#be185d', shape: 'rectangle' } },
          { title: '结果总结', content: '', type: 'note', position: { x: 0, y: 100 }, size: { width: 120, height: 60 }, style: { color: '#f3e8ff', borderColor: '#a855f7', textColor: '#7c2d12', shape: 'rectangle' } }
        ],
        templateEdges: [
          { label: '', type: 'hierarchy', style: { color: '#6b7280', width: 2, strokeType: 'solid', arrow: true } },
          { label: '', type: 'flow', style: { color: '#6b7280', width: 2, strokeType: 'solid', arrow: true } }
        ],
        applicableTypes: undefined,
        autoGenerate: true,
        author: 'System',
        version: '1.0',
        downloadCount: 0,
        rating: 5,
        isBuiltIn: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'experiment_flow',
        name: '实验流程模板',
        description: '用于规划实验步骤和流程的专业模板',
        category: 'experiment',
        templateNodes: [
          { title: '实验准备', content: '', type: 'resource', position: { x: 0, y: -150 }, size: { width: 100, height: 50 }, style: { color: '#fef3c7', borderColor: '#f59e0b', textColor: '#92400e', shape: 'rectangle' } },
          { title: '前处理', content: '', type: 'experiment', position: { x: -100, y: -50 }, size: { width: 100, height: 50 }, style: { color: '#dbeafe', borderColor: '#3b82f6', textColor: '#1e40af', shape: 'rectangle' } },
          { title: '主实验', content: '', type: 'experiment', position: { x: 0, y: 50 }, size: { width: 100, height: 50 }, style: { color: '#dcfce7', borderColor: '#10b981', textColor: '#059669', shape: 'rectangle' } },
          { title: '数据收集', content: '', type: 'analysis', position: { x: 100, y: -50 }, size: { width: 100, height: 50 }, style: { color: '#fce7f3', borderColor: '#ec4899', textColor: '#be185d', shape: 'rectangle' } },
          { title: '结果分析', content: '', type: 'analysis', position: { x: 0, y: 150 }, size: { width: 100, height: 50 }, style: { color: '#e0e7ff', borderColor: '#6366f1', textColor: '#4338ca', shape: 'rectangle' } }
        ],
        templateEdges: [
          { label: '流程', type: 'flow', style: { color: '#6b7280', width: 2, strokeType: 'solid', arrow: true } }
        ],
        applicableTypes: ['cell_culture', 'pcr', 'western_blot', 'elisa'],
        autoGenerate: false,
        author: 'System',
        version: '1.0',
        downloadCount: 0,
        rating: 5,
        isBuiltIn: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    builtInTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  // 创建新的思维导图
  createMindMap(
    title: string,
    description?: string,
    projectId?: string,
    type: MindMap['type'] = 'custom',
    templateId?: string
  ): MindMap {
    const mindMap: MindMap = {
      id: this.generateId(),
      title,
      description,
      nodes: [],
      edges: [],
      layout: {
        type: 'force',
        direction: 'horizontal',
        spacing: { x: 150, y: 100 }
      },
      viewport: {
        zoom: 1,
        center: { x: 0, y: 0 },
        bounds: { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 }
      },
      projectId,
      type,
      createdBy: 'current_user',
      collaborators: [],
      isPublic: false,
      version: 1,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 如果指定了模板，应用模板
    if (templateId && this.templates.has(templateId)) {
      this.applyTemplate(mindMap, templateId);
    } else {
      // 创建默认的根节点
      this.addDefaultRootNode(mindMap);
    }

    this.mindMaps.set(mindMap.id, mindMap);
    this.saveMindMaps();
    return mindMap;
  }

  // 应用模板到思维导图
  private applyTemplate(mindMap: MindMap, templateId: string): void {
    const template = this.templates.get(templateId);
    if (!template) return;

    // 添加模板节点
    template.templateNodes.forEach((nodeTemplate, index) => {
      const node: MindMapNode = {
        id: this.generateId(),
        title: nodeTemplate.title,
        content: nodeTemplate.content,
        type: nodeTemplate.type,
        position: { ...nodeTemplate.position },
        size: { ...nodeTemplate.size },
        style: { ...nodeTemplate.style },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mindMap.nodes.push(node);
    });

    // 添加模板边（连接相邻节点）
    if (mindMap.nodes.length > 1) {
      for (let i = 0; i < mindMap.nodes.length - 1; i++) {
        const edge: MindMapEdge = {
          id: this.generateId(),
          source: mindMap.nodes[i].id,
          target: mindMap.nodes[i + 1].id,
          type: 'flow',
          style: {
            color: '#6b7280',
            width: 2,
            strokeType: 'solid',
            arrow: true
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };
        mindMap.edges.push(edge);
      }
    }
  }

  // 添加默认根节点
  private addDefaultRootNode(mindMap: MindMap): void {
    const rootNode: MindMapNode = {
      id: this.generateId(),
      title: mindMap.title,
      content: mindMap.description || '',
      type: 'custom',
      position: { x: 0, y: 0 },
      size: { width: 120, height: 60 },
      style: {
        color: '#f0f9ff',
        borderColor: '#0ea5e9',
        textColor: '#0c4a6e',
        shape: 'rectangle',
        fontSize: 14,
        borderWidth: 2
      },
      level: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mindMap.nodes.push(rootNode);
  }

  // 添加节点
  addNode(
    mindMapId: string,
    title: string,
    type: MindMapNodeType = 'custom',
    position: { x: number; y: number },
    parentId?: string
  ): MindMapNode | null {
    const mindMap = this.mindMaps.get(mindMapId);
    if (!mindMap) return null;

    const node: MindMapNode = {
      id: this.generateId(),
      title,
      content: '',
      type,
      position,
      size: { width: 100, height: 50 },
      style: this.getDefaultNodeStyle(type),
      parent: parentId,
      level: parentId ? (this.getNodeLevel(mindMap, parentId) + 1) : 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mindMap.nodes.push(node);

    // 如果有父节点，创建连接边
    if (parentId) {
      this.addEdge(mindMapId, parentId, node.id, 'hierarchy');
    }

    mindMap.updatedAt = new Date();
    this.saveMindMaps();
    return node;
  }

  // 获取节点的层级
  private getNodeLevel(mindMap: MindMap, nodeId: string): number {
    const node = mindMap.nodes.find(n => n.id === nodeId);
    if (!node || !node.parent) return 0;
    return this.getNodeLevel(mindMap, node.parent) + 1;
  }

  // 获取默认节点样式
  private getDefaultNodeStyle(type: MindMapNodeType) {
    const styleMap = {
      'project': { color: '#f0f9ff', borderColor: '#0ea5e9', textColor: '#0c4a6e', shape: 'rectangle' as const },
      'experiment': { color: '#f0fdf4', borderColor: '#22c55e', textColor: '#15803d', shape: 'rectangle' as const },
      'sample': { color: '#fefce8', borderColor: '#eab308', textColor: '#a16207', shape: 'circle' as const },
      'sop': { color: '#fdf2f8', borderColor: '#ec4899', textColor: '#be185d', shape: 'rectangle' as const },
      'note': { color: '#f3e8ff', borderColor: '#a855f7', textColor: '#7c2d12', shape: 'rectangle' as const },
      'milestone': { color: '#fef2f2', borderColor: '#ef4444', textColor: '#dc2626', shape: 'diamond' as const },
      'resource': { color: '#f6f3ff', borderColor: '#8b5cf6', textColor: '#6b21a8', shape: 'rectangle' as const },
      'analysis': { color: '#ecfdf5', borderColor: '#10b981', textColor: '#047857', shape: 'rectangle' as const },
      'custom': { color: '#f9fafb', borderColor: '#6b7280', textColor: '#374151', shape: 'rectangle' as const }
    };

    return {
      ...styleMap[type],
      fontSize: 12,
      borderWidth: 2
    };
  }

  // 添加边
  addEdge(
    mindMapId: string,
    sourceId: string,
    targetId: string,
    type: EdgeType = 'relation',
    label?: string
  ): MindMapEdge | null {
    const mindMap = this.mindMaps.get(mindMapId);
    if (!mindMap) return null;

    const edge: MindMapEdge = {
      id: this.generateId(),
      source: sourceId,
      target: targetId,
      label,
      type,
      style: {
        color: '#6b7280',
        width: 2,
        strokeType: 'solid',
        arrow: true
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mindMap.edges.push(edge);
    mindMap.updatedAt = new Date();
    this.saveMindMaps();
    return edge;
  }

  // 更新节点
  updateNode(mindMapId: string, nodeId: string, updates: Partial<MindMapNode>): boolean {
    const mindMap = this.mindMaps.get(mindMapId);
    if (!mindMap) return false;

    const nodeIndex = mindMap.nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) return false;

    mindMap.nodes[nodeIndex] = {
      ...mindMap.nodes[nodeIndex],
      ...updates,
      updatedAt: new Date()
    };

    mindMap.updatedAt = new Date();
    this.saveMindMaps();
    return true;
  }

  // 删除节点
  deleteNode(mindMapId: string, nodeId: string): boolean {
    const mindMap = this.mindMaps.get(mindMapId);
    if (!mindMap) return false;

    // 删除节点
    mindMap.nodes = mindMap.nodes.filter(n => n.id !== nodeId);
    
    // 删除相关的边
    mindMap.edges = mindMap.edges.filter(e => e.source !== nodeId && e.target !== nodeId);

    mindMap.updatedAt = new Date();
    this.saveMindMaps();
    return true;
  }

  // 删除边
  deleteEdge(mindMapId: string, edgeId: string): boolean {
    const mindMap = this.mindMaps.get(mindMapId);
    if (!mindMap) return false;

    mindMap.edges = mindMap.edges.filter(e => e.id !== edgeId);
    mindMap.updatedAt = new Date();
    this.saveMindMaps();
    return true;
  }

  // 获取思维导图
  getMindMap(id: string): MindMap | undefined {
    return this.mindMaps.get(id);
  }

  // 获取所有思维导图
  getAllMindMaps(): MindMap[] {
    return Array.from(this.mindMaps.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  // 根据项目ID获取思维导图
  getMindMapsByProject(projectId: string): MindMap[] {
    return this.getAllMindMaps()
      .filter(map => map.projectId === projectId);
  }

  // 删除思维导图
  deleteMindMap(id: string): boolean {
    const deleted = this.mindMaps.delete(id);
    if (deleted) {
      this.saveMindMaps();
    }
    return deleted;
  }

  // 获取所有模板
  getAllTemplates(): MindMapTemplate[] {
    return Array.from(this.templates.values());
  }

  // 根据实验类型获取适用模板
  getTemplatesByExperimentType(experimentType: ExperimentCategory): MindMapTemplate[] {
    return this.getAllTemplates()
      .filter(template => 
        !template.applicableTypes || 
        template.applicableTypes.includes(experimentType)
      );
  }

  // 从现有数据自动生成思维导图
  generateFromProject(projectId: string, title: string): MindMap | null {
    // 这里可以集成项目数据，自动生成相关的思维导图
    // 暂时返回基础模板
    return this.createMindMap(title, `从项目 ${projectId} 自动生成`, projectId, 'project_overview', 'project_overview');
  }

  // 导出思维导图数据
  exportMindMap(id: string): string | null {
    const mindMap = this.mindMaps.get(id);
    if (!mindMap) return null;
    
    return JSON.stringify(mindMap, null, 2);
  }

  // 导入思维导图数据
  importMindMap(data: string): MindMap | null {
    try {
      const mindMap = JSON.parse(data) as MindMap;
      mindMap.id = this.generateId(); // 重新生成ID避免冲突
      mindMap.createdAt = new Date();
      mindMap.updatedAt = new Date();
      
      this.mindMaps.set(mindMap.id, mindMap);
      this.saveMindMaps();
      return mindMap;
    } catch (error) {
      console.error('导入思维导图失败:', error);
      return null;
    }
  }

  // 生成唯一ID
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

// 创建全局实例
export const mindMapService = new MindMapService();