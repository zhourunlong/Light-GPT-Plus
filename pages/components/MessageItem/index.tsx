import React, { useCallback, useEffect, useRef, useState } from 'react';

import Image from 'next/image';

import Highlightjs from 'highlight.js';
import regex from 'highlight.js/lib/languages/ini';

import { ERole } from '../../../interface';

import styles from './index.module.scss';
import globalStyles from '../../../styles/Home.module.scss';

import MarkdownIt from 'markdown-it';
import MdHighlight from 'markdown-it-highlightjs';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/atom-one-dark.css';

Highlightjs.registerLanguage('regex', regex);

function normalizeMathDelimiters(input: string) {
    if (!input) return '';

    const codeFenceSplitRegex = /(```[\s\S]*?```)/g;
    const displayRegex = /\\\[([\s\S]*?)\\\]/g;
    const inlineRegex = /\\\(([\s\S]*?)\\\)/g;

    return input
        .split(codeFenceSplitRegex)
        .map((segment, index) => {
            // Preserve fenced code blocks exactly as written
            if (index % 2 === 1) return segment;

            const displayNormalized = segment.replace(
                displayRegex,
                (_, content: string) => `\n$$\n${content.trim()}\n$$\n`
            );

            return displayNormalized.replace(
                inlineRegex,
                (_, content: string) => `$${content.trim()}$`
            );
        })
        .join('');
}

/**
 * Custom KaTeX renderer to reliably handle inline ($...$, \\(\\)) and
 * display ($$...$$, \\[\\]) math, including multi-line blocks.
 */
function attachMathRenderer(md: MarkdownIt) {
    const isEscaped = (src: string, pos: number) => {
        let backslashCount = 0;
        for (let i = pos - 1; i >= 0 && src[i] === '\\'; i--) backslashCount++;
        return backslashCount % 2 === 1;
    };

    const inlineRule = (state: any, silent: boolean) => {
        const start = state.pos;
        if (state.src[start] !== '$') return false;
        // Skip block $$ sequences
        if (state.src[start + 1] === '$') return false;

        let match = start + 1;
        while ((match = state.src.indexOf('$', match)) !== -1) {
            if (isEscaped(state.src, match)) {
                match++;
                continue;
            }
            const content = state.src.slice(start + 1, match);
            if (!content.trim()) {
                match++;
                continue;
            }
            if (!silent) {
                const token = state.push('math_inline', 'math', 0);
                token.content = content.trim();
            }
            state.pos = match + 1;
            return true;
        }
        return false;
    };

    const blockRule = (state: any, startLine: number, endLine: number, silent: boolean) => {
        const startPos = state.bMarks[startLine] + state.tShift[startLine];
        const maxPos = state.eMarks[startLine];
        const line = state.src.slice(startPos, maxPos);
        if (!line.startsWith('$$')) return false;

        // Single-line $$...$$
        if (line.slice(2).includes('$$')) {
            const closeIndex = line.indexOf('$$', 2);
            const content = line.slice(2, closeIndex).trim();
            if (!silent) {
                const token = state.push('math_block', 'math', 0);
                token.block = true;
                token.content = content;
                token.map = [startLine, startLine + 1];
                token.markup = '$$';
            }
            state.line = startLine + 1;
            return true;
        }

        // Multi-line: search for closing $$
        let nextLine = startLine;
        let found = false;
        while (++nextLine < endLine) {
            const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
            const lineEnd = state.eMarks[nextLine];
            const text = state.src.slice(lineStart, lineEnd);
            if (text.startsWith('$$')) {
                found = true;
                const firstLine = state.src.slice(startPos + 2, maxPos);
                const middle = state.getLines(startLine + 1, nextLine, state.tShift[startLine], true);
                const lastLine = text.slice(2);
                const content = [firstLine, middle, lastLine].join('\n').trim();

                if (!silent) {
                    const token = state.push('math_block', 'math', 0);
                    token.block = true;
                    token.content = content;
                    token.map = [startLine, nextLine + 1];
                    token.markup = '$$';
                }
                state.line = nextLine + 1;
                return true;
            }
        }

        return found;
    };

    md.inline.ruler.after('escape', 'math_inline', inlineRule);
    md.block.ruler.after('blockquote', 'math_block', blockRule, {
        alt: ['paragraph', 'reference', 'blockquote', 'list'],
    });

    const cleanMath = (content: string) => content.replace(/\\\*/g, '*');

    md.renderer.rules.math_inline = (tokens, idx) =>
        katex.renderToString(cleanMath(tokens[idx].content), {
            throwOnError: false,
        });

    md.renderer.rules.math_block = (tokens, idx) =>
        katex.renderToString(cleanMath(tokens[idx].content), {
            throwOnError: false,
            displayMode: true,
        });
}

