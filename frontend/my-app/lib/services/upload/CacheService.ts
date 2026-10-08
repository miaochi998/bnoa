/**
 * CacheService - 上传缓存服务
 * 使用IndexedDB实现上传状态的持久化缓存
 * 支持崩溃恢复、断点续传、智能清理
 * 
 * 功能点：
 * - F025: 自动缓存 - 保存上传状态到IndexedDB
 * - F026: 崩溃恢复 - 页面重载后自动恢复未完成上传
 * - F027: 智能清理 - 上传成功后自动清理缓存
 * - F028: 过期清理 - 24小时自动过期
 */

const DB_NAME = 'bnoa-upload-cache';
const DB_VERSION = 1;
const STORE_NAME = 'upload-sessions';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24小时

/**
 * 缓存的上传会话信息
 */
export interface CachedUploadSession {
  /** 会话ID（主键） */
  sessionId: string;
  /** 文件MD5哈希 */
  fileMd5: string;
  /** 文件名 */
  fileName: string;
  /** 文件大小（字节） */
  fileSize: number;
  /** 文件类型 */
  fileType: string;
  /** 文件最后修改时间 */
  fileLastModified: number;
  /** 已上传的分片索引列表 */
  uploadedChunks: number[];
  /** 总分片数 */
  totalChunks: number;
  /** 分片大小 */
  chunkSize: number;
  /** 上传模式 */
  uploadMode: 'local' | 'rustfs';
  /** 目标文件夹ID */
  folderId?: string;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 上传进度百分比 */
  progress: number;
  /** 状态 */
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed';
}

/**
 * 恢复的上传信息
 */
export interface RecoverableUpload {
  session: CachedUploadSession;
  /** 是否过期 */
  isExpired: boolean;
  /** 剩余时间（毫秒） */
  remainingTime: number;
  /** 已完成百分比 */
  completedPercentage: number;
}

/**
 * 缓存服务配置
 */
export interface CacheServiceConfig {
  /** 缓存过期时间（毫秒），默认24小时 */
  expiryMs?: number;
  /** 是否启用自动清理，默认true */
  enableAutoCleanup?: boolean;
  /** 自动清理间隔（毫秒），默认1小时 */
  cleanupIntervalMs?: number;
}

/**
 * 上传缓存服务类
 */
