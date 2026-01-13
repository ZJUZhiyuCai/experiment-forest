import React, { useState, useEffect, lazy, Suspense } from 'react';

// 动态导入重型依赖,实现代码分割
const loadMarkdownLibs = async () => {
  const [markedModule, dompurifyModule, katexModule, hljsModule] = await Promise.all([
    import('marked'),
    import('dompurify'),
    import('katex'),
    import('highlight.js')
  ]);

  return {
    marked: markedModule.default,
    DOMPurify: dompurifyModule.default,
    katex: katexModule.default,
    hljs: hljsModule.default
  };
};

// 全局缓存加载的库
let libsCache: Awaited<ReturnType<typeof loadMarkdownLibs>> | null = null;
let loadPromise: Promise<Awaited<ReturnType<typeof loadMarkdownLibs>>> | null = null;

// 处理代码高亮和数学公式的函数(异步版本)
async function processMarkdown(markdown: string, libs: Awaited<ReturnType<typeof loadMarkdownLibs>>): Promise<string> {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  try {
    const { marked } = libs;

    // 配置marked选项(只配置一次)
    if (!marked.defaults?.gfm) {
      marked.setOptions({
        gfm: true,
        breaks: true,
        pedantic: false
      });
    }

    // 预处理代码块中的数学公式，防止语法冲突
    const codeBlocks: string[] = [];
    let codeBlockCounter = 0;

    const markdownWithoutCode = markdown.replace(/```([\s\S]+?)```/g, (match) => {
      const placeholder = `__CODE_BLOCK_${codeBlockCounter++}__`;
      codeBlocks.push(match);
      return placeholder;
    });

    let html = await marked.parse(markdownWithoutCode) as string;

    // 处理数学公式
    html = await processLatexFormulas(html, libs);

    // 恢复代码块
    codeBlocks.forEach((codeBlock, index) => {
      const placeholder = `__CODE_BLOCK_${index}__`;
      html = html.replace(new RegExp(placeholder, 'g'), codeBlock);
    });

    html = await marked.parse(html) as string;

    // 处理代码高亮
    html = await processCodeHighlighting(html, libs);

    return html;
  } catch (error) {
    console.error('处理Markdown错误:', error);
    return `<pre class="whitespace-pre-wrap text-red-600">${markdown}</pre>`;
  }
}

// 处理数学公式
async function processLatexFormulas(html: string, libs: Awaited<ReturnType<typeof loadMarkdownLibs>>): Promise<string> {
  const { katex } = libs;

  html = html.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
    try {
      return katex.renderToString(formula.trim(), {
        displayMode: true,
        throwOnError: false,
        output: 'html'
      });
    } catch (err) {
      console.error('KaTeX渲染错误:', err);
      return match;
    }
  });

  html = html.replace(/(?<![\\\$])\$(?!\$)(?=\S)([^\$]+?)(?<=\S)\$(?!\$)/g, (match, formula) => {
    if (/^\d+(\.\d+)?$/.test(formula.trim())) {
      return match;
    }

    try {
      return katex.renderToString(formula.trim(), {
        displayMode: false,
        throwOnError: false,
        output: 'html'
      });
    } catch (err) {
      console.error('KaTeX渲染错误:', err);
      return match;
    }
  });

  return html;
}

