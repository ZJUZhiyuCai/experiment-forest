import { useState, useEffect } from 'react';
import { Button } from './Button';

interface ExcelTableProps {
  visible: boolean;
  onClose: () => void;
  onInsert: (tableData: string[][]) => void;
  initialRows?: number;
  initialColumns?: number;
}

// 表格样式选项
interface TableStyle {
  hasHeader: boolean;
  headerBg: string;
  borderStyle: 'simple' | 'bordered' | 'striped';
  alignment: 'left' | 'center' | 'right';
}

// 实验数据模板
const EXPERIMENT_TEMPLATES = {
  basic: {
    name: '基础实验数据',
    icon: 'fa-flask',
    data: [
      ['项目', '数值', '单位', '备注'],
      ['温度', '25', '°C', '室温'],
      ['压力', '1', 'atm', '标准大气压'],
      ['时间', '60', 'min', '反应时间']
    ]
  },
  chemical: {
    name: '化学实验',
    icon: 'fa-vial',
    data: [
      ['试剂', '浓度', '体积(mL)', '摩尔数'],
      ['HCl', '0.1 M', '10', '0.001'],
      ['NaOH', '0.1 M', '10', '0.001'],
      ['指示剂', '-', '2-3滴', '-']
    ]
  },
  biology: {
    name: '生物实验',
    icon: 'fa-dna',
    data: [
      ['样本编号', '处理条件', '观察时间', '结果'],
      ['S001', '对照组', '24h', '正常生长'],
      ['S002', '实验组A', '24h', '抑制生长'],
      ['S003', '实验组B', '24h', '促进生长']
    ]
  },
  measurement: {
    name: '测量数据',
    icon: 'fa-ruler',
    data: [
      ['测量次数', '数值1', '数值2', '数值3', '平均值'],
      ['第1次', '', '', '', ''],
      ['第2次', '', '', '', ''],
      ['第3次', '', '', '', '']
    ]
  }
};

