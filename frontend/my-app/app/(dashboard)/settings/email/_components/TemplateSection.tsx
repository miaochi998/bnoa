'use client'

import { getApiBaseUrl } from '@/lib/config';

import {
    useState,
    useEffect,
    useCallback,
    useRef,
} from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Save, Send } from 'lucide-react';

const API_URL =
    getApiBaseUrl();

interface TemplateVariable {
    name: string;
    description: string;
}

interface TemplateItem {
    name: string;
    label: string;
    subject: string;
    variables: TemplateVariable[];
}

interface TemplateDetail extends TemplateItem {
    content: string;
}

export default function TemplateSection() {
    const [templates, setTemplates] = useState<
        TemplateItem[]
    >([]);
    const [selectedName, setSelectedName] =
        useState('');
    const [detail, setDetail] =
        useState<TemplateDetail | null>(null);
    const [editSubject, setEditSubject] =
        useState('');
    const [editContent, setEditContent] =
        useState('');
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] =
        useState(false);
    const [saving, setSaving] = useState(false);
    const [testOpen, setTestOpen] = useState(false);
    const [testEmail, setTestEmail] = useState('');
    const [testSending, setTestSending] =
        useState(false);
    const contentRef = useRef<HTMLTextAreaElement>(null);

    const getToken = () =>
        localStorage.getItem('accessToken');

    const loadTemplates = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(
                `${API_URL}/email/templates`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${getToken()}`,
                    },
                },
            );
            const json = await res.json();
            const data = json.data?.data || json.data;
            if (Array.isArray(data)) {
                setTemplates(data);
                if (data.length > 0 && !selectedName) {
                    setSelectedName(data[0].name);
                }
            }
        } catch {
            // 忽略
        } finally {
            setLoading(false);
        }
    }, [selectedName]);

    const loadDetail = useCallback(
        async (name: string) => {
            setDetailLoading(true);
            try {
                const res = await fetch(
                    `${API_URL}/email/templates/${name}`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${getToken()}`,
                        },
                    },
                );
                const json = await res.json();
                const data =
                    json.data?.data || json.data;
                if (data) {
                    setDetail(data);
                    setEditSubject(
                        data.subject || '',
                    );
                    setEditContent(
                        data.content || '',
                    );
                }
            } catch {
                // 忽略
            } finally {
                setDetailLoading(false);
            }
        },
        [],
    );

    useEffect(() => {
        loadTemplates();
    }, [loadTemplates]);

    useEffect(() => {
        if (selectedName) {
            loadDetail(selectedName);
        }
    }, [selectedName, loadDetail]);

    const handleSave = async () => {
        if (!selectedName) return;
        setSaving(true);
        try {
            const res = await fetch(
                `${API_URL}/email/templates/${selectedName}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type':
                            'application/json',
                        Authorization:
                            `Bearer ${getToken()}`,
                    },
                    body: JSON.stringify({
                        subject: editSubject,
                        content: editContent,
                    }),
                },
            );
            if (!res.ok) {
                const err = await res.json();
                throw new Error(
                    err.message || '保存失败',
                );
            }
            alert('模板保存成功');
        } catch (err: any) {
            alert(err.message || '保存模板失败');
        } finally {
            setSaving(false);
        }
    };

    const handleTestSend = async () => {
        if (!testEmail || !selectedName) return;
        setTestSending(true);
        try {
            const res = await fetch(
                `${API_URL}/email/templates/${selectedName}/test`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type':
                            'application/json',
                        Authorization:
                            `Bearer ${getToken()}`,
                    },
                    body: JSON.stringify({
                        to: testEmail,
                    }),
                },
            );
            if (!res.ok) {
                const err = await res.json();
                throw new Error(
                    err.message || '发送失败',
                );
            }
            alert('测试邮件已加入发送队列');
            setTestOpen(false);
            setTestEmail('');
        } catch (err: any) {
            alert(err.message || '发送测试邮件失败');
        } finally {
            setTestSending(false);
        }
    };

    const insertVariable = (varName: string) => {
        const ta = contentRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const text = `{{${varName}}}`;
        const newContent =
            editContent.substring(0, start) +
            text +
            editContent.substring(end);
        setEditContent(newContent);
        setTimeout(() => {
            ta.focus();
            ta.setSelectionRange(
                start + text.length,
                start + text.length,
            );
        }, 0);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex gap-4 min-h-[500px]">
            {/* 左侧模板列表 */}
            <div className="w-48 shrink-0 rounded-lg border border-border bg-card p-2 space-y-1">
                {templates.map((t) => (
                    <button
                        key={t.name}
                        onClick={() =>
                            setSelectedName(t.name)
                        }
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                            selectedName === t.name
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* 右侧编辑区 */}
            <div className="flex-1 rounded-lg border border-border bg-card p-6 space-y-5">
                {detailLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : detail ? (
                    <>
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-medium text-foreground">
                                {detail.label}
                            </h3>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setTestOpen(
                                            true,
                                        )
                                    }
                                >
                                    <Send className="h-4 w-4 mr-1" />
                                    发送测试
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={
                                        handleSave
                                    }
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    ) : (
                                        <Save className="h-4 w-4 mr-1" />
                                    )}
                                    保存模板
                                </Button>
                            </div>
                        </div>

                        {/* 邮件标题 */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">
                                邮件标题
                            </Label>
                            <Input
                                value={editSubject}
                                onChange={(e) =>
                                    setEditSubject(
                                        e.target.value,
                                    )
                                }
                                placeholder="邮件标题"
                                className="bg-background"
                            />
                        </div>

                        {/* 可用变量 */}
                        {detail.variables.length >
                            0 && (
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">
                                    可用变量（点击插入）
                                </Label>
                                <div className="flex flex-wrap gap-2">
                                    {detail.variables.map(
                                        (v) => (
                                            <Badge
                                                key={
                                                    v.name
                                                }
                                                variant="secondary"
                                                className="cursor-pointer hover:bg-primary/20"
                                                onClick={() =>
                                                    insertVariable(
                                                        v.name,
                                                    )
                                                }
                                            >
                                                {`{{${v.name}}}`}
                                                <span className="ml-1 text-muted-foreground">
                                                    {
                                                        v.description
                                                    }
                                                </span>
                                            </Badge>
                                        ),
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 模板内容 */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">
                                模板内容（Handlebars
                                HTML）
                            </Label>
                            <Textarea
                                ref={contentRef}
                                value={editContent}
                                onChange={(e) =>
                                    setEditContent(
                                        e.target.value,
                                    )
                                }
                                placeholder="<p>邮件正文...</p>"
                                className="bg-background min-h-[300px] font-mono text-sm"
                            />
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                        请从左侧选择一个模板
                    </div>
                )}
            </div>

            {/* 测试发送 Dialog */}
            <Dialog
                open={testOpen}
                onOpenChange={setTestOpen}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            发送模板测试邮件
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <p className="text-sm text-muted-foreground">
                            将使用模拟数据渲染模板「
                            {detail?.label}
                            」并发送
                        </p>
                        <div className="space-y-2">
                            <Label>收件人邮箱</Label>
                            <Input
                                type="email"
                                value={testEmail}
                                onChange={(e) =>
                                    setTestEmail(
                                        e.target.value,
                                    )
                                }
                                placeholder="输入收件邮箱地址"
                                className="bg-background"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    setTestOpen(false)
                                }
                            >
                                取消
                            </Button>
                            <Button
                                size="sm"
                                onClick={
                                    handleTestSend
                                }
                                disabled={
                                    !testEmail ||
                                    testSending
                                }
                            >
                                {testSending ? (
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4 mr-1" />
                                )}
                                发送
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