// 处理代码高亮
async function processCodeHighlighting(html: string, libs: Awaited<ReturnType<typeof loadMarkdownLibs>>): Promise<string> {
  const { hljs } = libs;

  html = html.replace(/<pre><code(?:\s+class="language-([^"]+)")?>([\s\S]+?)<\/code><\/pre>/g, (match, lang, code) => {
    if (!code) return match;

    try {
      code = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

      let highlighted;
      if (lang && hljs.getLanguage(lang)) {
        highlighted = hljs.highlight(code, { language: lang }).value;
      } else {
        const result = hljs.highlightAuto(code);
        highlighted = result.value;
        lang = lang || result.language;
      }

      const codeId = `code-${Math.random().toString(36).substring(2, 9)}`;

      const languageNames: Record<string, string> = {
        'js': 'JavaScript', 'ts': 'TypeScript', 'jsx': 'React JSX', 'tsx': 'React TSX',
        'html': 'HTML', 'css': 'CSS', 'scss': 'SCSS', 'less': 'Less',
        'python': 'Python', 'py': 'Python', 'java': 'Java', 'c': 'C',
        'cpp': 'C++', 'csharp': 'C#', 'go': 'Go', 'rust': 'Rust',
        'php': 'PHP', 'ruby': 'Ruby', 'json': 'JSON', 'xml': 'XML',
        'yaml': 'YAML', 'yml': 'YAML', 'md': 'Markdown', 'markdown': 'Markdown',
        'sql': 'SQL', 'shell': 'Shell', 'bash': 'Bash', 'sh': 'Shell',
      };

      const displayLang = lang ? (languageNames[lang] || lang) : '代码';

      return `<div class="my-4 bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <div class="flex justify-between items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">${displayLang}</span>
          <button
            class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            onclick="{
              const codeElem = document.getElementById('${codeId}');
              if (codeElem) {
                navigator.clipboard.writeText(codeElem.textContent || '');
                this.innerHTML = '<i class=\'fa-solid fa-check mr-1\'></i>已复制';
                setTimeout(() => {
                  this.innerHTML = '<i class=\'fa-regular fa-copy mr-1\'></i>复制';
                }, 2000);
              }
            }">
            <i class="fa-regular fa-copy mr-1"></i>复制
          </button>
        </div>
        <pre class="overflow-auto p-4 text-sm m-0"><code id="${codeId}" class="hljs ${lang ? `language-${lang}` : ''}">${highlighted}</code></pre>
      </div>`;
    } catch (err) {
      console.error('代码高亮错误:', err);
      return match;
    }
  });

  return html;
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
  tableCaption?: string;
}

// 加载指示器组件
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8 space-x-3">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
      <span className="text-sm text-gray-600 dark:text-gray-400">正在加载Markdown渲染器...</span>
    </div>
  );
}

