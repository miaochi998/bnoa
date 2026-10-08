"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { upgradeAPI } from "@/lib/api";
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
  ArrowUpCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Settings,
  History,
  Shield,
  Wifi,
  WifiOff,
  Download,
  Server,
  Database,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ========== 升级进度面板 ==========
interface UpgradeProgressState {
  phase: "sending" | "waiting" | "checking" | "success" | "failed";
  message: string;
  elapsedSeconds: number;
  versionFrom: string;
  versionTo: string;
  /** 容器**实际运行**的镜像版本 —— 来自后端核对，是判定升级结果的唯一事实依据 */
  actualVersion?: string | null;
  /** OA 各容器的真实状态 */
  containers?: Array<{
    name: string;
    image: string;
    version: string | null;
    status: string;
    healthy: boolean;
  }>;
  allHealthy?: boolean;
  /** 失败时的详细原因（后端会给出可操作的排查提示，可能多行） */
  errorMessage?: string | null;
}

function UpgradeProgressPanel({
  state,
  onClose,
}: {
  state: UpgradeProgressState;
  onClose: () => void;
}) {
  const phases = [
    { key: "sending", label: "发送升级请求（含预检）", icon: ArrowUpCircle },
    { key: "waiting", label: "等待服务重启 / 拉取镜像", icon: Server },
    { key: "checking", label: "核对容器实际镜像", icon: Shield },
  ];

  const getPhaseIndex = () => {
    if (state.phase === "sending") return 0;
    if (state.phase === "waiting") return 1;
    if (state.phase === "checking") return 2;
    if (state.phase === "success" || state.phase === "failed") return 3;
    return 0;
  };

  const phaseIndex = getPhaseIndex();
  const isFinished = state.phase === "success" || state.phase === "failed";

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {isFinished ? (
            state.phase === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-destructive" />
            )
          ) : (
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          )}
          {isFinished
            ? state.phase === "success"
              ? "升级成功"
              : "升级异常"
            : "系统升级中..."}
        </CardTitle>
        <CardDescription>
          v{state.versionFrom} → v{state.versionTo}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 步骤进度 */}
        <div className="space-y-3">
          {phases.map((p, idx) => {
            const Icon = p.icon;
            const isActive = idx === phaseIndex && !isFinished;
            const isDone = idx < phaseIndex || state.phase === "success";
            const isFailed = state.phase === "failed" && idx === phaseIndex;

            return (
              <div
                key={p.key}
                className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                  isActive
                    ? "border-primary bg-primary/5"
                    : isDone
                    ? "border-green-500/30 bg-green-500/5"
                    : isFailed
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-border opacity-50"
                }`}
              >
                <div className="flex-shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : isActive ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  ) : isFailed ? (
                    <XCircle className="w-5 h-5 text-destructive" />
                  ) : (
                    <Icon className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${isActive ? "text-primary" : isDone ? "text-green-600 dark:text-green-400" : ""}`}>
                    {p.label}
                  </div>
                  {isActive && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {state.message}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 计时器 + 容器实际运行版本（事实依据，非期望值） */}
        <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-3">
          <span>已用时间: {state.elapsedSeconds}s</span>
          {state.actualVersion ? (
            <span className="font-mono text-xs">
              容器实际运行: {state.actualVersion}
            </span>
          ) : !isFinished ? (
            <span className="text-xs">请勿关闭此页面</span>
          ) : null}
        </div>

        {/* 结果信息 */}
        {state.phase === "success" && (
          <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-4 text-sm space-y-2">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              升级完成（已核对容器实际镜像）
            </div>
            <div className="text-muted-foreground">{state.message}</div>
            {state.containers?.length ? (
              <div className="pt-2 border-t border-green-500/20 space-y-1 text-xs">
                {state.containers.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-muted-foreground truncate">
                      {c.name}
                    </span>
                    <span
                      className={
                        c.healthy
                          ? "text-green-600 dark:text-green-400 font-mono"
                          : "text-destructive font-mono"
                      }
                    >
                      {c.version || "?"} · {c.healthy ? "healthy" : "异常"}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
        {state.phase === "failed" && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 text-sm space-y-2">
            <div className="flex items-center gap-2 text-destructive font-medium">
              <XCircle className="w-4 h-4" />
              升级异常
            </div>
            <div className="text-muted-foreground whitespace-pre-line text-xs leading-relaxed">
              {state.errorMessage || state.message}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        {isFinished && (
          <div className="flex justify-end">
            <Button
              onClick={() => window.location.reload()}
              variant={state.phase === "success" ? "default" : "outline"}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              刷新页面
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ========== 升级管理 Tab ==========
function UpgradeManagementTab() {
  const [currentVersion, setCurrentVersion] = useState<any>(null);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [upgradeLogs, setUpgradeLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // 升级进度状态
  const [upgradeProgress, setUpgradeProgress] = useState<UpgradeProgressState | null>(null);
  const upgradeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadCurrentVersion = useCallback(async () => {
    try {
      const data = await upgradeAPI.getCurrentVersion();
      setCurrentVersion(data);
    } catch (err: any) {
      console.error("获取版本信息失败:", err);
    }
  }, []);

  const loadUpgradeLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await upgradeAPI.getUpgradeLogs(1, 10);
      setUpgradeLogs(data?.items || []);
    } catch (err: any) {
      console.error("获取升级日志失败:", err);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCurrentVersion();
    loadUpgradeLogs();
    return () => {
      if (upgradeTimerRef.current) clearInterval(upgradeTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [loadCurrentVersion, loadUpgradeLogs]);

  const handleCheckUpdate = async () => {
    setChecking(true);
    setUpdateInfo(null);
    try {
      const data = await upgradeAPI.checkForUpdate();
      setUpdateInfo(data);
      if (data.hasUpdate) {
        toast.success(`发现新版本: v${data.latestVersion}`);
      } else {
        toast.info("当前已是最新版本");
      }
    } catch (err: any) {
      toast.error(err.message || "检查更新失败");
    } finally {
      setChecking(false);
    }
  };

  // 轮询检测后端是否恢复
  const startPolling = (
    targetVersion: string,
    versionFrom: string,
    upgradeId?: string,
  ) => {
    let elapsedSeconds = 0;
    // 生产实测：Portainer 需先拉取镜像再重建，整体可达 5 分钟以上；
    // 冷启动（镜像未预拉取）时后端约 143s + 前端约 92s，再叠加重建 1–2 分钟，
    // 因此把等待上限放宽到 15 分钟（后端自身的判定超时为 10 分钟）。
    const MAX_WAIT_SECONDS = 900;

    // 计时器：每秒更新已用时间
    upgradeTimerRef.current = setInterval(() => {
      elapsedSeconds += 1;
      setUpgradeProgress((prev) =>
        prev ? { ...prev, elapsedSeconds } : prev
      );
    }, 1000);

    // 轮询器：每5秒查询一次真实状态
    const poll = async () => {
      try {
        // ⚠️ 判据来自后端对「容器实际运行的镜像」的核对，而不是 OA 自记的版本。
        // 历史教训：过去这里读 /upgrade/version（OA 自记的期望值，且在升级第 1 步
        // 就被写成目标版本），导致后端一重启就"秒报成功"，即便容器根本没升级。
        const progress = await upgradeAPI.getUpgradeProgress(upgradeId);

        const facts = {
          actualVersion: progress?.actualVersion ?? null,
          containers: progress?.containers ?? [],
          allHealthy: progress?.allHealthy ?? false,
        };

        if (progress?.status === "success") {
          cleanup();
          setUpgradeProgress((prev) =>
            prev
              ? {
                  ...prev,
                  phase: "success",
                  ...facts,
                  message: `已核对容器实际镜像，系统成功升级到 v${targetVersion}`,
                }
              : prev
          );
          return;
        }

        if (progress?.status === "failed") {
          cleanup();
          setUpgradeProgress((prev) =>
            prev
              ? {
                  ...prev,
                  phase: "failed",
                  ...facts,
                  errorMessage:
                    progress?.errorMessage ||
                    progress?.message ||
                    "升级失败，请检查容器状态",
                }
              : prev
          );
          return;
        }

        // 仍在进行中：展示容器当前实际运行的版本，让等待过程可观测
        setUpgradeProgress((prev) =>
          prev
            ? {
                ...prev,
                phase: "checking",
                ...facts,
                message:
                  progress?.message ||
                  `正在核对容器实际镜像...（当前 ${facts.actualVersion ?? "未知"}）`,
              }
            : prev
        );
      } catch {
        // 后端正在重启 → 连接不可用属预期现象，继续等待
        setUpgradeProgress((prev) =>
          prev
            ? {
                ...prev,
                phase: "waiting",
                message: "服务正在重启中，请耐心等待（连接暂时中断属正常现象）...",
              }
            : prev
        );
      }

      // 超时判断：**先做最后一次核对再下结论**。
      // 历史教训：升级其实已成功（容器镜像已是目标版本），但前端因查不到记录而
      // 在超时后武断报"升级异常"，把成功误报成失败。
      if (elapsedSeconds >= MAX_WAIT_SECONDS) {
        cleanup();
        try {
          const final = await upgradeAPI.getUpgradeProgress(upgradeId);
          if (final?.status === "success") {
            setUpgradeProgress((prev) =>
              prev
                ? {
                    ...prev,
                    phase: "success",
                    actualVersion: final.actualVersion ?? null,
                    containers: final.containers ?? [],
                    allHealthy: final.allHealthy ?? false,
                    message: `已核对容器实际镜像，系统成功升级到 v${targetVersion}`,
                  }
                : prev
            );
            return;
          }
          if (final?.status === "failed") {
            setUpgradeProgress((prev) =>
              prev
                ? {
                    ...prev,
                    phase: "failed",
                    actualVersion: final.actualVersion ?? null,
                    errorMessage:
                      final.errorMessage || final.message || "升级失败",
                  }
                : prev
            );
            return;
          }
        } catch {
          /* 查询失败则按"仍在进行"处理 */
        }

        // 既非成功也非失败 → **不要武断报失败**，明确告知可能仍在进行
        setUpgradeProgress((prev) =>
          prev
            ? {
                ...prev,
                phase: "failed",
                errorMessage:
                  `等待超时（${Math.round(MAX_WAIT_SECONDS / 60)} 分钟）：暂未确认升级结果。\n` +
                  `⚠️ 这不代表升级失败 —— 可能仍在拉取镜像或重建容器（镜像加速器较慢时尤其如此）。\n` +
                  `建议：\n` +
                  `· 刷新本页面查看最新状态（升级管理页会显示当前版本）\n` +
                  `· 或登录 Portainer 核对容器实际镜像版本\n` +
                  `· 确认无进行中升级后，可再次点击升级重试`,
              }
            : prev
        );
      }
    };

    // 首次等10秒后再开始轮询（给 Portainer 拉镜像的时间）
    setTimeout(() => {
      poll();
      pollTimerRef.current = setInterval(poll, 5000);
    }, 10000);

    const cleanup = () => {
      if (upgradeTimerRef.current) {
        clearInterval(upgradeTimerRef.current);
        upgradeTimerRef.current = null;
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  };

  const handleExecuteUpgrade = async () => {
    if (!updateInfo?.latestVersion) return;
    setShowConfirmDialog(false);

    const versionFrom = currentVersion?.version || "unknown";
    const versionTo = updateInfo.latestVersion;

    // 立即显示升级进度面板
    setUpgradeProgress({
      phase: "sending",
      message: "正在向后端发送升级请求...",
      elapsedSeconds: 0,
      versionFrom,
      versionTo,
    });

    // 记录本次升级记录 id：轮询时带上它才能准确追踪这条记录。
    // （不带 id 时后端只返回"进行中"的记录，升级一完成就会变成"暂无升级记录"）
    let upgradeId: string | undefined;
    try {
      // 发送升级请求（后端 fire-and-forget 会快速返回）
      const result = await upgradeAPI.executeUpgrade(versionTo);
      upgradeId = result?.id;
      // 请求成功返回，进入等待阶段
      setUpgradeProgress((prev) =>
        prev
          ? {
              ...prev,
              phase: "waiting",
              message: "升级请求已发送，服务即将重启...",
            }
          : prev
      );
    } catch (error: any) {
      // 区分两类失败：
      // ① 后端**明确拒绝**（如 409 已有升级在进行、预检未通过）——这不是"正在重启"，
      //    必须直接告知用户，且**不要启动轮询**，否则会空等到超时并误报"升级异常"。
      // ② 网络中断（fetch failed / net::ERR_FAILED）——升级已触发、后端正在重启，属正常现象。
      const status = error?.status;
      const msg = String(error?.message || '');
      const isRejected =
        status === 409 ||
        status === 400 ||
        /正在进行|升级正在|校验|不存在|未启用|配置不完整/.test(msg);

      if (isRejected) {
        setUpgradeProgress((prev) =>
          prev
            ? {
                ...prev,
                phase: "failed",
                errorMessage: msg || "升级请求被后端拒绝，请稍后重试",
              }
            : prev
        );
        return; // 明确被拒 → 不进入轮询等待
      }

      setUpgradeProgress((prev) =>
        prev
          ? {
              ...prev,
              phase: "waiting",
              message: "服务正在重启中（连接已断开，这是正常现象）...",
            }
          : prev
      );
    }

    // 无论请求成功还是失败，都启动轮询检测
    startPolling(versionTo, versionFrom, upgradeId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle2 className="w-3 h-3 mr-1" />成功</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />失败</Badge>;
      case "running":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100"><Loader2 className="w-3 h-3 mr-1 animate-spin" />进行中</Badge>;
      case "deploying":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"><Loader2 className="w-3 h-3 mr-1 animate-spin" />部署中</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // 如果正在升级，显示进度面板
  if (upgradeProgress) {
    return (
      <div className="space-y-6">
        <UpgradeProgressPanel
          state={upgradeProgress}
          onClose={() => setUpgradeProgress(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 版本信息与检查更新 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            系统版本
          </CardTitle>
          <CardDescription>查看当前系统版本并检查可用更新</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">当前版本</div>
              <div className="text-2xl font-bold">
                v{currentVersion?.version || "加载中..."}
              </div>
              {currentVersion?.releaseDate && (
                <div className="text-xs text-muted-foreground mt-1">
                  发布于 {new Date(currentVersion.releaseDate).toLocaleDateString("zh-CN")}
                </div>
              )}
            </div>
            <Button onClick={handleCheckUpdate} disabled={checking}>
              {checking ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              检查更新
            </Button>
          </div>

          {/* 更新结果 */}
          {updateInfo && (
            <div className="mt-4">
              <Separator className="mb-4" />
              {updateInfo.hasUpdate ? (
                <div className="rounded-lg border border-border bg-muted/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowUpCircle className="w-5 h-5 text-primary" />
                        <span className="font-semibold text-foreground">
                          发现新版本: v{updateInfo.latestVersion}
                        </span>
                      </div>
                      {updateInfo.releaseDate && (
                        <div className="text-sm text-muted-foreground">
                          发布于 {new Date(updateInfo.releaseDate).toLocaleDateString("zh-CN")}
                        </div>
                      )}
                    </div>
                    <Button onClick={() => setShowConfirmDialog(true)}>
                      <Download className="w-4 h-4 mr-2" />
                      开始升级
                    </Button>
                  </div>
                  {updateInfo.releaseNotes && (
                    <div className="mt-3 text-sm text-foreground border-t border-border pt-3">
                      <div className="font-medium mb-2">更新说明：</div>
                      <div className="prose prose-sm prose-invert max-w-none prose-table:border-collapse prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-1.5 prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-1.5 prose-th:bg-muted">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {updateInfo.releaseNotes}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-400 bg-green-950/30 rounded-lg border border-border p-4">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>当前已是最新版本 v{updateInfo.currentVersion}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 升级日志 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            升级日志
          </CardTitle>
          <CardDescription>查看历史升级记录</CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : upgradeLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无升级记录
            </div>
          ) : (
            <div className="space-y-3">
              {upgradeLogs.map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-4">
                    {getStatusBadge(log.status)}
                    <div>
                      <div className="text-sm font-medium">
                        v{log.versionFrom} → v{log.versionTo}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {log.startedAt ? new Date(log.startedAt).toLocaleString("zh-CN") : "-"}
                        {log.operator && ` · ${log.operator.name || log.operator.username}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDuration(log.durationMs)}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end mt-4">
            <Button variant="outline" size="sm" onClick={loadUpgradeLogs}>
              <RefreshCw className="w-3 h-3 mr-1" />
              刷新
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 升级确认对话框 */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认升级</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <div>
                  即将从 <strong>v{updateInfo?.currentVersion}</strong> 升级到{" "}
                  <strong>v{updateInfo?.latestVersion}</strong>
                </div>
                <div className="text-amber-600">
                  升级过程中服务将短暂不可用，升级完成后会自动恢复。请确保当前没有重要操作正在进行。
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleExecuteUpgrade}>
              确认升级
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ========== 升级设置 Tab ==========
function UpgradeSettingsTab() {
  const [config, setConfig] = useState<any>({
    githubOwner: "",
    githubRepo: "",
    githubToken: "",
    dockerImagePrefix: "",
    portainerEnabled: false,
    portainerUrl: "",
    portainerApiKey: "",
    portainerStackId: 0,
    portainerEndpointId: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await upgradeAPI.getConfig();
      setConfig(data);
    } catch (err: any) {
      toast.error("加载配置失败: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await upgradeAPI.saveConfig(config);
      setConfig(saved);
      toast.success("配置已保存");
    } catch (err: any) {
      toast.error("保存失败: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const result = await upgradeAPI.testPortainerConnection();
      if (result.success) {
        toast.success(`连接成功！堆栈: ${result.stackInfo?.name || "OK"}`);
      } else {
        toast.error(`连接失败: ${result.message}`);
      }
    } catch (err: any) {
      toast.error("连接测试失败: " + err.message);
    } finally {
      setTesting(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* GitHub 配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            GitHub 配置
          </CardTitle>
          <CardDescription>
            配置 GitHub 仓库信息，用于检查版本更新和获取 Release 信息
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="githubOwner">仓库所有者</Label>
              <Input
                id="githubOwner"
                placeholder="例如: miaochi998"
                value={config.githubOwner}
                onChange={(e) => updateField("githubOwner", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="githubRepo">仓库名称</Label>
              <Input
                id="githubRepo"
                placeholder="例如: bnoa"
                value={config.githubRepo}
                onChange={(e) => updateField("githubRepo", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="githubToken">
              GitHub Token{" "}
              <span className="text-muted-foreground text-xs">
                （私有仓库必需，公开仓库可留空）
              </span>
            </Label>
            <Input
              id="githubToken"
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
              value={config.githubToken}
              onChange={(e) => updateField("githubToken", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Docker 配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Docker 镜像配置
          </CardTitle>
          <CardDescription>
            配置 Docker Hub 镜像前缀，用于匹配和更新堆栈中的镜像版本
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="dockerImagePrefix">镜像前缀</Label>
            <Input
              id="dockerImagePrefix"
              placeholder="例如: miaochi/bnoa"
              value={config.dockerImagePrefix}
              onChange={(e) => updateField("dockerImagePrefix", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              镜像将为: {config.dockerImagePrefix || "miaochi/bnoa"}-backend:版本号 和{" "}
              {config.dockerImagePrefix || "miaochi/bnoa"}-frontend:版本号
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Portainer 配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Portainer 配置
          </CardTitle>
          <CardDescription>
            配置 Portainer API 连接参数，用于在线更新 Docker 堆栈
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>启用 Portainer 集成</Label>
              <p className="text-xs text-muted-foreground">
                启用后可通过 Portainer API 实现一键升级
              </p>
            </div>
            <Switch
              checked={config.portainerEnabled}
              onCheckedChange={(checked) =>
                updateField("portainerEnabled", checked)
              }
            />
          </div>

          {config.portainerEnabled && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="portainerUrl">Portainer URL</Label>
                  <Input
                    id="portainerUrl"
                    placeholder="例如: http://192.168.1.100:9000"
                    value={config.portainerUrl}
                    onChange={(e) => updateField("portainerUrl", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="portainerApiKey">API Token</Label>
                  <Input
                    id="portainerApiKey"
                    type="password"
                    placeholder="Portainer API Token"
                    value={config.portainerApiKey}
                    onChange={(e) =>
                      updateField("portainerApiKey", e.target.value)
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="portainerStackId">堆栈 ID</Label>
                    <Input
                      id="portainerStackId"
                      type="number"
                      placeholder="例如: 1"
                      value={config.portainerStackId || ""}
                      onChange={(e) =>
                        updateField(
                          "portainerStackId",
                          parseInt(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="portainerEndpointId">端点 ID</Label>
                    <Input
                      id="portainerEndpointId"
                      type="number"
                      placeholder="例如: 2"
                      value={config.portainerEndpointId || ""}
                      onChange={(e) =>
                        updateField(
                          "portainerEndpointId",
                          parseInt(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testing}
                >
                  {testing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Wifi className="w-4 h-4 mr-2" />
                  )}
                  测试连接
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Settings className="w-4 h-4 mr-2" />
          )}
          保存配置
        </Button>
      </div>
    </div>
  );
}

// ========== 主页面 ==========
export default function UpgradePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">系统升级</h2>
        <p className="text-muted-foreground">
          在线检查更新、一键升级系统，管理升级配置
        </p>
      </div>

      <Tabs defaultValue="management" className="space-y-4">
        <TabsList>
          <TabsTrigger value="management">
            <ArrowUpCircle className="w-4 h-4 mr-2" />
            升级管理
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 mr-2" />
            升级设置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="management">
          <UpgradeManagementTab />
        </TabsContent>

        <TabsContent value="settings">
          <UpgradeSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
