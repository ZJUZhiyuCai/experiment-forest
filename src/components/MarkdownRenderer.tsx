import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const renderContent = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();

      // 处理表格
      if (line.startsWith('|') && line.endsWith('|')) {
        const tableLines: string[] = [];
        let j = i;
        
        // 收集所有表格行
        while (j < lines.length && lines[j].trim().startsWith('|') && lines[j].trim().endsWith('|')) {
          tableLines.push(lines[j].trim());
          j++;
        }
        
        if (tableLines.length >= 2) {
          // 渲染表格
          const headerRow = tableLines[0];
          const separatorRow = tableLines[1];
          const dataRows = tableLines.slice(2);
          
          // 解析表头
          const headers = headerRow.split('|').slice(1, -1).map(h => h.trim());
          
          // 解析数据行
          const rows = dataRows.map(row => 
            row.split('|').slice(1, -1).map(cell => cell.trim())
          );

          elements.push(
            <div key={`table-${i}`} className="my-4 overflow-x-auto">
              <table className="min-w-full border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {headers.map((header, idx) => (
                      <th
                        key={idx}
                        className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 border-b border-gray-300 dark:border-gray-600"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800">
                  {rows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      {row.map((cell, cellIdx) => (
                        <td
                          key={cellIdx}
                          className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                        >
                          {renderInlineContent(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          
          i = j;
          continue;
        }
      }

      // 处理图片
      const imageMatch = line.match(/!\[([^\]]*)\]\(([^)]+)(?:\s*=x(\d+))?\)(?:\s*\*([^*]+)\*)?/);
      if (imageMatch) {
        const [, alt, src, widthStr, caption] = imageMatch;
        const width = widthStr ? parseInt(widthStr) : undefined;

        elements.push(
          <div key={`image-${i}`} className="my-4 text-center">
            <img
              src={src}
              alt={alt}
              style={{ width: width ? `${width}px` : 'auto', maxWidth: '100%', height: 'auto' }}
              className="mx-auto rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                // 显示错误信息
                const errorDiv = document.createElement('div');
                errorDiv.className = 'p-4 border border-red-300 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400 text-sm';
                errorDiv.innerHTML = `<i class="fa-solid fa-exclamation-triangle mr-2"></i>图片加载失败: ${alt}`;
                target.parentNode?.insertBefore(errorDiv, target);
              }}
            />
            {caption && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic">
                {caption}
              </p>
            )}
          </div>
        );
        i++;
        continue;
      }

      // 处理标题
      if (line.startsWith('#')) {
        const level = line.match(/^#+/)?.[0].length || 1;
        const text = line.replace(/^#+\s*/, '');
        const HeadingTag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements;
        
        const headingClasses = {
          1: 'text-2xl font-bold text-gray-900 dark:text-white mb-4',
          2: 'text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3',
          3: 'text-lg font-medium text-gray-800 dark:text-gray-100 mb-2',
          4: 'text-base font-medium text-gray-700 dark:text-gray-200 mb-2',
          5: 'text-sm font-medium text-gray-700 dark:text-gray-200 mb-1',
          6: 'text-sm font-medium text-gray-600 dark:text-gray-300 mb-1',
        };

        elements.push(
          <HeadingTag key={`heading-${i}`} className={headingClasses[level as keyof typeof headingClasses]}>
            {renderInlineContent(text)}
          </HeadingTag>
        );
        i++;
        continue;
      }

      // 处理普通段落
      if (line) {
        elements.push(
          <p key={`paragraph-${i}`} className="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed">
            {renderInlineContent(line)}
          </p>
        );
      } else {
        // 空行
        elements.push(<br key={`br-${i}`} />);
      }

      i++;
    }

    return elements;
  };

  // 渲染行内内容（粗体、斜体、链接等）
  const renderInlineContent = (text: string) => {
    // 处理粗体 **text**
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // 处理斜体 *text*
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // 处理代码 `code`
    text = text.replace(/`(.*?)`/g, '<code class="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono">$1</code>');
    
    // 处理链接 [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">$1</a>');

    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  };

  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
      {renderContent(content)}
    </div>
  );
}