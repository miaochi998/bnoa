'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    X,
    Send,
    Sparkles,
    Minimize2,
    Maximize2,
    RotateCw,
    Loader2,
    MessageSquare,
    PenLine,
    RefreshCw,
    FileText,
    CheckCheck,
    MousePointer,
    Replace,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface AIModel {
    id: string;
    name: string;
    displayName: string;
    provider: string;
    isFree: boolean;
    isDefault: boolean;
}

interface FloatingAIPanelProps {
    editor: Editor;
    isVisible: boolean;
    onClose: () => void;
}

export function FloatingAIPanel({
    editor,
    isVisible,
    onClose,
}: FloatingAIPanelProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [models, setModels] = useState<AIModel[]>([]);
    const [selectedModel, setSelectedModel] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isVisible) {
            loadModels();
        }
    }, [isVisible]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop =
                scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    const loadModels = async () => {
        try {
            const data = await apiClient.getEnabledAIModels();
            setModels(data);
            const defaultModel = data.find(
                (m: AIModel) => m.isDefault,
            );
            if (defaultModel && !selectedModel) {
                setSelectedModel(defaultModel.name);
            } else if (data.length > 0 && !selectedModel) {
                setSelectedModel(data[0].name);
            }
        } catch {
            // 静默处理
        }
    };

    const getSelectedText = useCallback(() => {
        const { from, to } = editor.state.selection;
        if (from === to) return '';
        return editor.state.doc.textBetween(from, to, '');
    }, [editor]);

    const sendMessage = async (prompt: string) => {
        if (!prompt.trim() || loading || !selectedModel) return;

        const selectedText = getSelectedText();
        const fullPrompt = selectedText
            ? `${prompt}：\n\n${selectedText}`
            : prompt;

        const userMsg: Message = {
            role: 'user',
            content: prompt,
        };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const result = await apiClient.generateAIContent({
                modelName: selectedModel,
                messages: [
                    ...messages.map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                    { role: 'user', content: fullPrompt },
                ],
            });
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content:
                        result?.content || 'AI 服务暂不可用',
                },
            ]);
        } catch (error: any) {
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content:
                        error?.message || 'AI 服务请求失败',
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleInsert = (
        content: string,
        mode: 'cursor' | 'replace',
    ) => {
        const { from, to } = editor.state.selection;
        if (mode === 'replace' && from !== to) {
            editor.commands.deleteSelection();
        }
        editor.commands.insertContent(content);
        editor.commands.focus();
    };

    const clearMessages = () => {
        setMessages([]);
    };

    const handleClose = () => {
        clearMessages();
        onClose();
    };

    const handleKeyDown = (
        e: React.KeyboardEvent<HTMLTextAreaElement>,
    ) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    const quickActions = [
        {
            icon: PenLine,
            label: '续写',
            prompt: '请继续写下去',
        },
        {
            icon: RefreshCw,
            label: '改写',
            prompt: '请帮我改写这段内容，使其更加流畅',
        },
        {
            icon: FileText,
            label: '总结',
            prompt: '请总结这段内容的核心要点',
        },
        {
            icon: CheckCheck,
            label: '检查',
            prompt: '请检查这段内容的语法和表达',
        },
    ];

    const handleQuickAction = (prompt: string) => {
        const selectedText = getSelectedText();
        const fullInput = selectedText
            ? `${prompt}：\n\n${selectedText}`
            : `基于当前编辑器内容，${prompt}`;
        setInput(fullInput);
        textareaRef.current?.focus();
    };

    if (!isVisible) return null;

    const rounds = messages.filter(
        (m) => m.role === 'user',
    ).length;

    if (isMinimized) {
        return (
            <div className="fixed bottom-4 right-4 w-80 h-14 bg-card border rounded-lg z-50 flex items-center justify-between px-4 transition-all duration-300">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    <span className="text-sm font-medium">
                        AI写作助手
                    </span>
                    {rounds > 0 && (
                        <span className="text-xs text-muted-foreground">
                            ({rounds}轮)
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setIsMinimized(false)}
                    >
                        <Maximize2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-400 hover:text-red-300"
                        onClick={handleClose}
                    >
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 w-[480px] h-[640px] bg-card border rounded-lg z-50 flex flex-col transition-all duration-300">
            {/* 标题栏 */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    <span className="text-sm font-medium">
                        AI写作助手
                    </span>
                    {rounds > 0 && (
                        <span className="text-xs text-muted-foreground">
                            ({rounds}轮)
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {messages.length > 0 && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={clearMessages}
                            title="清空对话"
                        >
                            <RotateCw className="h-3.5 w-3.5" />
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setIsMinimized(true)}
                        title="最小化"
                    >
                        <Minimize2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-400 hover:text-red-300"
                        onClick={handleClose}
                        title="关闭"
                    >
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* 对话区域 */}
            <ScrollArea className="flex-1 px-4 py-3">
                <div ref={scrollRef}>
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
                            <p className="text-sm font-medium text-muted-foreground mb-1">
                                开始与AI对话
                            </p>
                            <p className="text-xs text-muted-foreground/60 mb-6">
                                输入提示词或使用快捷操作
                            </p>
                            <div className="grid grid-cols-2 gap-2 w-full max-w-[280px]">
                                {quickActions.map((action) => (
                                    <Button
                                        key={action.label}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-9 text-xs"
                                        onClick={() =>
                                            handleQuickAction(
                                                action.prompt,
                                            )
                                        }
                                    >
                                        <action.icon className="h-3.5 w-3.5 mr-1.5" />
                                        {action.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {messages.map((msg, i) => (
                                <div key={i}>
                                    {msg.role === 'user' ? (
                                        <div className="flex justify-end">
                                            <div className="max-w-[85%] px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm whitespace-pre-wrap">
                                                {msg.content}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-start">
                                            <div className="max-w-[85%]">
                                                <div className="px-3 py-2 rounded-lg bg-card border text-sm whitespace-pre-wrap">
                                                    {msg.content}
                                                </div>
                                                <div className="flex gap-1 mt-1">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 text-xs px-2"
                                                        onClick={() =>
                                                            handleInsert(
                                                                msg.content,
                                                                'cursor',
                                                            )
                                                        }
                                                    >
                                                        <MousePointer className="h-3 w-3 mr-1" />
                                                        插入光标处
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 text-xs px-2"
                                                        onClick={() =>
                                                            handleInsert(
                                                                msg.content,
                                                                'replace',
                                                            )
                                                        }
                                                    >
                                                        <Replace className="h-3 w-3 mr-1" />
                                                        替换选中
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {loading && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    AI 正在思考...
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* 输入区域 */}
            <div className="px-4 py-3 border-t space-y-2">
                <div className="flex gap-2">
                    <Textarea
                        ref={textareaRef}
                        placeholder="输入提示词...（Enter发送，Shift+Enter换行）"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="min-h-[60px] max-h-[120px] text-sm resize-none"
                        disabled={loading}
                    />
                    <Button
                        type="button"
                        size="icon"
                        className="h-[60px] w-10 bg-purple-600 hover:bg-purple-500 flex-shrink-0"
                        disabled={!input.trim() || loading}
                        onClick={() => sendMessage(input)}
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>

                {/* 模型选择器 */}
                <Select
                    value={selectedModel}
                    onValueChange={setSelectedModel}
                >
                    <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="选择模型" />
                    </SelectTrigger>
                    <SelectContent>
                        {models.map((model) => (
                            <SelectItem
                                key={model.name}
                                value={model.name}
                            >
                                <span className="flex items-center gap-1.5">
                                    {model.displayName}
                                    {model.isFree && (
                                        <span className="text-[10px] text-green-500 font-medium">
                                            [免费]
                                        </span>
                                    )}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
