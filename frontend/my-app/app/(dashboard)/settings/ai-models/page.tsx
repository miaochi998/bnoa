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
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { PermissionGate } from '@/components/PermissionGate';

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

export default function AIModelsPage() {
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

            const payload: any = {
                displayName: formData.displayName,
                provider: formData.provider,
                modelId: formData.modelId,
                apiEndpoint:
                    formData.apiEndpoint || undefined,
                description:
                    formData.description || undefined,
                isFree: formData.isFree,
                isDefault: formData.isDefault,
                sortOrder: formData.sortOrder,
                config:
                    Object.keys(config).length > 0
                        ? config
                        : undefined,
            };

            if (editingModel) {
                if (editingModel.config) {
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
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">
                                        {model.displayName}
                                    </span>
                                    {model.isFree && (
                                        <Badge
                                            variant="outline"
                                            className="text-[10px] text-green-500 border-green-500/30 px-1.5 py-0"
                                        >
                                            免费
                                        </Badge>
                                    )}
                                    {model.isDefault && (
                                        <Badge
                                            variant="outline"
                                            className="text-[10px] text-blue-500 border-blue-500/30 px-1.5 py-0"
                                        >
                                            默认
                                        </Badge>
                                    )}
                                </div>
                                {model.description && (
                                    <p className="text-xs text-muted-foreground">
                                        {model.description}
                                    </p>
                                )}
                                <p className="text-xs text-muted-foreground/60">
                                    {model.provider} ·{' '}
                                    {model.modelId}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
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
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                    <Label className="text-xs">
                                        显示名称 *
                                    </Label>
                                    <FieldTip tip="在模型选择下拉菜单中显示的名称" />
                                </div>
                                <Input
                                    placeholder="例如: DeepSeek V3"
                                    value={
                                        formData.displayName
                                    }
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            displayName:
                                                e.target.value,
                                        })
                                    }
                                    className="h-9 text-sm"
                                />
                            </div>
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
                                            name: e.target
                                                .value,
                                        })
                                    }
                                    className="h-9 text-sm"
                                    disabled={!!editingModel}
                                />
                            </div>
                        </div>

                        {/* 第二行：提供商 + 模型ID */}
                        <div className="grid grid-cols-2 gap-4">
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
                                />
                            </div>
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
                                />
                            </div>
                        </div>

                        {/* 第三行：API Key */}
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
                            />
                        </div>

                        {/* 第四行：描述 */}
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
                            />
                        </div>

                        {/* 第五行：API端点 */}
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
                            />
                        </div>

                        {/* 第六行：开关和排序 */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={formData.isFree}
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
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={
                                        formData.isDefault
                                    }
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
                            </div>
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
                            disabled={saving}
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
