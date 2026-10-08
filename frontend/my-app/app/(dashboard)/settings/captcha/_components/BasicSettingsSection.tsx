'use client';

import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { CaptchaFullConfig } from '../page';

interface Props {
    config: CaptchaFullConfig;
    onUpdate: (
        updates: Partial<CaptchaFullConfig>,
    ) => void;
}

export default function BasicSettingsSection({
    config,
    onUpdate,
}: Props) {
    return (
        <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <Label className="text-sm font-medium">
                            启用验证码
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                            全局开关，关闭后所有场景不再显示验证码
                        </p>
                    </div>
                    <Switch
                        checked={config.enabled}
                        onCheckedChange={(v) =>
                            onUpdate({ enabled: v })
                        }
                    />
                </div>

                <div className="space-y-2">
                    <Label className="text-sm font-medium">
                        验证码类型
                    </Label>
                    <Select
                        value={config.type}
                        onValueChange={(v) =>
                            onUpdate({ type: v })
                        }
                    >
                        <SelectTrigger className="w-full bg-background">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="slider">
                                滑块拼图
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        目前仅支持滑块拼图验证码
                    </p>
                </div>

                <div className="space-y-2">
                    <Label className="text-sm font-medium">
                        验证过期时间（秒）
                    </Label>
                    <Input
                        type="number"
                        min={60}
                        max={600}
                        value={config.expireTime}
                        onChange={(e) =>
                            onUpdate({
                                expireTime:
                                    parseInt(
                                        e.target.value,
                                    ) || 300,
                            })
                        }
                        className="bg-background"
                    />
                    <p className="text-xs text-muted-foreground">
                        验证码生成后的有效时间，范围
                        60-600 秒
                    </p>
                </div>

                <div className="space-y-2">
                    <Label className="text-sm font-medium">
                        验证容差（像素）
                    </Label>
                    <Input
                        type="number"
                        min={1}
                        max={20}
                        value={config.tolerance}
                        onChange={(e) =>
                            onUpdate({
                                tolerance:
                                    parseInt(
                                        e.target.value,
                                    ) || 5,
                            })
                        }
                        className="bg-background"
                    />
                    <p className="text-xs text-muted-foreground">
                        拼图位置允许的偏差范围，值越小越严格，范围
                        1-20
                    </p>
                </div>
            </div>
        </div>
    );
}
