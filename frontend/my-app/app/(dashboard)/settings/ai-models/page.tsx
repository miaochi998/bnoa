'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Alert,
    AlertDescription,
} from '@/components/ui/alert';
import {
    Plus,
    Edit2,
    Trash2,
    Loader2,
    Bot,
    HelpCircle,
    AlertCircle,
    Lock,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { PermissionGate } from '@/components/PermissionGate';
import { useFieldPermissions } from '@/lib/hooks/useFieldPermissions';

interface AIModel {
    id: string;
    name: string;
    displayName: string;
    provider: string;
    modelId: string;
    apiEndpoint?: string;
    description?: string;
    isEnabled: boolean;
    isDefault: boolean;
    isFree: boolean;
    sortOrder: number;
    config?: Record<string, any>;
}

interface FormData {
    name: string;
    displayName: string;
    provider: string;
    modelId: string;
    apiEndpoint: string;
    description: string;
    apiKey: string;
    isFree: boolean;
    isDefault: boolean;
    sortOrder: number;
}

const defaultFormData: FormData = {
    name: '',
    displayName: '',
    provider: '',
    modelId: '',
    apiEndpoint: '',
    description: '',
    apiKey: '',
    isFree: false,
    isDefault: false,
    sortOrder: 0,
};

/**
 * 字段级权限：字段可见但不可编辑时的可读提示。
 * ⚠️ 只置灰不提示、提交时仍带上该字段，会让用户误以为改成功了。
 */
function ReadOnlyHint() {
    return (
        <p className="flex items-center gap-1 text-[11px] leading-4 text-muted-foreground">
            <Lock className="h-3 w-3" />
            该字段无编辑权限，已锁定
        </p>
    );
}

export default function AIModelsPage() {
    // 字段级权限（模块 ai-model）：name / displayName / provider / modelId /
    // apiEndpoint / config / description / isEnabled / isDefault / isFree
    const fp = useFieldPermissions('ai-model');
    const [models, setModels] = useState<AIModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingModel, setEditingModel] =
        useState<AIModel | null>(null);
    const [formData, setFormData] =
        useState<FormData>(defaultFormData);
    const [saving, setSaving] = useState(false);

    const loadModels = useCallback(async () => {
        try {
            setLoading(true);
            const data = await apiClient.getAIModels();
            setModels(data);
        } catch (error: any) {
            alert(error.message || '加载模型列表失败');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadModels();
    }, [loadModels]);

    const handleAdd = () => {
        setEditingModel(null);
        setFormData(defaultFormData);
        setDialogOpen(true);
    };

    const handleEdit = (model: AIModel) => {
        setEditingModel(model);
        setFormData({
            name: model.name,
            displayName: model.displayName,
            provider: model.provider,
            modelId: model.modelId,
            apiEndpoint: model.apiEndpoint || '',
            description: model.description || '',
            apiKey: '',
            isFree: model.isFree,
            isDefault: model.isDefault,
            sortOrder: model.sortOrder,
        });
        setDialogOpen(true);
    };

    const handleDelete = async (model: AIModel) => {
        if (
            !confirm(
                `确认删除模型「${model.displayName}」？`,
            )
        )
            return;
        try {
            await apiClient.deleteAIModel(model.id);
            await loadModels();
        } catch (error: any) {
            alert(error.message || '删除失败');
        }
    };

    const handleToggle = async (
        model: AIModel,
        isEnabled: boolean,
    ) => {
        if (!fp.canEdit('isEnabled')) {
            alert('当前角色无「是否启用」编辑权限');
            return;
        }
        try {
            await apiClient.toggleAIModel(
                model.id,
                isEnabled,
            );
            await loadModels();
        } catch (error: any) {
            alert(error.message || '操作失败');
        }
    };

    const handleSubmit = async () => {
        if (!fp.loaded) {
            alert('字段权限加载中，请稍后再试');
            return;
        }
        // 新建时必填字段若不可编辑，前端给不出有效值 —— 显式阻断，避免静默失败
        if (!editingModel) {
            const missing = [
                !fp.canEdit('name') ? '唯一标识' : '',
                !fp.canEdit('displayName') ? '显示名称' : '',
                !fp.canEdit('provider') ? '提供商' : '',
                !fp.canEdit('modelId') ? '模型ID' : '',
            ].filter(Boolean);
            if (missing.length) {
                alert(
                    `当前角色无「${missing.join('、')}」编辑权限，无法新增模型`,
                );
                return;
            }
        }
        if (
            !formData.name ||
            !formData.displayName ||
            !formData.provider ||
            !formData.modelId
        ) {
            alert('请填写必填字段');
            return;
        }

        setSaving(true);
        try {
            const config: Record<string, any> = {};
            if (formData.apiKey) {
                config.apiKey = formData.apiKey;
            }

            // 字段级权限：不可编辑的字段一律不提交（编辑态保持原值）
            const payload: any = {
                sortOrder: formData.sortOrder,
            };
            if (fp.canEdit('displayName'))
                payload.displayName = formData.displayName;
            if (fp.canEdit('provider'))
                payload.provider = formData.provider;
            if (fp.canEdit('modelId'))
                payload.modelId = formData.modelId;
            if (fp.canEdit('apiEndpoint'))
                payload.apiEndpoint =
                    formData.apiEndpoint || undefined;
            if (fp.canEdit('description'))
                payload.description =
                    formData.description || undefined;
            if (fp.canEdit('isFree'))
                payload.isFree = formData.isFree;
            if (fp.canEdit('isDefault'))
                payload.isDefault = formData.isDefault;
            if (
                fp.canEdit('config') &&
                Object.keys(config).length > 0
            ) {
                payload.config = config;
            }

            if (editingModel) {
                if (fp.canEdit('config') && editingModel.config) {
                    const existConfig =
                        editingModel.config as Record<
                            string,
                            any
                        >;
                    if (!config.apiKey && existConfig.apiKey) {
                        payload.config = {
                            ...config,
                            apiKey: existConfig.apiKey,
                        };
                    }
                }
                await apiClient.updateAIModel(
                    editingModel.id,
                    payload,
                );
            } else {
                payload.name = formData.name;
                await apiClient.createAIModel(payload);
            }

            setDialogOpen(false);
            await loadModels();
        } catch (error: any) {
            alert(error.message || '保存失败');
        } finally {
            setSaving(false);
        }
    };

    const FieldTip = ({ tip }: { tip: string }) => (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                    <p className="max-w-[240px] text-xs">
                        {tip}
                    </p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );

    return (
        <div className="space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold">
                        AI模型管理
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        配置和管理AI模型，设置API Key和模型参数
                    </p>
                </div>
                <PermissionGate permission="ai-model:create">
                    <Button onClick={handleAdd} size="sm">
                        <Plus className="h-4 w-4 mr-1.5" />
                        新增模型
                    </Button>
                </PermissionGate>
            </div>

            {/* 模型列表 */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : models.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-card">
                    <Bot className="h-12 w-12 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                        暂无AI模型
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                        点击上方按钮添加第一个AI模型
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {models.map((model) => (
                        <div
                            key={model.id}
                            className="flex items-center justify-between px-4 py-3 border rounded-lg bg-card hover:bg-card-hover transition-colors"
                        >
                            <div className="space-y-1">
                                {(fp.canView('displayName') ||
                                    fp.canView('isFree') ||
                                    fp.canView('isDefault')) && (
                                    <div className="flex items-center gap-2">
                                        {fp.canView('displayName') && (
                                            <span className="font-medium text-sm">
                                                {model.displayName}
                                            </span>
                                        )}
                                        {fp.canView('isFree') &&
                                            model.isFree && (
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] text-green-500 border-green-500/30 px-1.5 py-0"
                                                >
                                                    免费
                                                </Badge>
                                            )}
                                        {fp.canView('isDefault') &&
                                            model.isDefault && (
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] text-blue-500 border-blue-500/30 px-1.5 py-0"
                                                >
                                                    默认
                                                </Badge>
                                            )}
                                    </div>
                                )}
                                {fp.canView('description') &&
                                    model.description && (
                                        <p className="text-xs text-muted-foreground">
                                            {model.description}
                                        </p>
                                    )}
                                {(fp.canView('provider') ||
                                    fp.canView('modelId')) && (
                                    <p className="text-xs text-muted-foreground/60">
                                        {fp.canView('provider')
                                            ? model.provider
                                            : ''}
                                        {fp.canView('provider') &&
                                        fp.canView('modelId')
                                            ? ' · '
                                            : ''}
                                        {fp.canView('modelId')
                                            ? model.modelId
                                            : ''}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                {fp.canEdit('isEnabled') ? (
                                    <Switch
                                        checked={model.isEnabled}
                                        onCheckedChange={(
                                            checked,
                                        ) =>
                                            handleToggle(
                                                model,
                                                checked,
                                            )
                                        }
                                    />
                                ) : (
                                    <span
                                        className="flex items-center gap-1 text-[11px] text-muted-foreground"
                                        title="该字段无编辑权限，已锁定"
                                    >
                                        <Lock className="h-3 w-3" />
                                        <Switch
                                            checked={model.isEnabled}
                                            disabled
                                        />
                                    </span>
                                )}
                                <PermissionGate permission="ai-model:update">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() =>
                                            handleEdit(model)
                                        }
                                    >
                                        <Edit2 className="h-3.5 w-3.5" />
                                    </Button>
                                </PermissionGate>
                                <PermissionGate permission="ai-model:delete">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-red-400 hover:text-red-300"
                                        onClick={() =>
                                            handleDelete(model)
                                        }
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </PermissionGate>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 新增/编辑 Dialog */}
            <Dialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
            >
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingModel
                                ? '编辑AI模型'
                                : '新增AI模型'}
                        </DialogTitle>
                    </DialogHeader>

                    <Alert className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                            Provider 填写服务提供商标识（如
                            google、openrouter、deepseek），Model
                            ID
                            填写实际调用API时使用的模型ID。API
                            Key
                            为可选项，留空则使用服务器环境变量配置。
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-4">
                        {/* 第一行：显示名称 + 唯一标识 */}
                        <div className="grid grid-cols-2 gap-4">
                            {fp.canView('displayName') && (
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <Label className="text-xs">
                                            显示名称 *
                                        </Label>
                                        <FieldTip tip="在模型选择下拉菜单中显示的名称" />
                                    </div>
                                    <Input
                                        placeholder="例如: DeepSeek V3"
                                        value={formData.displayName}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                displayName:
                                                    e.target.value,
                                            })
                                        }
                                        className="h-9 text-sm"
                                        disabled={
                                            !fp.canEdit('displayName')
                                        }
                                    />
                                    {!fp.canEdit('displayName') && (
                                        <ReadOnlyHint />
                                    )}
                                </div>
                            )}
                            {fp.canView('name') && (
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <Label className="text-xs">
                                            唯一标识 *
                                        </Label>
                                        <FieldTip tip="模型的唯一标识符，创建后不可修改，如: deepseek-v3" />
                                    </div>
                                    <Input
                                        placeholder="例如: deepseek-v3"
                                        value={formData.name}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                name: e.target.value,
                                            })
                                        }
                                        className="h-9 text-sm"
                                        disabled={
                                            !!editingModel ||
                                            !fp.canEdit('name')
                                        }
                                    />
                                    {!fp.canEdit('name') && (
                                        <ReadOnlyHint />
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 第二行：提供商 + 模型ID */}
                        <div className="grid grid-cols-2 gap-4">
                            {fp.canView('provider') && (
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <Label className="text-xs">
                                            提供商 *
                                        </Label>
                                        <FieldTip tip="服务提供商标识，决定使用哪个Provider实现。值: google、openrouter、deepseek" />
                                    </div>
                                    <Input
                                        placeholder="例如: deepseek"
                                        value={formData.provider}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                provider:
                                                    e.target.value,
                                            })
                                        }
                                        className="h-9 text-sm"
                                        disabled={!fp.canEdit('provider')}
                                    />
                                    {!fp.canEdit('provider') && (
                                        <ReadOnlyHint />
                                    )}
                                </div>
                            )}
                            {fp.canView('modelId') && (
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <Label className="text-xs">
                                            模型ID *
                                        </Label>
                                        <FieldTip tip="实际调用API时使用的模型标识，如: deepseek-chat、gemini-2.5-flash" />
                                    </div>
                                    <Input
                                        placeholder="例如: deepseek-chat"
                                        value={formData.modelId}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                modelId:
                                                    e.target.value,
                                            })
                                        }
                                        className="h-9 text-sm"
                                        autoComplete="off"
                                        disabled={!fp.canEdit('modelId')}
                                    />
                                    {!fp.canEdit('modelId') && (
                                        <ReadOnlyHint />
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 第三行：API Key（属于 config 字段） */}
                        {fp.canView('config') && (
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                    <Label className="text-xs">
                                        API Key
                                    </Label>
                                    <FieldTip tip="模型专用的API Key。留空则使用服务器环境变量配置。编辑时留空不会覆盖已有Key。" />
                                </div>
                                <Input
                                    type="text"
                                    placeholder="sk-..."
                                    value={formData.apiKey}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            apiKey: e.target.value,
                                        })
                                    }
                                    className="h-9 text-sm"
                                    autoComplete="new-password"
                                    data-lpignore="true"
                                    data-1p-ignore
                                    disabled={!fp.canEdit('config')}
                                />
                                {!fp.canEdit('config') && <ReadOnlyHint />}
                            </div>
                        )}

                        {/* 第四行：描述 */}
                        {fp.canView('description') && (
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                    <Label className="text-xs">
                                        描述
                                    </Label>
                                    <FieldTip tip="简要描述该模型的特点和用途" />
                                </div>
                                <Textarea
                                    placeholder="简要描述该模型的特点..."
                                    value={formData.description}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            description:
                                                e.target.value,
                                        })
                                    }
                                    className="min-h-[60px] text-sm resize-none"
                                    disabled={!fp.canEdit('description')}
                                />
                                {!fp.canEdit('description') && (
                                    <ReadOnlyHint />
                                )}
                            </div>
                        )}

                        {/* 第五行：API端点 */}
                        {fp.canView('apiEndpoint') && (
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                    <Label className="text-xs">
                                        API端点
                                    </Label>
                                    <FieldTip tip="可选的自定义API端点，用于中转服务或私有部署。留空则使用Provider默认端点。" />
                                </div>
                                <Input
                                    placeholder="例如: https://openrouter.ai/api/v1"
                                    value={formData.apiEndpoint}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            apiEndpoint:
                                                e.target.value,
                                        })
                                    }
                                    className="h-9 text-sm"
                                    disabled={!fp.canEdit('apiEndpoint')}
                                />
                                {!fp.canEdit('apiEndpoint') && (
                                    <ReadOnlyHint />
                                )}
                            </div>
                        )}

                        {/* 第六行：开关和排序 */}
                        <div className="grid grid-cols-3 gap-4">
                            {fp.canView('isFree') && (
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={formData.isFree}
                                        disabled={!fp.canEdit('isFree')}
                                        onCheckedChange={(
                                            checked,
                                        ) =>
                                            setFormData({
                                                ...formData,
                                                isFree: checked,
                                            })
                                        }
                                    />
                                    <Label className="text-xs">
                                        免费模型
                                    </Label>
                                    {!fp.canEdit('isFree') && (
                                        <Lock
                                            className="h-3 w-3 text-muted-foreground"
                                            aria-label="该字段无编辑权限，已锁定"
                                        />
                                    )}
                                </div>
                            )}
                            {fp.canView('isDefault') && (
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={formData.isDefault}
                                        disabled={!fp.canEdit('isDefault')}
                                        onCheckedChange={(
                                            checked,
                                        ) =>
                                            setFormData({
                                                ...formData,
                                                isDefault: checked,
                                            })
                                        }
                                    />
                                    <Label className="text-xs">
                                        默认模型
                                    </Label>
                                    {!fp.canEdit('isDefault') && (
                                        <Lock
                                            className="h-3 w-3 text-muted-foreground"
                                            aria-label="该字段无编辑权限，已锁定"
                                        />
                                    )}
                                </div>
                            )}
                            <div className="space-y-1.5">
                                <Label className="text-xs">
                                    排序
                                </Label>
                                <Input
                                    type="number"
                                    value={formData.sortOrder}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            sortOrder:
                                                parseInt(
                                                    e.target
                                                        .value,
                                                ) || 0,
                                        })
                                    }
                                    className="h-9 text-sm w-20"
                                    min={0}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 底部按钮 */}
                    <div className="flex justify-end gap-2 mt-4">
                        <Button
                            variant="outline"
                            onClick={() =>
                                setDialogOpen(false)
                            }
                            disabled={saving}
                        >
                            取消
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={saving || !fp.loaded}
                        >
                            {saving && (
                                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                            )}
                            保存
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
