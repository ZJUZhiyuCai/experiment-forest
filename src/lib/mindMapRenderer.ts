import * as d3 from 'd3-force';
import { MindMap, MindMapNode, MindMapEdge } from '@/types';

// 力导向图仿真节点类型
interface SimulationNode extends MindMapNode {
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
}

// 力导向图仿真边类型
interface SimulationLink {
  source: string | SimulationNode;
  target: string | SimulationNode;
  edge: MindMapEdge;
}

// 渲染事件类型
export interface MindMapEvents {
  onNodeClick?: (node: MindMapNode, event: MouseEvent) => void;
  onNodeDoubleClick?: (node: MindMapNode, event: MouseEvent) => void;
  onNodeDrag?: (node: MindMapNode, x: number, y: number) => void;
  onEdgeClick?: (edge: MindMapEdge, event: MouseEvent) => void;
  onCanvasClick?: (x: number, y: number, event: MouseEvent) => void;
  onZoom?: (scale: number, x: number, y: number) => void;
}

// 思维导图渲染器
export class MindMapRenderer {
  private container: HTMLElement;
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private g: d3.Selection<SVGGElement, unknown, null, undefined>;
  private simulation: d3.Simulation<SimulationNode, SimulationLink>;
  private nodes: SimulationNode[] = [];
  private links: SimulationLink[] = [];
  private zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
  private events: MindMapEvents = {};

  constructor(container: HTMLElement, events?: MindMapEvents) {
    this.container = container;
    this.events = events || {};
    this.initializeSVG();
    this.initializeSimulation();
    this.initializeZoom();
  }

  // 初始化SVG容器
  private initializeSVG(): void {
    // 清空容器
    d3.select(this.container).selectAll('*').remove();

    // 创建SVG
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .style('background-color', '#fafafa')
      .style('cursor', 'grab');

    // 创建主图层
    this.g = this.svg.append('g')
      .attr('class', 'mindmap-container');

    // 添加箭头标记定义
    this.addArrowMarkers();

    // 添加画布点击事件
    this.svg.on('click', (event) => {
      if (event.target === this.svg.node()) {
        const [x, y] = d3.pointer(event, this.g.node());
        this.events.onCanvasClick?.(x, y, event);
      }
    });
  }

