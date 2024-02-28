import React, { useCallback, useEffect, useRef, useState } from 'react';

import Image from 'next/image';

import MarkdownIt from 'markdown-it';

import MdHighlight from 'markdown-it-highlightjs';

// @ts-ignore
import MdKatex from 'markdown-it-katex';

import Highlightjs from 'highlight.js';
import regex from 'highlight.js/lib/languages/ini';

// styles
import 'highlight.js/styles/atom-one-dark.css';
import 'katex/dist/katex.min.css';

import { ERole } from '../../../interface';

import styles from './index.module.scss';
import globalStyles from '../../../styles/Home.module.scss';
import { set } from 'lodash';

Highlightjs.registerLanguage('regex', regex);

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
                        updateEditedMessageId(id);
                        updateEditedMessage(tempMessage);
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
    editedUserMessageId?: string;
    updateEditedUserMessageId?: (id: string) => void;
    editedUserMessage?: string;
    updateEditedUserMessage?: (msg: string) => void;
}> = ({ id, role, message, avatar, editedUserMessageId, updateEditedUserMessageId, editedUserMessage, updateEditedUserMessage }) => {
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

    const htmlString = () => {
        // TODO: in equations x^2 may be rendered as x_2
        // x_2 -> x__2
        // plain text also wrong
        const md = MarkdownIt()
            .use(MdHighlight, {
                hljs: Highlightjs,
            })
            .use(MdKatex);
        const fence = md.renderer.rules.fence;
        if (!fence) return '';
        md.renderer.rules.fence = (...args) => {
            const [tokens, idx] = args;
            const token = tokens[idx];
            const rawCode = fence(...args);
            return `<div class='highlight-js-pre-container'>
        <div id class="copy" data-code=${encodeURIComponent(token.content)}>
        <i class="fa fa-clipboard" aria-hidden="true"></i>
        </div>
        ${rawCode}
        </div>`;
        };
        return md.render(message || '');
    };

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
                        <div className={styles.content}>{message}</div>
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
                                __html: htmlString(),
                            }}
                        ></div>
                    )}
                    <div className={styles.placeholder}></div>
                </>
            )}
        </div>
    );
};

export default React.memo(MessageItem);