export function ExcelTable({
  visible,
  onClose,
  onInsert,
  initialRows = 3,
  initialColumns = 3
}: ExcelTableProps) {
  // 初始化表格数据
  const [tableData, setTableData] = useState<string[][]>([]);
  const [rows, setRows] = useState(initialRows);
  const [columns, setColumns] = useState(initialColumns);
  const [selectedCell, setSelectedCell] = useState<{ row: number, col: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'style' | 'template'>('template');

  // 表格样式状态
  const [tableStyle, setTableStyle] = useState<TableStyle>({
    hasHeader: true,
    headerBg: 'bg-earth-beige/50',
    borderStyle: 'bordered',
    alignment: 'left'
  });

  // 当行列数变化时重新初始化表格
  useEffect(() => {
    const newData: string[][] = [];

    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 0; j < columns; j++) {
        // 保留已有数据，新增的单元格为空
        if (tableData[i] && tableData[i][j] !== undefined) {
          row.push(tableData[i][j]);
        } else {
          row.push('');
        }
      }
      newData.push(row);
    }

    setTableData(newData);
  }, [rows, columns]);

  // 初始化表格数据
  useEffect(() => {
    if (visible && tableData.length === 0) {
      const newData: string[][] = [];
      for (let i = 0; i < rows; i++) {
        newData.push(Array(columns).fill(''));
      }
      setTableData(newData);
    }
  }, [visible]);

  // 处理单元格内容变化
  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newData = [...tableData];
    if (!newData[rowIndex]) {
      newData[rowIndex] = Array(columns).fill('');
    }
    newData[rowIndex][colIndex] = value;
    setTableData(newData);
  };

  // 添加行
  const addRow = () => {
    setRows(prev => prev + 1);
  };

  // 删除行
  const removeRow = () => {
    if (rows > 1) {
      setRows(prev => prev - 1);
    }
  };

  // 添加列
  const addColumn = () => {
    setColumns(prev => prev + 1);
  };

  // 删除列
  const removeColumn = () => {
    if (columns > 1) {
      setColumns(prev => prev - 1);
    }
  };

  // 清空表格
  const clearTable = () => {
    const newData: string[][] = [];
    for (let i = 0; i < rows; i++) {
      newData.push(Array(columns).fill(''));
    }
    setTableData(newData);
  };

  // 应用实验模板
  const applyTemplate = (templateKey: keyof typeof EXPERIMENT_TEMPLATES) => {
    const template = EXPERIMENT_TEMPLATES[templateKey];
    const newRows = Math.max(rows, template.data.length);
    const newColumns = Math.max(columns, template.data[0].length);

    setRows(newRows);
    setColumns(newColumns);

    const newData: string[][] = [];
    for (let i = 0; i < newRows; i++) {
      const row = [];
      for (let j = 0; j < newColumns; j++) {
        if (template.data[i] && template.data[i][j]) {
          row.push(template.data[i][j]);
        } else {
          row.push('');
        }
      }
      newData.push(row);
    }

    setTableData(newData);
    // 模板通常第一行是表头
    setTableStyle(prev => ({ ...prev, hasHeader: true }));
    setActiveTab('edit');
  };

  // 插入表格到内容中
  const handleInsert = () => {
    // 生成带样式的Markdown表格
    let markdownTable = '';

    if (tableData.length > 0 && tableData[0].length > 0) {
      // 表头
      markdownTable += '| ';
      const headerRow = tableStyle.hasHeader ? tableData[0] :
        Array.from({ length: columns }, (_, i) => getColumnName(i));

      headerRow.forEach(cell => {
        markdownTable += `${cell || ''} |`;
      });
      markdownTable += '\n| ';

      // 分隔线（支持对齐方式）
      for (let i = 0; i < columns; i++) {
        switch (tableStyle.alignment) {
          case 'center':
            markdownTable += ':---: |';
            break;
          case 'right':
            markdownTable += '---: |';
            break;
          default:
            markdownTable += '--- |';
        }
      }

      // 数据行
      const startRow = tableStyle.hasHeader ? 1 : 0;
      for (let i = startRow; i < tableData.length; i++) {
        markdownTable += '\n| ';
        tableData[i].forEach(cell => {
          markdownTable += `${cell || ''} |`;
        });
      }
    }

    // 调用原来的方式插入
    const tableLines = markdownTable.split('\n');
    const tableArray = tableLines.map(line => [line]);
    onInsert(tableArray);
    onClose();
  };

  // 获取列名 (A, B, C, ...)
  const getColumnName = (index: number) => {
    let name = '';
    let num = index;
    do {
      name = String.fromCharCode(65 + (num % 26)) + name;
      num = Math.floor(num / 26) - 1;
    } while (num >= 0);
    return name;
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-forest-accent/20">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-xl font-bold text-forest-primary">
                <i className="fa-solid fa-table mr-2 text-forest-secondary"></i>
                高级表格编辑器
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                支持样式定制、实验模板和智能编辑
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <i className="fa-solid fa-times text-gray-500"></i>
            </button>
          </div>

          {/* 标签页导航 */}
          <div className="flex space-x-1 bg-earth-beige/30 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('template')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'template'
                  ? 'bg-white text-forest-primary shadow-sm'
                  : 'text-text-muted hover:text-text-main'
                }`}
            >
              <i className="fa-solid fa-magic mr-1"></i>
              实验模板
            </button>
            <button
              onClick={() => setActiveTab('edit')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'edit'
                  ? 'bg-white text-forest-primary shadow-sm'
                  : 'text-text-muted hover:text-text-main'
                }`}
            >
              <i className="fa-solid fa-edit mr-1"></i>
              编辑表格
            </button>
            <button
              onClick={() => setActiveTab('style')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'style'
                  ? 'bg-white text-forest-primary shadow-sm'
                  : 'text-text-muted hover:text-text-main'
                }`}
            >
              <i className="fa-solid fa-palette mr-1"></i>
              样式设置
            </button>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-auto">
          {/* 模板选择页 */}
          {activeTab === 'template' && (
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                选择实验数据模板
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(EXPERIMENT_TEMPLATES).map(([key, template]) => (
                  <button
                    key={key}
                    onClick={() => applyTemplate(key as keyof typeof EXPERIMENT_TEMPLATES)}
                    className="p-4 border border-forest-accent/20 rounded-xl hover:border-forest-secondary/50 hover:bg-forest-main/5 transition-all text-left group"
                  >
                    <div className="flex items-center mb-2">
                      <i className={`fa-solid ${template.icon} text-2xl text-forest-secondary mr-3`}></i>
                      <h5 className="font-semibold text-text-main group-hover:text-forest-primary">
                        {template.name}
                      </h5>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {template.data.length} 行 × {template.data[0].length} 列
                    </div>
                    <div className="mt-2 text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 rounded p-2 font-mono">
                      {template.data[0].join(' | ')}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 表格编辑页 */}
          {activeTab === 'edit' && (
            <div>
              {/* 工具栏 */}
              <div className="mb-6 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <div className="flex flex-wrap gap-4 items-center justify-between">
                  <div className="flex flex-wrap gap-4">
                    {/* 行列控制 */}
                    <div className="flex space-x-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <i className="fa-solid fa-arrows-v mr-1"></i>
                          行数: {rows}
                        </label>
                        <div className="flex space-x-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={removeRow}
                            disabled={rows <= 1}
                            className="w-8 h-8 p-0"
                          >
                            <i className="fa-solid fa-minus"></i>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addRow}
                            className="w-8 h-8 p-0"
                          >
                            <i className="fa-solid fa-plus"></i>
                          </Button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <i className="fa-solid fa-arrows-h mr-1"></i>
                          列数: {columns}
                        </label>
                        <div className="flex space-x-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={removeColumn}
                            disabled={columns <= 1}
                            className="w-8 h-8 p-0"
                          >
                            <i className="fa-solid fa-minus"></i>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addColumn}
                            className="w-8 h-8 p-0"
                          >
                            <i className="fa-solid fa-plus"></i>
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* 快捷操作 */}
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearTable}
                        className="text-status-error hover:text-red-700"
                      >
                        <i className="fa-solid fa-eraser mr-1"></i>
                        清空
                      </Button>
                    </div>
                  </div>

                  <div className="text-sm text-text-muted bg-forest-secondary/10 px-3 py-2 rounded-lg">
                    <i className="fa-solid fa-info-circle mr-1"></i>
                    点击单元格编辑内容，支持Tab键切换
                  </div>
                </div>
              </div>

              {/* 表格编辑区域 */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    {/* 表头 - 列标签 */}
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <th className="w-12 px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          #
                        </th>
                        {Array.from({ length: columns }, (_, index) => (
                          <th key={index} className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {getColumnName(index)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {tableData.map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          {/* 行标签 */}
                          <td className="w-12 px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50">
                            {rowIndex + 1}
                          </td>
                          {row.map((cell, colIndex) => (
                            <td key={colIndex} className="border-r border-gray-200 dark:border-gray-700 last:border-r-0">
                              <input
                                type="text"
                                value={cell}
                                onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                                onFocus={() => setSelectedCell({ row: rowIndex, col: colIndex })}
                                onBlur={() => setSelectedCell(null)}
                                className={`w-full h-full px-3 py-2 text-sm border-0 focus:ring-2 focus:ring-forest-secondary bg-transparent transition-all ${selectedCell?.row === rowIndex && selectedCell?.col === colIndex
                                    ? 'bg-forest-secondary/10'
                                    : 'hover:bg-earth-beige/30'
                                  } min-w-[120px] ${tableStyle.hasHeader && rowIndex === 0
                                    ? 'font-semibold bg-gray-100 dark:bg-gray-800'
                                    : ''
                                  }`}
                                placeholder={`${getColumnName(colIndex)}${rowIndex + 1}`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 样式设置页 */}
          {activeTab === 'style' && (
            <div className="space-y-6">
              <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                表格样式设置
              </h4>

              {/* 表头设置 */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h5 className="font-medium text-gray-800 dark:text-white mb-3">
                  <i className="fa-solid fa-header mr-2"></i>
                  表头设置
                </h5>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={tableStyle.hasHeader}
                      onChange={(e) => setTableStyle(prev => ({ ...prev, hasHeader: e.target.checked }))}
                      className="mr-2 text-forest-secondary focus:ring-forest-secondary"
                    />
                    第一行作为表头
                  </label>
                </div>
              </div>

              {/* 对齐方式 */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h5 className="font-medium text-gray-800 dark:text-white mb-3">
                  <i className="fa-solid fa-align-center mr-2"></i>
                  文本对齐
                </h5>
                <div className="flex space-x-2">
                  {['left', 'center', 'right'].map((align) => (
                    <button
                      key={align}
                      onClick={() => setTableStyle(prev => ({ ...prev, alignment: align as any }))}
                      className={`px-3 py-2 rounded-lg text-sm border transition-all ${tableStyle.alignment === align
                          ? 'bg-forest-secondary/10 border-forest-secondary text-forest-primary'
                          : 'bg-earth-beige/30 border-forest-accent/20 text-text-main hover:bg-earth-beige/50'
                        }`}
                    >
                      <i className={`fa-solid fa-align-${align} mr-1`}></i>
                      {align === 'left' ? '左对齐' : align === 'center' ? '居中' : '右对齐'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 边框样式 */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h5 className="font-medium text-gray-800 dark:text-white mb-3">
                  <i className="fa-solid fa-border-all mr-2"></i>
                  边框样式
                </h5>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'simple', name: '简单', icon: 'fa-minus' },
                    { key: 'bordered', name: '带边框', icon: 'fa-border-all' },
                    { key: 'striped', name: '条纹', icon: 'fa-list' }
                  ].map((style) => (
                    <button
                      key={style.key}
                      onClick={() => setTableStyle(prev => ({ ...prev, borderStyle: style.key as any }))}
                      className={`p-3 rounded-lg text-sm border transition-all text-center ${tableStyle.borderStyle === style.key
                          ? 'bg-forest-secondary/10 border-forest-secondary text-forest-primary'
                          : 'bg-earth-beige/30 border-forest-accent/20 text-text-main hover:bg-earth-beige/50'
                        }`}
                    >
                      <i className={`fa-solid ${style.icon} text-lg mb-1 block`}></i>
                      {style.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 表格预览（通用） */}
          {(activeTab === 'edit' || activeTab === 'style') && tableData.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                <i className="fa-solid fa-eye mr-1"></i>
                Markdown 预览（将插入到实验记录中）
              </h4>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 text-sm font-mono text-gray-600 dark:text-gray-400 max-h-32 overflow-y-auto">
                <pre className="whitespace-pre-wrap">
                  {/* 表头 */}
                  | {tableStyle.hasHeader ? tableData[0].join(' | ') : Array.from({ length: columns }, (_, i) => getColumnName(i)).join(' | ')} |
                  {/* 分隔线 */}
                  | {Array.from({ length: columns }, () => {
                    switch (tableStyle.alignment) {
                      case 'center': return ':---:';
                      case 'right': return '---:';
                      default: return '---';
                    }
                  }).join(' | ')} |
                  {/* 数据行 */}
                  {(tableStyle.hasHeader ? tableData.slice(1) : tableData).map(row =>
                    `| ${row.map(cell => cell || '').join(' | ')} |`
                  ).join('\n')}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 flex justify-between items-center border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            当前表格大小: {rows} 行 × {columns} 列
          </div>
          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              <i className="fa-solid fa-times mr-2"></i>
              取消
            </Button>
            <Button
              type="button"
              onClick={handleInsert}
              className="bg-forest-secondary hover:bg-forest-primary text-white"
            >
              <i className="fa-solid fa-check mr-2"></i>
              插入表格
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}