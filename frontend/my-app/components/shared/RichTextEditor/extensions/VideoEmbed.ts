// extensions/VideoEmbed.ts
import { Node, mergeAttributes } from '@tiptap/core';

export interface VideoEmbedOptions {
    inline: boolean;
    HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        videoEmbed: {
            setVideoEmbed: (options: {
                src: string;
                width?: number;
                height?: number;
                platform?: string;
            }) => ReturnType;
        };
    }
}

export const VideoEmbed = Node.create<VideoEmbedOptions>({
    name: 'videoEmbed',
    group: 'block',
    atom: true,
    draggable: true,

    addOptions() {
        return {
            inline: false,
            HTMLAttributes: {},
        };
    },

    addAttributes() {
        return {
            src: { default: null },
            width: { default: 640 },
            height: { default: 480 },
            platform: { default: 'iframe' },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-video-embed] iframe',
                getAttrs: (dom: HTMLElement) => {
                    const iframe = dom as HTMLIFrameElement;
                    const container = iframe.parentElement;
                    return {
                        src: iframe.getAttribute('src'),
                        width: iframe.getAttribute('width')
                            || 640,
                        height: iframe.getAttribute('height')
                            || 480,
                        platform:
                            container?.getAttribute(
                                'data-platform'
                            ) || 'iframe',
                    };
                },
            },
        ];
    },

    renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, any> }) {
        const ratio =
            (HTMLAttributes.height / HTMLAttributes.width)
            * 100;
        return [
            'div',
            {
                'data-video-embed': '',
                'data-platform': HTMLAttributes.platform,
                class: 'video-embed-wrapper',
                style: `position:relative;width:100%;`
                    + `max-width:${HTMLAttributes.width}px;`
                    + `margin:1rem auto;`,
            },
            [
                'div',
                {
                    style: `position:relative;`
                        + `padding-bottom:${ratio}%;`
                        + `height:0;overflow:hidden;`,
                },
                [
                    'iframe',
                    mergeAttributes(
                        this.options.HTMLAttributes,
                        {
                            src: HTMLAttributes.src,
                            width: HTMLAttributes.width,
                            height: HTMLAttributes.height,
                            frameborder: '0',
                            allowfullscreen: 'true',
                            allow: 'accelerometer; autoplay;'
                                + ' clipboard-write;'
                                + ' encrypted-media;'
                                + ' gyroscope;'
                                + ' picture-in-picture',
                            style: 'position:absolute;top:0;'
                                + 'left:0;width:100%;'
                                + 'height:100%;',
                        }
                    ),
                ],
            ],
        ];
    },

    addCommands() {
        return {
            setVideoEmbed:
                (options: { src: string; width?: number; height?: number; platform?: string }) =>
                ({ commands }: { commands: any }) => {
                    return commands.insertContent({
                        type: this.name,
                        attrs: options,
                    });
                },
        };
    },
});
