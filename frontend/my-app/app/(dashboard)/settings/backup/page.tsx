"use client";

import { useState, useEffect } from "react";
import { backupAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Database,
  FolderArchive,
  HardDrive,
  Cloud,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Plus,
  Trash2,
  Play,
  Settings,
  AlertTriangle,
  Download,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

interface BackupConfig {
  enabled: boolean;
  scheduleCron: string;
  retentionDays: number;
  storageType: "LOCAL" | "RUSTFS";
  localPath: string;
  rustfsBucket: string;
  rustfsPrefix: string;
  includeDatabase: boolean;
  includeFiles: boolean;
  /** 实际使用的 RUSTFS 桶名（来自文件存储设置） */
  effectiveRustfsBucket?: string;
}

interface BackupLog {
  id: string;
  backupType: string;
  triggerType: string;
  status: string;
  storageType: string;
  fileSize?: number;
  contentTypes: string[];
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  errorMessage?: string;
  operator?: {
    id: string;
    username: string;
    name: string;
  };
}

interface BackupStats {
  totalCount: number;
  successCount: number;
  failedCount: number;
  totalSize: number;
  nextScheduledTime?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("zh-CN");
}

export default function BackupPage() {
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createType, setCreateType] = useState<"FULL" | "DATABASE" | "FILES">("FULL");
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<{ id: string; createdAt: string; contentTypes: string[] } | null>(null);
  const [restoreContentTypes, setRestoreContentTypes] = useState<string[]>([]);
  const [createAutoBackup, setCreateAutoBackup] = useState(true);
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configData, logsData, statsData] = await Promise.all([
        backupAPI.getConfig(),
        backupAPI.getLogs(1, 10),
        backupAPI.getStats(),
      ]);
      setConfig(configData);
      setLogs(logsData.items);
      setStats(statsData);
    } catch (error) {
      toast.error("加载数据失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    const retentionDays = Number(config.retentionDays);
    if (Number.isNaN(retentionDays) || retentionDays < 1 || retentionDays > 365) {
      toast.error("保留天数请输入 1～365 的整数");
      return;
    }
    setSaving(true);
    try {
      // 只提交后端 DTO 需要的字段，避免 forbidNonWhitelisted 导致 Bad Request
      const payload = {
        enabled: Boolean(config.enabled),
        scheduleCron: String(config.scheduleCron ?? "0 2 * * *"),
        retentionDays,
        storageType: config.storageType,
        localPath: config.localPath ?? "backups",
        rustfsBucket: config.rustfsBucket ?? "",
        rustfsPrefix: config.rustfsPrefix ?? "backups/",
        includeDatabase: Boolean(config.includeDatabase),
        includeFiles: Boolean(config.includeFiles),
      };
      await backupAPI.saveConfig(payload);
      toast.success("配置保存成功");
      const configData = await backupAPI.getConfig();
      setConfig(configData);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "保存配置失败";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      await backupAPI.createBackup({ backupType: createType });
      toast.success("备份已开始，请稍候查看结果");
      setShowCreateDialog(false);
      setTimeout(loadData, 2000);
    } catch (error) {
      toast.error("创建备份失败");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBackup = async (id: string) => {
    try {
      await backupAPI.deleteBackup(id);
      toast.success("删除成功");
      loadData();
    } catch (error) {
      toast.error("删除失败");
    }
  };

  const handleDownloadBackup = async (id: string) => {
    setDownloadingId(id);
    try {
      const { blob, filename } = await backupAPI.downloadBackup(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("下载已开始");
    } catch (error) {
      toast.error("下载失败");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRestoreClick = (log: BackupLog) => {
    setRestoreTarget({ id: log.id, createdAt: log.startedAt, contentTypes: log.contentTypes || [] });
    setRestoreContentTypes(log.contentTypes || ["database"]);
    setCreateAutoBackup(true);
    setRestoreConfirm(false);
    setShowRestoreDialog(true);
  };

  const handleRestoreBackup = async () => {
    if (!restoreTarget || !restoreConfirm) return;
    setRestoring(true);
    try {
      await backupAPI.restoreBackup(restoreTarget.id, {
        confirm: true,
        contentTypesStr: restoreContentTypes.join(","),
        createAutoBackup,
        restoreType: restoreContentTypes.length === 1 && restoreContentTypes[0] === "database" ? "DATABASE" : "FULL",
      });
      toast.success("恢复已开始，请在恢复记录中查看进度");
      setShowRestoreDialog(false);
    } catch (error) {
      toast.error("恢复失败");
    } finally {
      setRestoring(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">系统备份</h1>
          <p className="text-muted-foreground">管理数据库和文件的备份与恢复</p>
        </div>
        <Button
          type="button"
          onClick={() => {
            // 根据当前备份内容配置设置默认选项
            if (config) {
              if (config.includeDatabase && !config.includeFiles) setCreateType("DATABASE");
              else if (!config.includeDatabase && config.includeFiles) setCreateType("FILES");
              else setCreateType("FULL");
            }
            setShowCreateDialog(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          创建备份
        </Button>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>总备份数</CardDescription>
              <CardTitle className="text-3xl">{stats.totalCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>成功</CardDescription>
              <CardTitle className="text-3xl text-green-500">{stats.successCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>失败</CardDescription>
              <CardTitle className="text-3xl text-red-500">{stats.failedCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>总存储大小</CardDescription>
              <CardTitle className="text-3xl">{formatBytes(stats.totalSize)}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">备份配置</TabsTrigger>
          <TabsTrigger value="logs">备份记录</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>备份设置</CardTitle>
              <CardDescription>配置备份任务的各项参数</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>启用自动备份</Label>
                  <p className="text-sm text-muted-foreground">开启后，系统将按计划自动执行备份</p>
                </div>
                <Switch
                  checked={config?.enabled}
                  onCheckedChange={(checked) => setConfig({ ...config!, enabled: checked })}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>定时备份 Cron 表达式</Label>
                  <Input
                    value={config?.scheduleCron}
                    onChange={(e) => setConfig({ ...config!, scheduleCron: e.target.value })}
                    placeholder="0 2 * * *"
                  />
                  <p className="text-xs text-muted-foreground">默认: 每天凌晨 2 点</p>
                </div>

                <div className="space-y-2">
                  <Label>保留天数</Label>
                  <Input
                    type="number"
                    value={config?.retentionDays}
                    onChange={(e) => setConfig({ ...config!, retentionDays: parseInt(e.target.value) })}
                    min={1}
                    max={365}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>存储类型</Label>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="local"
                      name="storageType"
                      checked={config?.storageType === "LOCAL"}
                      onChange={() => setConfig({ ...config!, storageType: "LOCAL" })}
                    />
                    <Label htmlFor="local" className="font-normal">
                      <HardDrive className="w-4 h-4 inline mr-1" />
                      本地存储
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="rustfs"
                      name="storageType"
                      checked={config?.storageType === "RUSTFS"}
                      onChange={() => setConfig({ ...config!, storageType: "RUSTFS" })}
                    />
                    <Label htmlFor="rustfs" className="font-normal">
                      <Cloud className="w-4 h-4 inline mr-1" />
                      RustFS 对象存储
                    </Label>
                  </div>
                </div>
              </div>

              {config?.storageType === "LOCAL" && (
                <div className="space-y-2">
                  <Label>本地存储路径（相对上传根目录）</Label>
                  <Input
                    value={config?.localPath}
                    onChange={(e) => setConfig({ ...config!, localPath: e.target.value })}
                    placeholder="backups"
                  />
                  <p className="text-xs text-muted-foreground">
                    最终路径 = 上传根目录 + 本路径。例如上传根目录为 /uploads/ 时，填 backups 即存储在 /uploads/backups
                  </p>
                </div>
              )}

              {config?.storageType === "RUSTFS" && (
                <>
                  <div className="space-y-2">
                    <Label>存储桶（来自文件存储设置，只读）</Label>
                    <Input
                      value={config?.effectiveRustfsBucket ?? config?.rustfsBucket ?? ""}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>RustFS 路径前缀</Label>
                    <Input
                      value={config?.rustfsPrefix}
                      onChange={(e) => setConfig({ ...config!, rustfsPrefix: e.target.value })}
                      placeholder="backups/"
                    />
                    <p className="text-xs text-muted-foreground">
                      备份将保存在上述存储桶中的该路径下，例如 backups/ 即桶内 backups 目录
                    </p>
                  </div>
                </>
              )}

              <Separator />

              <div className="space-y-2">
                <Label>备份内容</Label>
                <p className="text-xs text-muted-foreground">
                  用于定时自动备份的默认范围；手动「创建备份」时可在弹窗中单独选择本次范围。
                </p>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="includeDatabase"
                      checked={config?.includeDatabase}
                      onChange={(e) => setConfig({ ...config!, includeDatabase: e.target.checked })}
                    />
                    <Label htmlFor="includeDatabase" className="font-normal">
                      <Database className="w-4 h-4 inline mr-1" />
                      数据库
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="includeFiles"
                      checked={config?.includeFiles}
                      onChange={(e) => setConfig({ ...config!, includeFiles: e.target.checked })}
                    />
                    <Label htmlFor="includeFiles" className="font-normal">
                      <FolderArchive className="w-4 h-4 inline mr-1" />
                      上传文件
                    </Label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="button" onClick={handleSaveConfig} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Settings className="w-4 h-4 mr-2" />}
                  保存配置
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>备份记录</CardTitle>
              <CardDescription>查看和管理历史备份</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    暂无备份记录
                  </div>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        {log.status === "running" ? (
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        ) : log.status === "success" ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                        <div>
                          <div className="font-medium">
                            {log.backupType === "FULL"
                              ? "完整备份"
                              : log.backupType === "DATABASE"
                              ? "数据库备份"
                              : "文件备份"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(log.startedAt)}
                            {log.triggerType === "SCHEDULED" && (
                              <Badge variant="outline" className="ml-2">
                                自动
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {log.fileSize && (
                          <span className="text-sm text-muted-foreground">
                            {formatBytes(Number(log.fileSize))}
                          </span>
                        )}
                        {log.status === "success" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRestoreClick(log)}
                              title="恢复备份"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownloadBackup(log.id)}
                              disabled={downloadingId === log.id}
                              title="下载备份"
                            >
                              {downloadingId === log.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteBackup(log.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 创建备份对话框 */}
      <AlertDialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>创建备份</AlertDialogTitle>
            <AlertDialogDescription>
              选择本次要备份的内容。上方的「备份内容」用于定时备份的默认范围，此处仅针对这一次手动备份。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-3">
              <input
                type="radio"
                id="type-full"
                name="createType"
                checked={createType === "FULL"}
                onChange={() => setCreateType("FULL")}
              />
              <Label htmlFor="type-full" className="font-normal">
                完整备份（数据库 + 文件）
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="radio"
                id="type-db"
                name="createType"
                checked={createType === "DATABASE"}
                onChange={() => setCreateType("DATABASE")}
              />
              <Label htmlFor="type-db" className="font-normal">
                仅数据库
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="radio"
                id="type-files"
                name="createType"
                checked={createType === "FILES"}
                onChange={() => setCreateType("FILES")}
              />
              <Label htmlFor="type-files" className="font-normal">
                仅上传文件
              </Label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateBackup} disabled={creating}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              开始备份
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 恢复备份对话框 */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              恢复备份
            </AlertDialogTitle>
            <AlertDialogDescription>
              此操作将覆盖当前数据，且不可撤销。建议在恢复前创建自动备份。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {restoreTarget && (
            <div className="space-y-4 py-4">
              <div className="text-sm">
                <span className="text-muted-foreground">备份时间：</span>
                <span className="font-medium">{formatDate(restoreTarget.createdAt)}</span>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium">恢复内容：</span>
                {restoreTarget.contentTypes.includes("database") && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="restore-db"
                      checked={restoreContentTypes.includes("database")}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRestoreContentTypes([...restoreContentTypes, "database"]);
                        } else {
                          setRestoreContentTypes(restoreContentTypes.filter((t) => t !== "database"));
                        }
                      }}
                    />
                    <Label htmlFor="restore-db" className="font-normal">
                      数据库
                    </Label>
                  </div>
                )}
                {restoreTarget.contentTypes.includes("files") && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="restore-files"
                      checked={restoreContentTypes.includes("files")}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRestoreContentTypes([...restoreContentTypes, "files"]);
                        } else {
                          setRestoreContentTypes(restoreContentTypes.filter((t) => t !== "files"));
                        }
                      }}
                    />
                    <Label htmlFor="restore-files" className="font-normal">
                      上传文件
                    </Label>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto-backup"
                  checked={createAutoBackup}
                  onChange={(e) => setCreateAutoBackup(e.target.checked)}
                />
                <Label htmlFor="auto-backup" className="font-normal">
                  恢复前自动创建备份（推荐）
                </Label>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t">
                <input
                  type="checkbox"
                  id="restore-confirm"
                  checked={restoreConfirm}
                  onChange={(e) => setRestoreConfirm(e.target.checked)}
                />
                <Label htmlFor="restore-confirm" className="font-normal text-destructive">
                  我已确认此操作将覆盖当前数据
                </Label>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestoreBackup}
              disabled={!restoreConfirm || restoring || restoreContentTypes.length === 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {restoring && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              确认恢复
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