  // 添加箭头标记
  private addArrowMarkers(): void {
    const defs = this.svg.append('defs');

    // 创建不同颜色的箭头标记
    const colors = ['#6b7280', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6'];
    
    colors.forEach(color => {
      defs.append('marker')
        .attr('id', `arrow-${color.replace('#', '')}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 8)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', color);
    });
  }

  // 初始化力导向仿真
  private initializeSimulation(): void {
    this.simulation = d3.forceSimulation<SimulationNode, SimulationLink>()
      .force('link', d3.forceLink<SimulationNode, SimulationLink>()
        .id(d => d.id)
        .distance(100)
        .strength(0.5))
      .force('charge', d3.forceManyBody()
        .strength(-300)
        .distanceMax(500))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide()
        .radius(50)
        .strength(0.7))
      .alphaDecay(0.02)
      .velocityDecay(0.3);

    // 设置仿真tick事件
    this.simulation.on('tick', () => {
      this.updateVisualElements();
    });
  }

  // 初始化缩放行为
  private initializeZoom(): void {
    this.zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        const { transform } = event;
        this.g.attr('transform', transform);
        this.events.onZoom?.(transform.k, transform.x, transform.y);
      });

    this.svg.call(this.zoom);
  }

  // 渲染思维导图
  render(mindMap: MindMap): void {
    this.preparseData(mindMap);
    this.renderLinks();
    this.renderNodes();
    this.updateSimulation();
    this.centerView();
  }

  // 预处理数据
  private preparseData(mindMap: MindMap): void {
    // 转换节点数据
    this.nodes = mindMap.nodes.map(node => ({
      ...node,
      x: node.position.x,
      y: node.position.y
    }));

    // 转换边数据
    this.links = mindMap.edges.map(edge => ({
      source: edge.source,
      target: edge.target,
      edge
    }));
  }

  // 渲染连接线
  private renderLinks(): void {
    const linkSelection = this.g.selectAll<SVGLineElement, SimulationLink>('.link')
      .data(this.links, d => d.edge.id);

    // 移除旧的连接线
    linkSelection.exit().remove();

    // 添加新的连接线
    const linkEnter = linkSelection.enter()
      .append('line')
      .attr('class', 'link')
      .style('cursor', 'pointer');

    // 更新连接线样式
    linkEnter.merge(linkSelection)
      .attr('stroke', d => d.edge.style.color)
      .attr('stroke-width', d => d.edge.style.width)
      .attr('stroke-dasharray', d => {
        switch (d.edge.style.strokeType) {
          case 'dashed': return '5,5';
          case 'dotted': return '2,2';
          default: return 'none';
        }
      })
      .attr('marker-end', d => {
        if (d.edge.style.arrow) {
          const colorId = d.edge.style.color.replace('#', '');
          return `url(#arrow-${colorId})`;
        }
        return 'none';
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        this.events.onEdgeClick?.(d.edge, event);
      });
  }

  // 渲染节点
  private renderNodes(): void {
    const nodeSelection = this.g.selectAll<SVGGElement, SimulationNode>('.node')
      .data(this.nodes, d => d.id);

    // 移除旧节点
    nodeSelection.exit().remove();

    // 添加新节点组
    const nodeEnter = nodeSelection.enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer');

    // 为每个节点添加形状
    nodeEnter.each((d, i, nodes) => {
      const nodeGroup = d3.select(nodes[i]);
      this.addNodeShape(nodeGroup, d);
      this.addNodeText(nodeGroup, d);
    });

    // 添加交互事件
    const allNodes = nodeEnter.merge(nodeSelection);
    this.addNodeInteractions(allNodes);

    // 添加拖拽行为
    allNodes.call(d3.drag<SVGGElement, SimulationNode>()
      .on('start', (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
        this.svg.style('cursor', 'grabbing');
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
        this.events.onNodeDrag?.(d, event.x, event.y);
      })
      .on('end', (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        this.svg.style('cursor', 'grab');
      })
    );
  }

  // 添加节点形状
  private addNodeShape(nodeGroup: d3.Selection<SVGGElement, SimulationNode, SVGGElement, unknown>, node: SimulationNode): void {
    const { shape, color, borderColor, borderWidth } = node.style;
    const { width, height } = node.size;

    switch (shape) {
      case 'circle':
        nodeGroup.append('circle')
          .attr('class', 'node-shape')
          .attr('r', Math.min(width, height) / 2)
          .attr('fill', color)
          .attr('stroke', borderColor)
          .attr('stroke-width', borderWidth || 2);
        break;

      case 'diamond':
        const points = [
          [0, -height/2],
          [width/2, 0],
          [0, height/2],
          [-width/2, 0]
        ].map(p => p.join(',')).join(' ');
        
        nodeGroup.append('polygon')
          .attr('class', 'node-shape')
          .attr('points', points)
          .attr('fill', color)
          .attr('stroke', borderColor)
          .attr('stroke-width', borderWidth || 2);
        break;

      case 'ellipse':
        nodeGroup.append('ellipse')
          .attr('class', 'node-shape')
          .attr('rx', width / 2)
          .attr('ry', height / 2)
          .attr('fill', color)
          .attr('stroke', borderColor)
          .attr('stroke-width', borderWidth || 2);
        break;

      case 'hexagon':
        const hexPoints = this.getHexagonPoints(width, height);
        nodeGroup.append('polygon')
          .attr('class', 'node-shape')
          .attr('points', hexPoints)
          .attr('fill', color)
          .attr('stroke', borderColor)
          .attr('stroke-width', borderWidth || 2);
        break;

      default: // rectangle
        nodeGroup.append('rect')
          .attr('class', 'node-shape')
          .attr('x', -width/2)
          .attr('y', -height/2)
          .attr('width', width)
          .attr('height', height)
          .attr('rx', 8)
          .attr('ry', 8)
          .attr('fill', color)
          .attr('stroke', borderColor)
          .attr('stroke-width', borderWidth || 2);
        break;
    }
  }

  // 获取六边形顶点
  private getHexagonPoints(width: number, height: number): string {
    const rx = width / 2;
    const ry = height / 2;
    const points = [];
    
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const x = rx * Math.cos(angle);
      const y = ry * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    
    return points.join(' ');
  }

  // 添加节点文本
  private addNodeText(nodeGroup: d3.Selection<SVGGElement, SimulationNode, SVGGElement, unknown>, node: SimulationNode): void {
    const text = nodeGroup.append('text')
      .attr('class', 'node-text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', node.style.textColor)
      .attr('font-size', node.style.fontSize || 12)
      .attr('font-weight', '500')
      .style('pointer-events', 'none')
      .style('user-select', 'none');

    // 处理长文本换行
    this.wrapText(text, node.title, node.size.width - 10);
  }

  // 文本换行处理
  private wrapText(
    text: d3.Selection<SVGTextElement, SimulationNode, SVGGElement, unknown>, 
    content: string, 
    maxWidth: number
  ): void {
    const words = content.split(/\s+/);
    let line: string[] = [];
    let lineNumber = 0;
    const lineHeight = 1.1;
    const fontSize = 12;

    text.text(null); // 清空文本

    words.forEach(word => {
      line.push(word);
      const testLine = line.join(' ');
      
      // 创建临时文本元素测量宽度
      const testText = text.append('tspan').text(testLine);
      const textLength = (testText.node() as SVGTSpanElement).getComputedTextLength();
      testText.remove();

      if (textLength > maxWidth && line.length > 1) {
        line.pop();
        text.append('tspan')
          .attr('x', 0)
          .attr('dy', lineNumber === 0 ? `-${fontSize * lineHeight / 2}px` : `${fontSize * lineHeight}px`)
          .text(line.join(' '));
        line = [word];
        lineNumber++;
      }
    });

    // 添加最后一行
    if (line.length > 0) {
      text.append('tspan')
        .attr('x', 0)
        .attr('dy', lineNumber === 0 ? '0' : `${fontSize * lineHeight}px`)
        .text(line.join(' '));
    }
  }

  // 添加节点交互
  private addNodeInteractions(nodes: d3.Selection<SVGGElement, SimulationNode, SVGGElement, unknown>): void {
    nodes
      .on('click', (event, d) => {
        event.stopPropagation();
        this.events.onNodeClick?.(d, event);
      })
      .on('dblclick', (event, d) => {
        event.stopPropagation();
        this.events.onNodeDoubleClick?.(d, event);
      })
      .on('mouseenter', function() {
        d3.select(this).select('.node-shape')
          .transition()
          .duration(200)
          .attr('stroke-width', 3)
          .style('filter', 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))');
      })
      .on('mouseleave', function(event, d) {
        d3.select(this).select('.node-shape')
          .transition()
          .duration(200)
          .attr('stroke-width', d.style.borderWidth || 2)
          .style('filter', 'none');
      });
  }

  // 更新仿真
  private updateSimulation(): void {
    this.simulation
      .nodes(this.nodes)
      .force('link', d3.forceLink<SimulationNode, SimulationLink>(this.links)
        .id(d => d.id)
        .distance(100)
        .strength(0.5));

    this.simulation.alpha(1).restart();
  }

  // 更新可视化元素位置
  private updateVisualElements(): void {
    // 更新连接线位置
    this.g.selectAll<SVGLineElement, SimulationLink>('.link')
      .attr('x1', d => (d.source as SimulationNode).x || 0)
      .attr('y1', d => (d.source as SimulationNode).y || 0)
      .attr('x2', d => (d.target as SimulationNode).x || 0)
      .attr('y2', d => (d.target as SimulationNode).y || 0);

    // 更新节点位置
    this.g.selectAll<SVGGElement, SimulationNode>('.node')
      .attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`);
  }

  // 居中视图
  centerView(): void {
    if (this.nodes.length === 0) return;

    const bounds = this.getNodesBounds();
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    const scale = Math.min(
      width / (bounds.width + 100),
      height / (bounds.height + 100),
      1
    );

    const centerX = width / 2 - (bounds.centerX * scale);
    const centerY = height / 2 - (bounds.centerY * scale);

    this.svg.transition()
      .duration(750)
      .call(this.zoom.transform, d3.zoomIdentity.translate(centerX, centerY).scale(scale));
  }

  // 获取节点边界
  private getNodesBounds(): { width: number; height: number; centerX: number; centerY: number } {
    const xs = this.nodes.map(d => d.x || 0);
    const ys = this.nodes.map(d => d.y || 0);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  }

  // 添加节点
  addNode(node: MindMapNode): void {
    this.nodes.push({
      ...node,
      x: node.position.x,
      y: node.position.y
    });
    this.renderNodes();
    this.updateSimulation();
  }

  // 移除节点
  removeNode(nodeId: string): void {
    this.nodes = this.nodes.filter(n => n.id !== nodeId);
    this.links = this.links.filter(l => 
      (l.source as SimulationNode).id !== nodeId && 
      (l.target as SimulationNode).id !== nodeId
    );
    this.render({ nodes: this.nodes, edges: this.links.map(l => l.edge) } as MindMap);
  }

  // 缩放控制
  zoomIn(): void {
    this.svg.transition().duration(300).call(this.zoom.scaleBy, 1.5);
  }

  zoomOut(): void {
    this.svg.transition().duration(300).call(this.zoom.scaleBy, 1 / 1.5);
  }

  resetZoom(): void {
    this.centerView();
  }

  // 销毁渲染器
  destroy(): void {
    this.simulation.stop();
    d3.select(this.container).selectAll('*').remove();
  }
}