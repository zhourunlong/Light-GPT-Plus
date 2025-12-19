import { useCallback, useEffect, useRef, useState } from 'react';

import Link from 'next/link';

import { set, throttle } from 'lodash';

import { useTranslation } from 'react-i18next';

import { v4 as uuid } from 'uuid';

import '@fortawesome/fontawesome-free/css/all.min.css';

import styles from '@/styles/Home.module.scss';

import IndexHeader from './components/IndexHeader';

import HeadMetaSetup from './components/HeadMetaSetup';

import MessageItem from './components/MessageItem';

import HistoryTopicList from './components/HistoryTopicList';

import { Theme, SystemSettingMenu, ERole, IMessage } from '../interface';

import { ChatService } from '../DBClient';

import { createParser } from 'eventsource-parser';
import OpenAI from 'openai';

import {
    PORT,
    ThemeLocalKey,
    APIKeyLocalKey,
    encrypt,
    decrypt,
    ChatSystemMessage,
    SummarizePrompt,
} from '../utils';

const chatDB = new ChatService();

const getContentText = (content: any): string => {
    if (!content) {
        return '';
    }
    if (typeof content === 'string') {
        return content;
    }
    if (typeof content.text === 'string') {
        return content.text;
    }
    if (Array.isArray(content.parts)) {
        return content.parts.join('');
    }
    return '';
};

const extractResponseText = (payload: any): string => {
    if (!payload) {
        return '';
    }
    if (typeof payload.output_text === 'string') {
        return payload.output_text;
    }
    const pieces: string[] = [];
    for (const output of payload.output ?? []) {
        for (const content of output.content ?? []) {
            const text = getContentText(content);
            if (text) {
                pieces.push(text);
            }
        }
    }
    return pieces.join('');
};

const extractReasoningSummary = (payload: any): string => {
    if (!payload) {
        return '';
    }

    const summaries: string[] = [];
    const collectText = (entry: any) => {
        if (!entry) return;
        if (typeof entry === 'string') {
            summaries.push(entry);
        } else if (typeof entry.text === 'string') {
            summaries.push(entry.text);
        }
    };

    const collectArray = (maybeArray: any) => {
        if (Array.isArray(maybeArray)) {
            maybeArray.forEach(collectText);
        }
    };

    collectArray(payload.summary);
    collectArray(payload.reasoning?.summary);
    collectArray(payload.response?.reasoning?.summary);

    const outputs = payload.output ?? payload.response?.output ?? [];
    if (Array.isArray(outputs)) {
        for (const output of outputs) {
            collectArray(output?.summary);
            collectArray(output?.reasoning?.summary);
        }
    }

    const uniqueSummaries = Array.from(
        new Set(
            summaries
                .map((text) => text?.trim())
                .filter((text) => !!text)
        )
    );

    return uniqueSummaries.join('\n\n');
};

const parseResponsesStream = async (
    response: Response | AsyncIterable<any>,
    appendChunk: (chunk: string) => void,
    onSummaryUpdate?: (summary: string) => void
): Promise<{ finalText: string; summaryText: string }> => {
    let finalText = '';
    let streamedText = '';
    let summaryText = '';
    let summaryTextBuffer = '';

    const isAsyncIterable = (value: any): value is AsyncIterable<any> =>
        !!value && typeof value[Symbol.asyncIterator] === 'function';

    const handleEvent = (data: any) => {
        if (!data) return;

        if (data.error || data.type === 'response.error') {
            throw new Error(data.error?.message || data.message || 'Responses stream error');
        }

        if (data.type === 'response.output_text.delta') {
            const deltaText =
                typeof data.delta === 'string' ? data.delta : getContentText(data.delta);
            if (deltaText) {
                streamedText += deltaText;
                appendChunk(deltaText);
            }
            return;
        }

        if (data.type === 'response.output_text.done') {
            if (typeof data.output_text === 'string') {
                streamedText = data.output_text;
            }
            return;
        }

        if (data.type === 'response.reasoning_summary_text.delta') {
            if (typeof data.delta === 'string') {
                summaryTextBuffer += data.delta;
                summaryText = summaryTextBuffer;
                onSummaryUpdate?.(summaryText);
            }
            return;
        }

        const maybeSummary = extractReasoningSummary(data.response ?? data);
        if (maybeSummary && maybeSummary !== summaryText) {
            summaryText = maybeSummary;
            onSummaryUpdate?.(summaryText);
        }

        const contentChunks =
            data.delta?.content ??
            data.choices?.[0]?.delta?.content ??
            data.response?.output?.[0]?.content ??
            [];

        if (Array.isArray(contentChunks)) {
            for (const content of contentChunks) {
                const text = getContentText(content);
                if (text) {
                    streamedText += text;
                    appendChunk(text);
                }
            }
        }

        if (data.type === 'response.completed') {
            finalText = extractResponseText(data.response ?? data) || streamedText;
            const finalSummary = extractReasoningSummary(data.response ?? data);
            if (finalSummary) {
                summaryText = finalSummary;
                onSummaryUpdate?.(summaryText);
            }
        }
    };

    if (isAsyncIterable(response)) {
        for await (const event of response as AsyncIterable<any>) {
            handleEvent(event);
        }
    } else {
        if (!response.body) {
            throw new Error('Responses stream missing body');
        }

        const decoder = new TextDecoder();
        const parser = createParser((event) => {
            if (event.type !== 'event') {
                return;
            }
            if (event.data === '[DONE]') {
                return;
            }
            handleEvent(JSON.parse(event.data));
        });

        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            parser.feed(decoder.decode(value));
        }
    }

    return {
        finalText: finalText || streamedText,
        summaryText: summaryText || summaryTextBuffer,
    };
};

