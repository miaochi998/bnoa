// extensions/Video.ts
import { Node, mergeAttributes } from '@tiptap/core';

export interface VideoOptions {
    HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        video: {
            setVideo: (options: { src: string }) => ReturnType;
        };
    }
}

export const Video = Node.create<VideoOptions>({
    name: 'video',
    group: 'block',
    atom: true,
    draggable: true,

    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },

    addAttributes() {
        return {
            src: { default: null },
        };
    },

    parseHTML() {
        return [
            { tag: 'video[src]' },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'video',
            mergeAttributes(
                this.options.HTMLAttributes,
                HTMLAttributes,
                {
                    controls: 'true',
                    class: 'rounded-lg max-w-full',
                    style: 'max-width:100%;margin:0.5rem 0;',
                },
            ),
        ];
    },

    addCommands() {
        return {
            setVideo:
                (options) =>
                ({ commands }) => {
                    return commands.insertContent({
                        type: this.name,
                        attrs: options,
                    });
                },
        };
    },
});
