'use client';

// AIAssistant/AIAssistant.tsx
import React, { useState } from 'react';
import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { FloatingAIPanel } from './FloatingAIPanel';

interface AIAssistantProps {
    editor: Editor;
}

export function AIAssistant({
    editor,
}: AIAssistantProps) {
    const [isPanelVisible, setIsPanelVisible] =
        useState(false);

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                    setIsPanelVisible(true)
                }
            >
                <Sparkles
                    className="h-4 w-4 mr-1"
                />
                AI助手
            </Button>
            <FloatingAIPanel
                editor={editor}
                isVisible={isPanelVisible}
                onClose={() =>
                    setIsPanelVisible(false)
                }
            />
        </>
    );
}