export default function Home() {
    const windowState = useRef({
        windowHeight: 0,
        virtualKeyboardVisible: false,
        isUsingComposition: false,
    });

    useEffect(() => {
        const handleWindowResize = () => {
            console.log('resize event--');
            windowState.current.windowHeight = window.innerHeight;
            windowState.current.virtualKeyboardVisible =
                window.innerHeight < windowState.current.windowHeight;
        };

        handleWindowResize();
        window.addEventListener('resize', handleWindowResize);
        return () => {
            window.removeEventListener('resize', handleWindowResize);
        };
    }, []);

    const [theme, setTheme] = useState<Theme>('light');
    const updateTheme = useCallback((theme: Theme) => {
        setTheme(theme);
    }, []);

    const [maskVisible, setMaskVisible] = useState(false);
    const showMask = useCallback(() => {
        setMaskVisible(true);
    }, []);
    const hideMask = useCallback(() => {
        setMaskVisible(false);
    }, []);

    const [activeSystemMenu, setActiveSystemMenu] = useState<
        SystemSettingMenu | ''
    >('');

    const [tempApiKeyValue, setTempApiKeyValue] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [encryptedApiKey, setEncryptedApiKey] = useState('');

    const [lastTimeStamp, setLastTimeStamp] = useState(0);

    const chatHistoryEle = useRef<HTMLDivElement | null>(null);

    function newSystemMessageItem(systemMessage: string): IMessage {
        return {
            role: ERole.system,
            content: systemMessage,
            summary: '',
            id: uuid(),
            createdAt: Date.now(),
        };
    }

    function newUserMessageItem(userMessage: string): IMessage {
        return {
            role: ERole.user,
            content: userMessage,
            summary: '',
            id: uuid(),
            createdAt: Date.now(),
        };
    }

    function newAssistantMessageItem(assistantMessage: string, summary = ''): IMessage {
        return {
            role: ERole.assistant,
            content: assistantMessage,
            summary,
            id: uuid(),
            createdAt: Date.now(),
        };
    }

    const archiveCurrentAssistantMessage = (
        newCurrentAssistantMessage: string,
        summary = ''
    ) => {
        if (newCurrentAssistantMessage) {
            const assistantMessageItem = newAssistantMessageItem(
                newCurrentAssistantMessage,
                summary
            );
            setMessageList((list) => list.concat([assistantMessageItem]));
            if (activeTopicId) {
                chatDB.addConversation({
                    topicId: activeTopicId,
                    ...assistantMessageItem,
                });
            }
            setLoadingTopicId('');
            setCurrentAssistantMessage('');
            setCurrentAssistantSummary('');
            scrollSmoothThrottle();
        }
    };

    const [messageList, setMessageList] = useState<IMessage[]>([]);

    const removeMessageById = useCallback(async (id: string) => {
        await chatDB.deleteConversationById(id);
        setMessageList((list) => list.filter((item) => item.id !== id));
    }, []);

    const updateCurrentMessageList = useCallback((messages: IMessage[]) => {
        setMessageList(messages);
    }, []);

    const userPromptRef = useRef<HTMLTextAreaElement | null>(null);

    const [currentAssistantMessage, setCurrentAssistantMessage] = useState('');
    const [currentAssistantSummary, setCurrentAssistantSummary] = useState('');
    const tempCurrentAssistantMessageId = useRef(uuid());

    const [editedUserMessageId, setEditedUserMessageId] = useState('');
    const updateEditedUserMessageId = useCallback((id: string) => {
        setEditedUserMessageId(id);
    }, []);

    const [editedUserMessage, setEditedUserMessage] = useState('');
    const updateEditedUserMessage = useCallback((message: string) => {
        setEditedUserMessage(message);
    }, []);

    useEffect(() => {
        if (editedUserMessage !== '') {
            chatGPTWithLatestUserPrompt(true);
            setEditedUserMessage('');
        }
    }, [editedUserMessage]);

    const [loadingTopicId, setLoadingTopicId] = useState('');

    const scrollSmoothThrottle = throttle(
        () => {
            if (!chatHistoryEle.current) return;
            chatHistoryEle.current.scrollTo({
                top: chatHistoryEle.current.scrollHeight,
                behavior: 'smooth',
            });
        },
        300,
        {
            leading: true,
            trailing: false,
        }
    );

    const [serviceErrorMessage, setServiceErrorMessage] = useState('');

    const apiRequestRateLimit = useRef({
        maxRequestsPerMinute: 10,
        requestsThisMinute: 0,
        lastRequestTime: 0,
    });

    const [selectedModel, setSelectedModel] = useState('gpt-5.2'); // Default model
   
    const chatGPTWithLatestUserPrompt = async (isRegenerate = false) => {
        const openai = new OpenAI({
            baseURL: `${window.location.origin}/api/openai`,
            apiKey: apiKey,
            dangerouslyAllowBrowser: true,
        }) as OpenAI & {
            responses: {
                create: (body: any) => Promise<any>;
            };
        };

        // minimal responses client matching the example signature
        openai.responses = {
            create: async (body: any) => {
                const res = await fetch(`${window.location.origin}/api/openai/responses`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify(body),
                });

                if (body?.stream) {
                    if (!res.ok) {
                        const errText = await res.text();
                        throw new Error(errText || 'Responses stream failed');
                    }
                    return res;
                }

                const json = await res.json();
                if (!res.ok) {
                    const errMessage = json?.error?.message || 'Responses request failed';
                    throw new Error(errMessage);
                }
                return json;
            },
        };

        // api request rate limit
        const now = Date.now();
        if (now - apiRequestRateLimit.current.lastRequestTime >= 60000) {
            apiRequestRateLimit.current.requestsThisMinute = 0;
            apiRequestRateLimit.current.lastRequestTime = 0;
        }
        if (
            apiRequestRateLimit.current.requestsThisMinute >=
            apiRequestRateLimit.current.maxRequestsPerMinute
        ) {
            setServiceErrorMessage('API requests too frequent, try again later!');
            return;
        }

        if (!apiKey) {
            setServiceErrorMessage('Please set API key.');
            setActiveSystemMenu(SystemSettingMenu.apiKeySettings);
            return;
        }

        // 先把用户输入信息展示到对话列表
        const currentUserMessage = userPromptRef.current?.value || '';
        if (!isRegenerate && !currentUserMessage) {
            setServiceErrorMessage('Please enter your message.');
            return;
        }

        let newMessageList = messageList.concat([]);
        if (isRegenerate) {
            if (editedUserMessage !== '') {
                let idsToDelete = [];
                for (let i = messageList.length - 1; i >= 0; i--) {
                    idsToDelete.push(messageList[i].id);
                    if (messageList[i].id === editedUserMessageId) {
                        break;
                    }
                }
                for (const id of idsToDelete) {
                    removeMessageById(id);
                }

                newMessageList = messageList.filter(message => !idsToDelete.includes(message.id));

                const userMessageItem = newUserMessageItem(editedUserMessage);
                newMessageList.push(userMessageItem);
                if (activeTopicId) {
                    await chatDB.addConversation({
                        topicId: activeTopicId,
                        ...userMessageItem,
                    });
                    setLastTimeStamp(userMessageItem.createdAt);
                }
            } else {
                let idsToDelete = [];
                for (let i = messageList.length - 1; i >= 0; i--) {
                    if (messageList[i].role === ERole.assistant) {
                        idsToDelete.push(messageList[i].id);
                    } else {
                        break;
                    }
                }
                for (const id of idsToDelete) {
                    removeMessageById(id);
                }

                newMessageList = messageList.filter(message => !idsToDelete.includes(message.id));
            }
        } else {
            // Add system message at the first step
            if (newMessageList.length === 0) {
                const systemMessageItem = newSystemMessageItem(ChatSystemMessage(selectedModel));
                newMessageList.push(systemMessageItem);
                if (activeTopicId) {
                    await chatDB.addConversation({
                        topicId: activeTopicId,
                        ...systemMessageItem,
                    });
                }
            }

            const userMessageItem = newUserMessageItem(currentUserMessage);
            newMessageList.push(userMessageItem);
            if (activeTopicId) {
                await chatDB.addConversation({
                    topicId: activeTopicId,
                    ...userMessageItem,
                });
                setLastTimeStamp(userMessageItem.createdAt);
            }
        }

        setMessageList(newMessageList);
        setCurrentAssistantSummary('');
        userPromptRef.current!.value = '';
        if (!userPromptRef.current) return;
        userPromptRef.current.style.height = 'auto';
        scrollSmoothThrottle();

        // get response
        try {
            setServiceErrorMessage('');
            setLoadingTopicId(activeTopicId);

            const streamedMessages = newMessageList.map((item) => ({
                role: item.role,
                content: item.content,
            }));

            const streamResponse = await openai.responses.create({
                model: selectedModel,
                reasoning: { effort: 'medium', summary: 'auto' },
                input: streamedMessages,
                stream: true,
            });

            let assistantResponse = '';
            let summaryText = '';
            const { finalText, summaryText: finalSummaryText } = await parseResponsesStream(
                streamResponse,
                (chunk) => {
                    assistantResponse += chunk;
                    setCurrentAssistantMessage(assistantResponse);
                },
                (summary) => {
                    summaryText = summary;
                    setCurrentAssistantSummary(summary);
                }
            );

            assistantResponse = finalText || assistantResponse;
            setCurrentAssistantMessage(assistantResponse);
            const reasoningSummary = finalSummaryText || summaryText;
            setCurrentAssistantSummary(reasoningSummary);
            archiveCurrentAssistantMessage(assistantResponse, reasoningSummary);

            apiRequestRateLimit.current.requestsThisMinute += 1;

            setLoadingTopicId('');
        } catch (error: any) {
            setLoadingTopicId('');
            setCurrentAssistantSummary('');

            setServiceErrorMessage(error?.message || 'Unknown Service Error');
        }
    };

    // Avatars
    const robotAvatar = '/assistant.jpeg';
    const userAvatar = '/user.jpeg';

    const [activeTopicId, setActiveTopicId] = useState('');
    const updateActiveTopicId = useCallback((id: string) => {
        setActiveTopicId(id);
    }, []);

    const [activeTopicName, setActiveTopicName] = useState('');
    const updateActiveTopicName = useCallback((name: string) => {
        setActiveTopicName(name);
    }, []);

    const firstUserMessageContentRef = useRef('');
    useEffect(() => {
        firstUserMessageContentRef.current = '';
    }, [activeTopicId]);

    const summarizeTopicFromFirstUserMessage = useCallback(
        async (firstUserMessage: IMessage) => {
            if (!apiKey || !activeTopicId) return;

            const summarizeModel = 'gpt-5-mini';
            const openai = new OpenAI({
                baseURL: `${window.location.origin}/api/openai`,
                apiKey: apiKey,
                dangerouslyAllowBrowser: true,
            }) as OpenAI & {
                responses: {
                    create: (body: any) => Promise<any>;
                };
            };

            openai.responses = {
                create: async (body: any) => {
                    const res = await fetch(`${window.location.origin}/api/openai/responses`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${apiKey}`,
                        },
                        body: JSON.stringify(body),
                    });

                    const json = await res.json();
                    if (!res.ok) {
                        const errMessage = json?.error?.message || 'Responses request failed';
                        throw new Error(errMessage);
                    }
                    return json;
                },
            };

            try {
                const summaryJson = await openai.responses.create({
                    model: summarizeModel,
                    reasoning: { effort: 'low' },
                    input: [
                        {
                            role: ERole.system,
                            content: ChatSystemMessage(summarizeModel),
                        },
                        {
                            role: firstUserMessage.role,
                            content:
                                SummarizePrompt +
                                firstUserMessage.content.slice(0, 300) +
                                '...',
                        },
                    ],
                });
                const tempTopicName = extractResponseText(summaryJson);

                if (tempTopicName !== '') {
                    updateActiveTopicName(tempTopicName);
                }
            } catch (err) {
                console.error('Failed to summarize topic', err);
            }
        },
        [apiKey, activeTopicId, updateActiveTopicName]
    );

    useEffect(() => {
        if (!activeTopicId) return;

        const firstUserMessage = messageList.find((item) => item.role === ERole.user);
        if (!firstUserMessage || !firstUserMessage.content) return;

        if (firstUserMessage.content === firstUserMessageContentRef.current) {
            return;
        }

        firstUserMessageContentRef.current = firstUserMessage.content;
        void summarizeTopicFromFirstUserMessage(firstUserMessage);
    }, [messageList, activeTopicId, summarizeTopicFromFirstUserMessage]);

    useEffect(() => {
        const light_gpt_theme =
            window.localStorage.getItem(ThemeLocalKey) || 'light';
        setTheme(light_gpt_theme as Theme);

        const light_gpt_api_key =
            window.localStorage.getItem(APIKeyLocalKey) || '';
        if (light_gpt_api_key !== '') {
            setEncryptedApiKey(light_gpt_api_key);
            const decryptedApiKey = decrypt(light_gpt_api_key);
            setApiKey(decryptedApiKey);
            setTempApiKeyValue(decryptedApiKey);
        }
    }, []);

    const [asideVisible, setAsideVisible] = useState(true);

    const toggleAsideVisible = useCallback(() => {
        setAsideVisible((visible) => !visible);
    }, []);

    const { t, i18n } = useTranslation();

    const SystemMenus = [
        {
            label: t('apiKeySettings'),
            iconName: 'fa-key',
            value: SystemSettingMenu.apiKeySettings,
        },
    ];

    return (
        <div id="app" className={styles.app} data-theme={theme}>
            <aside
                id="appAside"
                className={`${styles.aside} ${asideVisible && styles.show}`}
            >
                {/** 历史对话 */}
                <div className={styles.historyTopicListContainer}>
                    <HistoryTopicList
                        historyTopicListVisible={asideVisible}
                        encApiKey={encryptedApiKey}
                        updateCurrentMessageList={updateCurrentMessageList}
                        activeTopicId={activeTopicId}
                        updateActiveTopicId={updateActiveTopicId}
                        activeTopicName={activeTopicName}
                        updateActiveTopicName={updateActiveTopicName}
                        lastTimeStamp={lastTimeStamp}
                        showMask={showMask}
                        hideMask={hideMask}
                    />
                </div>

                <div className={styles.divider}></div>

                {/** 站点设置 */}
                <div className={styles.siteSettings}>
                    <div
                        className={styles.menu}
                        onClick={() => {
                            setTheme(theme === 'light' ? 'dark' : 'light');
                            window.localStorage.setItem(
                                ThemeLocalKey,
                                theme === 'light' ? 'dark' : 'light'
                            );
                        }}
                    >
                        {theme === 'light' ? (
                            <i className="fas fa-sun"></i>
                        ) : (
                            <i className="fas fa-moon"></i>
                        )}
                        <div>
                            {theme === 'dark'
                                ? t('changeLightMode')
                                : t('changeDarkMode')}
                        </div>
                    </div>
                    {SystemMenus.map((menu) => (
                        <div
                            key={menu.value}
                            className={styles.menu}
                            onClick={() => {
                                setActiveSystemMenu(menu.value);
                            }}
                        >
                            <i className={`fas ${menu.iconName}`}></i>
                            <div>{menu.label}</div>
                        </div>
                    ))}
                </div>
            </aside>

            <main className={styles.conversationContent}>
                {/** toggle aside button */}
                <div
                    className={`${styles.asideToggle} ${styles.asideShow
                    }`}
                    onClick={toggleAsideVisible}
                >
                    {asideVisible ? (
                        <i className="fas fa-chevron-left"></i>
                    ) : (
                        <i className="fas fa-chevron-right"></i>
                    )}
                </div>

                <HeadMetaSetup></HeadMetaSetup>

                <div className={styles.header}>
                    <IndexHeader
                        theme={theme}
                        updateTheme={updateTheme}
                        selectedModel={selectedModel}
                        setSelectedModel={setSelectedModel}
                    />
                </div>
                <div className={styles.main}>
                    {apiKey ? (
                        <div
                            id="chatHistory"
                            className={styles.chatHistory}
                            ref={(e) => (chatHistoryEle.current = e)}
                        >
                            {messageList
                                .filter((item) => item.role !== ERole.system)
                                .map((item) => (
                                    <MessageItem
                                        key={item.id}
                                        id={item.id}
                                        role={item.role}
                                        avatar={
                                            item.role === ERole.user
                                                ? userAvatar
                                                : robotAvatar
                                        }
                                        message={item.content}
                                        summary={item.summary}
                                        editedUserMessageId={editedUserMessageId}
                                        updateEditedUserMessageId={updateEditedUserMessageId}
                                        editedUserMessage={editedUserMessage}
                                        updateEditedUserMessage={updateEditedUserMessage}
                                    />
                                ))}
                            {currentAssistantMessage.length > 0 && activeTopicId === loadingTopicId && (
                                <MessageItem
                                    id={tempCurrentAssistantMessageId.current}
                                    role={ERole.assistant}
                                    avatar={robotAvatar}
                                    message={currentAssistantMessage}
                                    summary={currentAssistantSummary}
                                />
                            )}
                            <div className={styles.placeholder}>
                                <div className={styles.child}></div>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.apiKeyRequiredTip}>
                            <div className={styles.title}>
                                OpenAI API Key Required
                            </div>
                            <div className={styles.desc}>
                                {t('apiKeyRequiredTip')}
                            </div>
                        </div>
                    )}
                </div>
                <div className={styles.footer}>
                    {serviceErrorMessage !== '' && (
                        <div className={styles.openAiServiceError}>
                            {serviceErrorMessage}
                        </div>
                    )}

                    <div className={styles.action}></div>
                    <div className={styles.middle}>
                        <div className={styles.textareaContainer}>
                            <textarea
                                className={styles.userPrompt}
                                disabled={loadingTopicId !== ''}
                                onInput={() => {
                                    userPromptRef.current!.style.height = 'auto';

                                    if (userPromptRef.current) {
                                        userPromptRef.current.style.height = userPromptRef.current.scrollHeight + 2 + 'px';
                                    }

                                    scrollSmoothThrottle();
                                }}
                                ref={(e) => {
                                    userPromptRef.current = e;
                                }}
                                placeholder={`Message Light GPT Plus...`}
                                rows={1}
                                onCompositionStart={() => {
                                    windowState.current.isUsingComposition =
                                        true;
                                }}
                                onCompositionEnd={() => {
                                    windowState.current.isUsingComposition =
                                        false;
                                }}
                            />
                            <div className={styles.submit}>
                                {loadingTopicId ? (
                                    <div className={styles.spinner}></div>
                                ) : (
                                    <i
                                        className="fas fa-paper-plane"
                                        style={{ transform: 'scale(1.2)' }}
                                        onClick={() =>
                                            chatGPTWithLatestUserPrompt(
                                                false
                                            )
                                        }
                                    ></i>
                                )}
                            </div>
                        </div>
                        <div className={styles.siteDescription}>
                            <span>By Vector Zhou</span>
                        </div>
                    </div>
                    <div className={styles.action}>
                        <div
                            className={styles.button}
                            onClick={() => {
                                setEditedUserMessage("");
                                chatGPTWithLatestUserPrompt(true);
                            }}
                        >
                            Regenerate
                        </div>
                    </div>
                </div>
            </main>

            <div
                className={`${styles.modal} ${
                    !activeSystemMenu && styles.hide
                }`}
            >
                <div className={styles.modalContent}>
                    <i
                        className={`fas fa-times ${styles.closeIcon}`}
                        onClick={() => {
                            setActiveSystemMenu('');
                        }}
                    ></i>
                    {activeSystemMenu === SystemSettingMenu.apiKeySettings && (
                        <div className={styles.systemRoleSettings}>
                            <label htmlFor="apiKey">OpenAI API Key</label>
                            <input
                                placeholder="Enter your OpenAI API key"
                                id="apiKey"
                                value={tempApiKeyValue}
                                onChange={(e) => {
                                    setTempApiKeyValue(e.target.value);
                                }}
                            ></input>

                            <div className={styles.description}>
                                {t('apiKeyDescription')}
                            </div>

                            <div className={styles.benefits}>
                                {t('apiKeyHelp')}
                                <Link
                                    href="https://platform.openai.com/account/api-keys"
                                    target="_blank"
                                >
                                    OpenAI
                                </Link>{' '}
                            </div>
                            <div className={styles.buttonContainer}>
                                <button
                                    className={styles.saveButton}
                                    onClick={() => {
                                        setActiveSystemMenu('');
                                        setApiKey(tempApiKeyValue);
                                        const encApiKey = encrypt(tempApiKeyValue);
                                        setEncryptedApiKey(encApiKey);
                                        window.localStorage.setItem(
                                            APIKeyLocalKey,
                                            encApiKey
                                        );
                                    }}
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