class UploadCacheService {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private config: Required<CacheServiceConfig>;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: CacheServiceConfig = {}) {
    this.config = {
      expiryMs: config.expiryMs ?? CACHE_EXPIRY_MS,
      enableAutoCleanup: config.enableAutoCleanup ?? true,
      cleanupIntervalMs: config.cleanupIntervalMs ?? 60 * 60 * 1000, // 1小时
    };
  }

  /**
   * 初始化数据库连接
   */
  private async initDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB不可用'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[CacheService] 数据库打开失败:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[CacheService] 数据库连接成功');
        
        // 启动自动清理
        if (this.config.enableAutoCleanup) {
          this.startAutoCleanup();
        }
        
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 创建对象存储
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
          
          // 创建索引
          store.createIndex('fileMd5', 'fileMd5', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          
          console.log('[CacheService] 数据库结构创建完成');
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * 启动自动清理定时器
   */
  private startAutoCleanup(): void {
    if (this.cleanupTimer) return;
    
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired().catch(console.error);
    }, this.config.cleanupIntervalMs);
    
    // 立即执行一次清理
    this.cleanupExpired().catch(console.error);
  }

  /**
   * 停止自动清理
   */
  public stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * 保存上传会话
   */
  async saveSession(session: CachedUploadSession): Promise<void> {
    const db = await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const sessionToSave = {
        ...session,
        updatedAt: Date.now(),
      };
      
      const request = store.put(sessionToSave);
      
      request.onsuccess = () => {
        console.log(`[CacheService] 会话已保存: ${session.sessionId}`);
        resolve();
      };
      
      request.onerror = () => {
        console.error('[CacheService] 保存会话失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 更新已上传的分片
   */
  async updateUploadedChunks(
    sessionId: string,
    uploadedChunks: number[],
    progress: number
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      console.warn(`[CacheService] 会话不存在: ${sessionId}`);
      return;
    }

    await this.saveSession({
      ...session,
      uploadedChunks,
      progress,
      status: 'uploading',
    });
  }

  /**
   * 更新会话状态
   */
  async updateSessionStatus(
    sessionId: string,
    status: CachedUploadSession['status']
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    await this.saveSession({
      ...session,
      status,
    });
  }

  /**
   * 获取会话信息
   */
  async getSession(sessionId: string): Promise<CachedUploadSession | null> {
    const db = await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(sessionId);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 根据文件MD5查找会话
   */
  async getSessionByMd5(fileMd5: string): Promise<CachedUploadSession | null> {
    const db = await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('fileMd5');
      const request = index.get(fileMd5);
      
      request.onsuccess = () => {
        const session = request.result;
        if (session && session.status !== 'completed') {
          resolve(session);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    const db = await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(sessionId);
      
      request.onsuccess = () => {
        console.log(`[CacheService] 会话已删除: ${sessionId}`);
        resolve();
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 获取所有可恢复的上传
   */
  async getRecoverableUploads(): Promise<RecoverableUpload[]> {
    const db = await this.initDB();
    const now = Date.now();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const sessions: CachedUploadSession[] = request.result || [];
        
        const recoverables: RecoverableUpload[] = sessions
          .filter(s => s.status !== 'completed')
          .map(session => {
            const age = now - session.createdAt;
            const isExpired = age > this.config.expiryMs;
            const remainingTime = Math.max(0, this.config.expiryMs - age);
            const completedPercentage = session.totalChunks > 0
              ? Math.round((session.uploadedChunks.length / session.totalChunks) * 100)
              : 0;
            
            return {
              session,
              isExpired,
              remainingTime,
              completedPercentage,
            };
          })
          .sort((a, b) => b.session.updatedAt - a.session.updatedAt);
        
        resolve(recoverables);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 清理过期的缓存
   */
  async cleanupExpired(): Promise<number> {
    const db = await this.initDB();
    const now = Date.now();
    const expiryThreshold = now - this.config.expiryMs;
    let deletedCount = 0;
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('createdAt');
      const range = IDBKeyRange.upperBound(expiryThreshold);
      const request = index.openCursor(range);
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const session = cursor.value as CachedUploadSession;
          // 只删除非完成状态的过期会话
          if (session.status !== 'completed') {
            cursor.delete();
            deletedCount++;
            console.log(`[CacheService] 清理过期会话: ${session.sessionId}`);
          }
          cursor.continue();
        }
      };
      
      transaction.oncomplete = () => {
        if (deletedCount > 0) {
          console.log(`[CacheService] 清理完成，删除 ${deletedCount} 个过期会话`);
        }
        resolve(deletedCount);
      };
      
      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  }

  /**
   * 清理已完成的上传缓存
   */
  async cleanupCompleted(): Promise<number> {
    const db = await this.initDB();
    let deletedCount = 0;
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');
      const request = index.openCursor(IDBKeyRange.only('completed'));
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        }
      };
      
      transaction.oncomplete = () => {
        if (deletedCount > 0) {
          console.log(`[CacheService] 清理已完成会话: ${deletedCount} 个`);
        }
        resolve(deletedCount);
      };
      
      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  }

  /**
   * 清空所有缓存
   */
  async clearAll(): Promise<void> {
    const db = await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      
      request.onsuccess = () => {
        console.log('[CacheService] 所有缓存已清空');
        resolve();
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 获取缓存统计信息
   */
  async getStats(): Promise<{
    totalSessions: number;
    pendingSessions: number;
    uploadingSessions: number;
    pausedSessions: number;
    completedSessions: number;
    failedSessions: number;
    expiredSessions: number;
    totalSize: number;
  }> {
    const db = await this.initDB();
    const now = Date.now();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const sessions: CachedUploadSession[] = request.result || [];
        
        const stats = {
          totalSessions: sessions.length,
          pendingSessions: 0,
          uploadingSessions: 0,
          pausedSessions: 0,
          completedSessions: 0,
          failedSessions: 0,
          expiredSessions: 0,
          totalSize: 0,
        };
        
        sessions.forEach(session => {
          stats.totalSize += session.fileSize;
          
          const isExpired = (now - session.createdAt) > this.config.expiryMs;
          if (isExpired && session.status !== 'completed') {
            stats.expiredSessions++;
          }
          
          switch (session.status) {
            case 'pending':
              stats.pendingSessions++;
              break;
            case 'uploading':
              stats.uploadingSessions++;
              break;
            case 'paused':
              stats.pausedSessions++;
              break;
            case 'completed':
              stats.completedSessions++;
              break;
            case 'failed':
              stats.failedSessions++;
              break;
          }
        });
        
        resolve(stats);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    this.stopAutoCleanup();
    if (this.db) {
      this.db.close();
      this.db = null;
      this.dbPromise = null;
    }
  }
}

// 创建单例实例
export const cacheService = new UploadCacheService();

// 导出类以便测试或自定义配置
export { UploadCacheService };

export default cacheService;