const markdownRenderer = (() => {
    const md = MarkdownIt()
        .use(MdHighlight, {
            hljs: Highlightjs,
        });

    attachMathRenderer(md);

    const originalFence = md.renderer.rules.fence;
    md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        const rawCode = originalFence
            ? originalFence(tokens, idx, options, env, self)
            : self.renderToken(tokens, idx, options);
        return `<div class='highlight-js-pre-container'>
    <button class="copy" type="button" data-code="${encodeURIComponent(token.content)}">
        <i class="fa fa-clipboard" aria-hidden="true"></i>
    </button>
    ${rawCode}
    </div>`;
    };

    md.renderer.rules.code_inline = (tokens, idx) => {
        const token = tokens[idx];
        return `<code class="${styles.inlineCode}">${md.utils.escapeHtml(token.content)}</code>`;
    };

    return md;
})();

export function renderMarkdown(message: string) {
    const normalizedMessage = normalizeMathDelimiters(message);
    return markdownRenderer.render(normalizedMessage || '');
};

// Helpful smoke cases for quick manual verification
export const mathRenderSmokeTests = [
    '\\\\[\\\\max_{\\\\text{policy}} \\\\ \\\\inf_{\\\\substack{T\\\\ge 0\\\\\\\\ \\\\mathbb{E}[T]=\\\\mu}} \\\\Pr(\\\\text{finish by }N).\\\\]',
    'Pick \\\\(m^*\\\\) that maximizes it, and use \\\\(m^*\\\\) equal slices',
    'Choose \\\\(m^*=\\\\arg\\\\max g(m).\\\\)',
];