export function MarkdownRenderer({ content = '', className = '', tableCaption }: MarkdownRendererProps) {
  const [errorState, setErrorState] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const safeContent = content || '';

  // 当内容变化时渲染Markdown
  useEffect(() => {
    let isCancelled = false;

    const renderMarkdown = async () => {
      if (!safeContent.trim()) {
        setHtmlContent('');
        setErrorState(null);
        return;
      }

      setIsLoading(true);

      try {
        // 加载或获取缓存的库
        let libs = libsCache;
        if (!libs) {
          if (!loadPromise) {
            loadPromise = loadMarkdownLibs();
          }
          libs = await loadPromise;

          // 缓存库供后续使用
          if (!isCancelled) {
            libsCache = libs;
          }
        }

        if (isCancelled) return;

        // 处理Markdown内容
        const processedHtml = await processMarkdown(safeContent, libs);

        // 使用DOMPurify清理HTML防止XSS攻击
        const cleanHtml = libs.DOMPurify.sanitize(processedHtml);

        // 添加样式和类
        let enhancedHtml = addStylesAndClasses(cleanHtml);

        setHtmlContent(enhancedHtml);
        setErrorState(null);
      } catch (error) {
        console.error("Markdown渲染错误:", error);
        setErrorState(`错误: ${error instanceof Error ? error.message : String(error)}`);
        setHtmlContent(`<pre class="whitespace-pre-wrap">${safeContent}</pre>`);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    renderMarkdown();

    return () => {
      isCancelled = true;
    };
  }, [safeContent]);
  
  // 添加样式和类到HTML内容
  const addStylesAndClasses = (html: string): string => {
    // 使用正则表达式替换HTML标签并添加类
    let result = html;
    
    // 表格样式
    result = result.replace(
      /<table>/g,
      `<div class="my-6"><div class="overflow-x-auto rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"><table class="min-w-full border-collapse table-auto w-full">`
    );
    result = result.replace(/<\/table>/g, `</table></div></div>`);
    result = result.replace(/<thead>/g, `<thead class="bg-gray-100 dark:bg-gray-700">`);
    result = result.replace(/<tbody>/g, `<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">`);
    result = result.replace(/<tr>/g, `<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">`);
    result = result.replace(/<th>/g, `<th class="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">`);
    result = result.replace(/<td>/g, `<td class="px-4 py-2 text-sm text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">`);
    
    // 标题样式
    result = result.replace(/<h1>/g, `<h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-6 border-b pb-2 border-gray-200 dark:border-gray-700">`);
    result = result.replace(/<h2>/g, `<h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4 mt-8">`);
    result = result.replace(/<h3>/g, `<h3 class="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3 mt-6">`);
    result = result.replace(/<h4>/g, `<h4 class="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2 mt-4">`);
    result = result.replace(/<h5>/g, `<h5 class="text-base font-medium text-gray-700 dark:text-gray-300 mb-2 mt-4">`);
    result = result.replace(/<h6>/g, `<h6 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 mt-3">`);
    
    // 段落样式
    result = result.replace(/<p>/g, `<p class="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed">`);
    
    // 链接样式
    result = result.replace(
      /<a\s+href="([^"]+)">/g, 
      `<a href="$1" class="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">`
    );
    
    // 列表样式
    result = result.replace(/<ul>/g, `<ul class="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">`);
    result = result.replace(/<ol>/g, `<ol class="list-decimal pl-6 mb-4 text-gray-700 dark:text-gray-300">`);
    result = result.replace(/<li>/g, `<li class="mb-1">`);
    
    // 引用样式
    result = result.replace(
      /<blockquote>/g, 
      `<blockquote class="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-700 dark:text-gray-400 my-4">`
    );
    
    // 行内代码样式 - 不覆盖已经高亮的代码块
    result = result.replace(
      /<code>(?!<\/code>)([^<]*)<\/code>/g, 
      `<code class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono">$1</code>`
    );
    
    // 分隔线样式
    result = result.replace(/<hr>/g, `<hr class="my-6 border-gray-200 dark:border-gray-700">`);
    
    // 强调样式
    result = result.replace(/<em>/g, `<em class="italic">`);
    result = result.replace(/<strong>/g, `<strong class="font-bold">`);
    
    // 数学公式的额外样式
    result = result.replace(
      /<span class="katex">/g,
      `<span class="katex inline-math-formula">`
    );
    result = result.replace(
      /<div class="katex-display">/g,
      `<div class="katex-display math-formula my-4 px-4 py-2 bg-blue-50 dark:bg-blue-900/10 rounded-lg shadow-sm border border-blue-100 dark:border-blue-900/20">`
    );
    
    return result;
  };

  // 如果有错误状态，显示错误信息
  if (errorState) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
        <p className="font-medium mb-2">渲染Markdown内容时出错:</p>
        <p className="text-sm">{errorState}</p>
      </div>
    );
  }

  // 显示加载状态
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // 如果内容为空，显示提示
  if (!safeContent.trim()) {
    return (
      <div className="p-4 text-gray-400 dark:text-gray-500 text-center italic">
        无内容
      </div>
    );
  }
  
  // 渲染HTML内容
  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        /* 自定义数学公式样式 */
        .inline-math-formula {
          font-size: 1.1em;
        }
        .math-formula {
          position: relative;
        }
        
        /* 为实验记录和SOP特定样式 */
        .experimental-data-display .math-formula,
        .sop-procedure .math-formula {
          margin-left: 1rem;
          margin-right: 1rem;
        }
        
        /* 增强代码块样式 */
        pre code.hljs {
          padding-bottom: 1.5em !important;
        }
      `}} />
      <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      {tableCaption && (
        <figcaption className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2 italic">
          {tableCaption}
        </figcaption>
      )}
    </div>
  );
}