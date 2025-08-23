// SessionStorage缓存服务
// 提供数据缓存功能，减少重复数据请求，提升应用性能

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // 缓存过期时间(毫秒)
}

interface CacheConfig {
  defaultTTL: number; // 默认缓存时间
  maxSize: number; // 最大缓存条目数
  enableLogging: boolean; // 是否启用日志
}

class CacheService {
  private readonly config: CacheConfig;
  private readonly storage: Storage;
  private readonly keyPrefix = 'exp_cache_';

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTTL: 5 * 60 * 1000, // 默认5分钟缓存
      maxSize: 100, // 最大100个缓存项
      enableLogging: import.meta.env.DEV,
      ...config
    };
    this.storage = window.sessionStorage;
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * 记录日志
   */
  private log(message: string, data?: any): void {
    if (this.config.enableLogging) {
      console.log(`[CacheService] ${message}`, data || '');
    }
  }

  /**
   * 设置缓存
   */
  set<T>(key: string, data: T, ttl?: number): void {
    try {
      const cacheKey = this.getCacheKey(key);
      const cacheItem: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttl || this.config.defaultTTL
      };

      this.storage.setItem(cacheKey, JSON.stringify(cacheItem));
      this.log(`缓存设置成功: ${key}`, { ttl: cacheItem.ttl });
      
      // 检查缓存大小并清理过期项
      this.cleanup();
    } catch (error) {
      this.log(`缓存设置失败: ${key}`, error);
    }
  }

  /**
   * 获取缓存
   */
  get<T>(key: string): T | null {
    try {
      const cacheKey = this.getCacheKey(key);
      const cached = this.storage.getItem(cacheKey);
      
      if (!cached) {
        this.log(`缓存未命中: ${key}`);
        return null;
      }

      const cacheItem: CacheItem<T> = JSON.parse(cached);
      const now = Date.now();
      
      // 检查是否过期
      if (now - cacheItem.timestamp > cacheItem.ttl) {
        this.log(`缓存已过期: ${key}`);
        this.delete(key);
        return null;
      }

      this.log(`缓存命中: ${key}`);
      return cacheItem.data;
    } catch (error) {
      this.log(`缓存读取失败: ${key}`, error);
      this.delete(key);
      return null;
    }
  }

  /**
   * 删除缓存
   */
  delete(key: string): void {
    try {
      const cacheKey = this.getCacheKey(key);
      this.storage.removeItem(cacheKey);
      this.log(`缓存删除: ${key}`);
    } catch (error) {
      this.log(`缓存删除失败: ${key}`, error);
    }
  }

  /**
   * 检查缓存是否存在且有效
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * 清理过期缓存
   */
  cleanup(): void {
    try {
      const now = Date.now();
      const keysToDelete: string[] = [];
      
      // 遍历所有sessionStorage项
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key && key.startsWith(this.keyPrefix)) {
          try {
            const cached = this.storage.getItem(key);
            if (cached) {
              const cacheItem: CacheItem<any> = JSON.parse(cached);
              if (now - cacheItem.timestamp > cacheItem.ttl) {
                keysToDelete.push(key);
              }
            }
          } catch {
            // 损坏的缓存项，标记删除
            keysToDelete.push(key);
          }
        }
      }

      // 删除过期缓存
      keysToDelete.forEach(key => {
        this.storage.removeItem(key);
      });

      if (keysToDelete.length > 0) {
        this.log(`清理过期缓存: ${keysToDelete.length} 项`);
      }

      // 检查缓存大小，如果超过限制则删除最旧的
      this.enforceMaxSize();
    } catch (error) {
      this.log('缓存清理失败', error);
    }
  }

  /**
   * 强制限制缓存大小
   */
  private enforceMaxSize(): void {
    try {
      const cacheItems: Array<{ key: string; timestamp: number }> = [];
      
      // 收集所有缓存项的时间戳
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key && key.startsWith(this.keyPrefix)) {
          try {
            const cached = this.storage.getItem(key);
            if (cached) {
              const cacheItem: CacheItem<any> = JSON.parse(cached);
              cacheItems.push({
                key,
                timestamp: cacheItem.timestamp
              });
            }
          } catch {
            // 损坏的项，移除
            this.storage.removeItem(key);
          }
        }
      }

      // 如果超过最大大小，删除最旧的项
      if (cacheItems.length > this.config.maxSize) {
        cacheItems.sort((a, b) => a.timestamp - b.timestamp);
        const itemsToRemove = cacheItems.slice(0, cacheItems.length - this.config.maxSize);
        
        itemsToRemove.forEach(item => {
          this.storage.removeItem(item.key);
        });

        this.log(`删除最旧缓存: ${itemsToRemove.length} 项`);
      }
    } catch (error) {
      this.log('缓存大小控制失败', error);
    }
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    try {
      const keysToDelete: string[] = [];
      
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key && key.startsWith(this.keyPrefix)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach(key => {
        this.storage.removeItem(key);
      });

      this.log(`清空所有缓存: ${keysToDelete.length} 项`);
    } catch (error) {
      this.log('清空缓存失败', error);
    }
  }

  /**
   * 批量设置缓存
   */
  setMultiple<T>(entries: Array<{ key: string; data: T; ttl?: number }>): void {
    entries.forEach(({ key, data, ttl }) => {
      this.set(key, data, ttl);
    });
  }

  /**
   * 批量获取缓存
   */
  getMultiple<T>(keys: string[]): Array<{ key: string; data: T | null }> {
    return keys.map(key => ({
      key,
      data: this.get<T>(key)
    }));
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    totalItems: number;
    totalSize: number;
    hitRate: number;
  } {
    let totalItems = 0;
    let totalSize = 0;

    try {
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key && key.startsWith(this.keyPrefix)) {
          totalItems++;
          const value = this.storage.getItem(key);
          if (value) {
            totalSize += value.length;
          }
        }
      }
    } catch (error) {
      this.log('获取缓存统计失败', error);
    }

    return {
      totalItems,
      totalSize,
      hitRate: 0 // 需要额外的追踪逻辑来计算命中率
    };
  }
}

