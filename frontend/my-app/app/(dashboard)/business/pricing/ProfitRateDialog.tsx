'use client';

import { useState, useEffect } from 'react';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus, Lightbulb, HelpCircle } from 'lucide-react';

const PRESET_RATES = [
    0, 10, 20, 30, 40, 50, 60, 70,
    80, 90, 100, 150, 200,
];

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedRates: number[];
    onConfirm: (rates: number[]) => void;
}

export function ProfitRateDialog({
    open, onOpenChange, selectedRates, onConfirm,
}: Props) {
    const [rates, setRates] = useState<number[]>([]);
    const [customInput, setCustomInput] = useState('');

    useEffect(() => {
        if (open) {
            setRates([...selectedRates]);
            setCustomInput('');
        }
    }, [open, selectedRates]);

    const presetCount = rates.filter(
        (r) => PRESET_RATES.includes(r),
    ).length;
    const customRates = rates.filter(
        (r) => !PRESET_RATES.includes(r),
    );

    const togglePreset = (rate: number) => {
        setRates((prev) =>
            prev.includes(rate)
                ? prev.filter((r) => r !== rate)
                : [...prev, rate],
        );
    };

    const addCustom = () => {
        const val = parseFloat(customInput);
        if (isNaN(val) || val < 0 || val > 1000) return;
        const rounded =
            Math.round(val * 1000) / 1000;
        if (rates.includes(rounded)) return;
        setRates((prev) => [...prev, rounded]);
        setCustomInput('');
    };

    const removeRate = (rate: number) => {
        setRates((prev) =>
            prev.filter((r) => r !== rate),
        );
    };

    const handleConfirm = () => {
        const sorted =
            [...rates].sort((a, b) => a - b);
        onConfirm(sorted);
        onOpenChange(false);
    };

    const fmtRate = (r: number) => {
        if (Number.isInteger(r)) return `${r}%`;
        return `${r.toFixed(3)}%`;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-[#262626] border-[#1e1e1e] text-white sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>利润率设置</DialogTitle>
                </DialogHeader>
                <div className="space-y-5">
                    {/* 系统预设利润率 */}
                    <div className="p-4 bg-[#1e1e1e] rounded-lg space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            系统预设利润率
                            <HelpCircle className="w-3.5 h-3.5 text-[#8e8e8e]" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {PRESET_RATES.map((rate) => (
                                <button
                                    key={rate}
                                    onClick={() =>
                                        togglePreset(rate)}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                        rates.includes(rate)
                                            ? 'bg-[#409fff] text-white'
                                            : 'bg-[#2e2e2e] text-[#8e8e8e] hover:bg-[#363636] hover:text-white'
                                    }`}
                                >
                                    {rate}%
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 自定义利润率 */}
                    <div className="p-4 bg-[#1e1e1e] rounded-lg space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            自定义利润率
                            <HelpCircle className="w-3.5 h-3.5 text-[#8e8e8e]" />
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                step="0.001"
                                min="0"
                                max="1000"
                                value={customInput}
                                onChange={(e) =>
                                    setCustomInput(
                                        e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter')
                                        addCustom();
                                }}
                                placeholder="请输入自定义利润率（可选）"
                                className="bg-[#2e2e2e] border-[#3e3e3e] text-white flex-1"
                            />
                            <span className="text-[#8e8e8e] text-sm">
                                %
                            </span>
                            <Button
                                variant="outline"
                                onClick={addCustom}
                                disabled={!customInput}
                                className="border-[#3e3e3e] bg-[#2e2e2e] text-white hover:bg-[#363636]"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                添加
                            </Button>
                        </div>
                        {customRates.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {customRates.map((rate) => (
                                    <span
                                        key={rate}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30"
                                    >
                                        {fmtRate(rate)}
                                        <button
                                            onClick={() =>
                                                removeRate(rate)}
                                            className="hover:text-white transition-colors"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 当前选择汇总 */}
                    <div className="p-4 bg-[#1e1e1e] rounded-lg space-y-3">
                        <div className="text-sm font-medium">
                            当前选择汇总
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                            <span className="px-2 py-1 rounded bg-[#409fff]/20 text-[#409fff]">
                                预设利润率: {presetCount}个
                            </span>
                            <span className="px-2 py-1 rounded bg-[#22c55e]/20 text-[#22c55e]">
                                自定义利润率: {customRates.length}个
                            </span>
                            <span className="px-2 py-1 rounded bg-[#eab308]/20 text-[#eab308]">
                                总计: {rates.length}个
                            </span>
                        </div>
                        {rates.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {[...rates]
                                    .sort((a, b) => a - b)
                                    .map((rate) => (
                                        <span
                                            key={rate}
                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm ${
                                                PRESET_RATES.includes(rate)
                                                    ? 'bg-[#2e2e2e] text-white'
                                                    : 'bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30'
                                            }`}
                                        >
                                            {fmtRate(rate)}
                                            <button
                                                onClick={() =>
                                                    removeRate(rate)}
                                                className="hover:text-red-400 transition-colors"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                            </div>
                        ) : (
                            <p className="text-[#8e8e8e] text-sm">
                                未选择任何利润率
                            </p>
                        )}
                    </div>

                    {/* 说明 */}
                    <div className="p-4 bg-[#1e1e1e] rounded-lg space-y-2">
                        <div className="flex items-center gap-2 text-sm text-[#eab308]">
                            <Lightbulb className="w-4 h-4" />
                            利润率设置说明
                        </div>
                        <ul className="text-xs text-[#8e8e8e] space-y-1 ml-5 list-disc">
                            <li>选择的利润率将用于计算建议售价和毛利润</li>
                            <li>支持同时选择多个利润率进行对比分析</li>
                            <li>利润率以百分比形式输入，范围为0-1000%，支持3位小数</li>
                            <li>修改后会自动保存草稿，完成设置后正式生效</li>
                            <li>利润率设置为可选步骤，不选择也可以完成设置</li>
                        </ul>
                    </div>

                    {/* 按钮 */}
                    <div className="flex justify-end gap-3">
                        <Button
                            variant="outline"
                            onClick={() =>
                                onOpenChange(false)}
                            className="border-[#3e3e3e] bg-[#2e2e2e] text-white hover:bg-[#363636]"
                        >
                            取消
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            className="bg-[#409fff] hover:bg-[#409fff]/90 text-white"
                        >
                            完成设置
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