const MessageEditor: React.FC<{
    id: string;
    editingMessage: boolean;
    updateEditingMessage: (editing: boolean) => void;
    tempMessage: string;
    updateTempMessage: (msg: string) => void;
    editedMessageId?: string;
    updateEditedMessageId?: (id: string) => void;
    editedMessage?: string;
    updateEditedMessage?: (msg: string) => void;
}> = ({ id, editingMessage, updateEditingMessage, tempMessage, updateTempMessage, editedMessageId, updateEditedMessageId, editedMessage, updateEditedMessage }) => {
    const editMessageRef = useRef<HTMLTextAreaElement | null>(null);

    // Function to adjust the textarea height
    const adjustHeight = () => {
        const textarea = editMessageRef.current;
        if (textarea) {
            textarea.style.height = 'auto'; // Reset the height to ensure accurate scrollHeight measurement
            textarea.style.height = `${textarea.scrollHeight+2}px`;
        }
    };

    // Adjust the height on mount and whenever tempMessage changes
    useEffect(() => {
        adjustHeight();
    }, [tempMessage]);

    return (
        <div className={styles.userMainContent}>
            <textarea
                className={styles.content}
                value={tempMessage}
                rows={1}
                onChange={(e) => {
                    updateTempMessage(e.target.value);
                    adjustHeight();
                }}
                ref={editMessageRef}
                style={{ boxSizing: 'border-box' }}
            />
            <div className={globalStyles.buttonContainer}>
                <button className={globalStyles.saveButton} 
                    onClick={() => {
                        updateEditedMessageId?.(id);
                        updateEditedMessage?.(tempMessage);
                        updateEditingMessage(false);
                    }}
                >
                    Save & Submit
                </button>
                <button className={globalStyles.cancelButton} 
                    onClick={() => {updateEditingMessage(false);}}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

const MessageItem: React.FC<{
    id: string;
    role: ERole;
    message: string;
    avatar: string;
    summary?: string;
    editedUserMessageId?: string;
    updateEditedUserMessageId?: (id: string) => void;
    editedUserMessage?: string;
    updateEditedUserMessage?: (msg: string) => void;
}> = ({ id, role, message, avatar, summary, editedUserMessageId, updateEditedUserMessageId, editedUserMessage, updateEditedUserMessage }) => {
    const isImgResponse = message?.startsWith(
        'https://oaidalleapiprodscus.blob.core.windows.net/private'
    );

    const currentMessageEle = useRef<HTMLDivElement | null>(null);

    const [editingMessage, setEditingMessage] = useState(false);
    const updateEditingMessage = useCallback((editing: boolean) => {
        setEditingMessage(editing);
    }, []);

    const [tempMessage, setTempMessage] = useState('');
    const updateTempMessage = useCallback((msg: string) => {
        setTempMessage(msg);
    }, []);

    useEffect(() => {
        if (!currentMessageEle.current) return;
        const faClipboardIList =
            currentMessageEle.current.querySelectorAll('.copy');
        if (faClipboardIList.length === 0) return;
        const clickHandler = (e: Event) => {
            e.stopPropagation();
            const el = e.currentTarget as HTMLElement;
            let code = '';

            code = decodeURIComponent(el.dataset.code || '');
            // 创建一个新的ClipboardItem对象
            navigator.clipboard
                .writeText(code)
                .catch((err) => {
                    // console.error('写入剪贴板失败：', err)
                });
        };
        faClipboardIList.forEach((item) => {
            if (!item) return;
            item.addEventListener('click', clickHandler);
        });
        return () => {
            faClipboardIList.forEach((item) => {
                if (!item) return;
                item.removeEventListener('click', clickHandler);
            });
        };
    }, []);

    return (
        <div
            className={styles.message}
            ref={(ele) => (currentMessageEle.current = ele)}
        >
            {role === ERole.user ? (
                <>
                    <div className={styles.placeholder}></div>

                    <div
                        className={`fa-solid fa-pencil ${styles.editMessage}`}
                        onClick={() => {
                            setEditingMessage(true);
                            setTempMessage(message);
                        }}
                    ></div>

                    {editingMessage ?
                        <MessageEditor
                            id={id}
                            editingMessage={editingMessage}
                            updateEditingMessage={updateEditingMessage}
                            tempMessage={tempMessage}
                            updateTempMessage={updateTempMessage}
                            editedMessageId={editedUserMessageId}
                            updateEditedMessageId={updateEditedUserMessageId}
                            editedMessage={editedUserMessage}
                            updateEditedMessage={updateEditedUserMessage}
                        /> : (
                        <div className={styles.content}>{message}&nbsp;</div>
                    )}
                    
                        
                    <div className={`${styles.user} ${styles.avatar}`}>
                        <Image
                            className={styles.img}
                            width={40}
                            height={40}
                            src={avatar}
                            alt="user"
                        />
                    </div>
                </>
            ) : (
                <>
                    <div className={`${styles.assistant} ${styles.avatar}`}>
                        <Image
                            className={styles.img}
                            width={40}
                            height={40}
                            src={avatar}
                            alt="robot"
                        />
                    </div>
                    <div className={styles.assistantMain}>
                        {summary && (
                            <div className={styles.summaryBox}>
                                <div className={styles.summaryLabel}>Reasoning</div>
                                <div
                                    className={styles.summaryText}
                                    dangerouslySetInnerHTML={{
                                        __html: renderMarkdown(summary),
                                    }}
                                ></div>
                            </div>
                        )}
                        {isImgResponse ? (
                            <div className={styles.imgContent}>
                                <Image
                                    className={styles.dellImage}
                                    width={1024}
                                    height={1024}
                                    src={message}
                                    alt="generateImgWithText"
                                    loading="lazy"
                                />
                            </div>
                        ) : (
                            <div
                                className={styles.htmlContent}
                                dangerouslySetInnerHTML={{
                                    __html: renderMarkdown(message)
                                }}
                            ></div>
                        )}
                    </div>
                    <div className={styles.placeholder}></div>
                </>
            )}
        </div>
    );
};

export default React.memo(MessageItem);