// 创建默认缓存实例
export const cacheService = new CacheService({
  defaultTTL: 5 * 60 * 1000, // 5分钟
  maxSize: 50, // 最大50个缓存项
  enableLogging: true
});

// 针对不同数据类型的缓存键生成器
export const CacheKeys = {
  // 实验记录相关
  EXPERIMENT_RECORDS_ALL: 'experiment_records_all',
  EXPERIMENT_RECORD_BY_ID: (id: string) => `experiment_record_${id}`,
  EXPERIMENT_RECORDS_BY_PROJECT: (projectId: string) => `experiment_records_project_${projectId}`,
  
  // 实验笔记相关
  EXPERIMENT_NOTES_ALL: 'experiment_notes_all',
  EXPERIMENT_NOTE_BY_ID: (id: string) => `experiment_note_${id}`,
  EXPERIMENT_NOTES_BY_PROJECT: (projectId: string) => `experiment_notes_project_${projectId}`,
  EXPERIMENT_NOTES_BY_RECORD: (recordId: string) => `experiment_notes_record_${recordId}`,
  
  // SOP文档相关
  SOPS_ALL: 'sops_all',
  SOP_BY_ID: (id: string) => `sop_${id}`,
  SOPS_BY_PROJECT: (projectId: string) => `sops_project_${projectId}`,
  
  // 课题管理相关
  PROJECTS_ALL: 'projects_all',
  PROJECT_BY_ID: (id: string) => `project_${id}`,
  PROJECT_STATS: (id: string) => `project_stats_${id}`,
  
  // 实验计划相关
  EXPERIMENT_PLANS_ALL: 'experiment_plans_all',
  EXPERIMENT_PLAN_BY_ID: (id: string) => `experiment_plan_${id}`,
  EXPERIMENT_PLANS_BY_PROJECT: (projectId: string) => `experiment_plans_project_${projectId}`,
};

// 缓存失效策略
export const CacheInvalidation = {
  // 当实验记录变更时，失效相关缓存
  onExperimentRecordChange: (recordId?: string, projectId?: string) => {
    console.log('[CacheInvalidation] 实验记录变更:', { recordId, projectId });
    cacheService.delete(CacheKeys.EXPERIMENT_RECORDS_ALL);
    if (recordId) {
      cacheService.delete(CacheKeys.EXPERIMENT_RECORD_BY_ID(recordId));
    }
    if (projectId) {
      cacheService.delete(CacheKeys.EXPERIMENT_RECORDS_BY_PROJECT(projectId));
      cacheService.delete(CacheKeys.PROJECT_STATS(projectId));
    }
  },
  
  // 当实验笔记变更时，失效相关缓存
  onExperimentNoteChange: (noteId?: string, projectId?: string, recordId?: string) => {
    console.log('[CacheInvalidation] 实验笔记变更:', { noteId, projectId, recordId });
    cacheService.delete(CacheKeys.EXPERIMENT_NOTES_ALL);
    if (noteId) {
      cacheService.delete(CacheKeys.EXPERIMENT_NOTE_BY_ID(noteId));
    }
    if (projectId) {
      cacheService.delete(CacheKeys.EXPERIMENT_NOTES_BY_PROJECT(projectId));
      cacheService.delete(CacheKeys.PROJECT_STATS(projectId));
    }
    if (recordId) {
      cacheService.delete(CacheKeys.EXPERIMENT_NOTES_BY_RECORD(recordId));
    }
  },
  
  // 当SOP变更时，失效相关缓存
  onSOPChange: (sopId?: string, projectId?: string) => {
    console.log('[CacheInvalidation] SOP变更:', { sopId, projectId });
    cacheService.delete(CacheKeys.SOPS_ALL);
    if (sopId) {
      cacheService.delete(CacheKeys.SOP_BY_ID(sopId));
    }
    if (projectId) {
      cacheService.delete(CacheKeys.SOPS_BY_PROJECT(projectId));
      cacheService.delete(CacheKeys.PROJECT_STATS(projectId));
    }
  },
  
  // 当课题变更时，失效相关缓存
  onProjectChange: (projectId?: string) => {
    console.log('[CacheInvalidation] 课题变更:', { projectId });
    cacheService.delete(CacheKeys.PROJECTS_ALL);
    if (projectId) {
      cacheService.delete(CacheKeys.PROJECT_BY_ID(projectId));
      cacheService.delete(CacheKeys.PROJECT_STATS(projectId));
    }
  },
  
  // 当实验计划变更时，失效相关缓存
  onExperimentPlanChange: (planId?: string, projectId?: string) => {
    console.log('[CacheInvalidation] 实验计划变更:', { planId, projectId });
    cacheService.delete(CacheKeys.EXPERIMENT_PLANS_ALL);
    if (planId) {
      cacheService.delete(CacheKeys.EXPERIMENT_PLAN_BY_ID(planId));
    }
    if (projectId) {
      cacheService.delete(CacheKeys.EXPERIMENT_PLANS_BY_PROJECT(projectId));
      cacheService.delete(CacheKeys.PROJECT_STATS(projectId));
    }
  },
  
  // 清空所有缓存
  clearAll: () => {
    console.log('[CacheInvalidation] 清空所有缓存');
    cacheService.clear();
  }
};
