// components/shared/RichTextEditor/config/simpleExtensions.ts
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { VideoEmbed } from '../extensions/VideoEmbed';
import { Video } from '../extensions/Video';

export function getSimpleExtensions(
    placeholder: string
) {
    return [
        // StarterKit v3 已包含 Link、Underline
        StarterKit.configure({
            heading: {
                levels: [2, 3],
            },
            link: {
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-primary underline'
                        + ' hover:opacity-80',
                },
            },
        }),
        Image.configure({
            HTMLAttributes: {
                class: 'rounded-lg max-w-full h-auto',
            },
        }),
        VideoEmbed,
        Video,
        Placeholder.configure({ placeholder }),
        CharacterCount.configure({ limit: null }),
    ];
}
