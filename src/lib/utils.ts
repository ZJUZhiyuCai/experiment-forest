import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 修复常见的JSON格式问题
 */
export function fixJson(jsonString: string): string {
  // 创建原始字符串的深拷贝用于处理
  let fixedJson = jsonString;
  
  // 增强修复1: 移除所有开头和结尾的非JSON字符
  const jsonStart = fixedJson.search(/[{[]/);
  const jsonEnd = fixedJson.lastIndexOf('}') > fixedJson.lastIndexOf(']') 
    ? fixedJson.lastIndexOf('}') + 1 
    : fixedJson.lastIndexOf(']') + 1;
  
  if (jsonStart !== -1 && jsonEnd !== -1) {
    fixedJson = fixedJson.substring(jsonStart, jsonEnd);
  } else if (jsonStart !== -1) {
    fixedJson = fixedJson.substring(jsonStart);
  } else if (jsonEnd !== -1) {
    fixedJson = fixedJson.substring(0, jsonEnd);
  }
  
  // 增强修复2: 处理过度转义的引号
  // 先处理双反斜杠转义的情况
  fixedJson = fixedJson.replace(/\\\\/g, '\\');
  
  // 增强修复3: 处理中文引号和特殊引号
  fixedJson = fixedJson
    .replace(/“/g, '"')
    .replace(/”/g, '"')
    .replace(/‘/g, "'")
    .replace(/’/g, "'");
  
  // 增强修复4: 处理错误的属性名引号和冒号
  // 修复类似 "{\"\\bid\\b\\\": ...}" 的问题
  fixedJson = fixedJson.replace(/\\{2,}/g, '\\');
  fixedJson = fixedJson.replace(/\\\"/g, '"');
  fixedJson = fixedJson.replace(/\\b/g, '');
  
  // 增强修复5: 处理缺少冒号的属性名
  // 修复缺少冒号的属性名 (增强版)
  fixedJson = fixedJson.replace(/"(\w+)"\s*"([^"]+)"/g, '"$1": "$2"');
  fixedJson = fixedJson.replace(/"(\w+)"\s*(\{|\[)/g, '"$1": $2');
  
  // 增强修复6: 处理空属性名
  fixedJson = fixedJson.replace(/"":/g, '"empty_property":');
  
  // 增强修复7: 处理未闭合的引号
  const quoteCount = (fixedJson.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    // 尝试找到最后一个未闭合的引号位置
    const lastQuoteIndex = fixedJson.lastIndexOf('"');
    if (lastQuoteIndex !== -1 && !(lastQuoteIndex > 0 && fixedJson[lastQuoteIndex - 1] === '\\')) {
      // 在最后一个引号后添加闭合引号
      fixedJson = fixedJson.substring(0, lastQuoteIndex + 1) + 
                 fixedJson.substring(lastQuoteIndex + 1) + '"';
    } else {
      // 如果找不到引号，在末尾添加
      fixedJson += '"';
    }
  }
  
  // 增强修复8: 处理数字属性名
  fixedJson = fixedJson.replace(/(\d+):/g, '"$1":');
  
  // 增强修复9: 处理缺少逗号
  fixedJson = fixedJson.replace(/\}([\s\n]*)\{/g, '},{');
  fixedJson = fixedJson.replace(/\}"([\s\n]*)\"/g, '},"');
  
  // 增强修复10: 处理注释（JSON不支持注释，需要移除）
  fixedJson = fixedJson.replace(/\/\/.*/g, '');
  
  // 增强修复11: 处理未闭合的对象和数组
  try {
    // 尝试解析JSON找出错误位置
    JSON.parse(fixedJson);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : '';
    const match = errorMsg.match(/position (\d+)/);
    
    if (match && match[1]) {
      const position = parseInt(match[1]);
      
      // 检查特定错误位置附近的括号匹配情况
      const substr = fixedJson.substring(0, position + 20);
      const openObjects = (substr.match(/\{/g) || []).length;
      const closeObjects = (substr.match(/\}/g) || []).length;
      const openArrays = (substr.match(/\[/g) || []).length;
      const closeArrays = (substr.match(/\]/g) || []).length;
      
      // 添加缺少的闭合括号
      let closingChars = '';
      for (let i = closeObjects; i < openObjects; i++) closingChars += '}';
      for (let i = closeArrays; i < openArrays; i++) closingChars += ']';
      
      if (closingChars) {
        fixedJson += closingChars;
        console.warn(`检测到未闭合的JSON结构，已添加: ${closingChars}`);
      }
    }
  }
  
  // 增强修复12: 处理多余的逗号
  fixedJson = fixedJson.replace(/,\s*([\]}])/g, ' $1');
  
  // 最后检查并确保JSON以{或[开头
  if (fixedJson.trim() === '' || (!fixedJson.startsWith('{') && !fixedJson.startsWith('['))) {
    fixedJson = '{' + fixedJson + '}';
  }
  
  return fixedJson;
}
