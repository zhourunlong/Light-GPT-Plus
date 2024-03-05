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

import OpenAI from 'openai';

import {
    PORT,
    ThemeLocalKey,
    APIKeyLocalKey,
    encrypt,
    decrypt,
    ChatSystemMessage,
    SummarizePrompt
} from '../utils';

const chatDB = new ChatService();

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

    const chatHistoryEle = useRef<HTMLDivElement | null>(null);

    function newSystemMessageItem(systemMessage: string): IMessage {
        return {
          role: ERole.system,
          content: systemMessage,
          id: uuid(),
          createdAt: Date.now(),
        };
    }

    function newUserMessageItem(userMessage: string): IMessage {
        return {
          role: ERole.user,
          content: userMessage,
          id: uuid(),
          createdAt: Date.now(),
        };
    }

    function newAssistantMessageItem(assistantMessage: string): IMessage {
        return {
          role: ERole.assistant,
          content: assistantMessage,
          id: uuid(),
          createdAt: Date.now(),
        };
    }

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

    const [selectedModel, setSelectedModel] = useState('gpt-4-turbo-preview'); // Default model

    const [serverIp, setServerIp] = useState('Loading...');

    useEffect(() => {
        fetch('/api/getServerIP')
            .then(response => response.json())
            .then(data => setServerIp(data.ip))
            .catch(error => setServerIp('Error fetching IP' + error));
    }, []);
    
    // Make sure to enable Cross-Origin Resource Sharing (CORS) on the server side
    const openai = new OpenAI({
        baseURL: "http://" + serverIp + `:${PORT}/api/openai`,
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
    });

    const chatGPTWithLatestUserPrompt = async (isRegenerate = false) => {
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
            setServiceErrorMessage('Please set API KEY');
            setActiveSystemMenu(SystemSettingMenu.apiKeySettings);
            return;
        }

        // 先把用户输入信息展示到对话列表
        const currentUserMessage = userPromptRef.current?.value || '';
        if (!isRegenerate && !currentUserMessage) {
            setServiceErrorMessage('Please enter your question!');
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

                // Summarize the sentence in 5 words or fewer for the topic name
                if (newMessageList.length === 2) {
                    const response = await openai.chat.completions.create({
                        model: selectedModel,
                        messages: [
                            {
                                role: ERole.system,
                                content: ChatSystemMessage(selectedModel),
                            },
                            {
                                role: newMessageList[1].role,
                                content: SummarizePrompt + newMessageList[1].content,
                            },
                        ],
                        temperature: 0.7,
                        top_p: 0.9,
                        stream: false,
                    });
                    
                    const tempTopicName = response.choices[0]?.message?.content || "";

                    if (tempTopicName !== '') {
                        updateActiveTopicName(tempTopicName);
                    }
                }
            }
        }

        setMessageList(newMessageList);
        userPromptRef.current!.value = '';
        if (!userPromptRef.current) return;
        userPromptRef.current.style.height = 'auto';
        scrollSmoothThrottle();

        // const prompt = newMessageList[newMessageList.length - 1].content;
        
        // TODO: support image generation
        const isGenerateImage = false;

        // get response
        try {
            setServiceErrorMessage('');
            setLoadingTopicId(activeTopicId);

            //let response: Response;
            let response: string;
            if (isGenerateImage) {
                // response = await generateImageWithText(
                //     apiKey,
                //     prompt,
                // );
                // const generateImgInfo = await response.json();
                // archiveCurrentMessage(generateImgInfo?.data?.[0]?.url);
                // setTimeout(() => {
                //     scrollSmoothThrottle();
                // }, 2000);
            } else {            
                const stream = await openai.chat.completions.create({
                    model: selectedModel,
                    messages: newMessageList.map((item) => ({
                        role: item.role,
                        content: item.content,
                    })),
                    temperature: 0.7,
                    top_p: 0.9,
                    stream: true,
                });
            
                response = "";
                for await (const chunk of stream) {
                    response += chunk.choices[0]?.delta?.content || "";
                    setCurrentAssistantMessage(response);
                }
                archiveCurrentMessage(response);
            }

            apiRequestRateLimit.current.requestsThisMinute += 1;

            // if (!response.ok) {
            //     throw new Error(response.statusText);
            // }

            setLoadingTopicId('');
        } catch (error: any) {
            setLoadingTopicId('');

            setServiceErrorMessage(error?.message || 'Unknown Service Error');
        }
    };

    const archiveCurrentMessage = (newCurrentAssistantMessage: string) => {
        if (newCurrentAssistantMessage) {
            const assistantMessageItem = newAssistantMessageItem(newCurrentAssistantMessage);
            setMessageList((list) => list.concat([assistantMessageItem]));
            if (activeTopicId) {
                chatDB.addConversation({
                    topicId: activeTopicId,
                    ...assistantMessageItem,
                });
            }
            setLoadingTopicId('');
            setCurrentAssistantMessage('');
            scrollSmoothThrottle();
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
                        currentMessageList={messageList}
                        updateCurrentMessageList={updateCurrentMessageList}
                        activeTopicId={activeTopicId}
                        updateActiveTopicId={updateActiveTopicId}
                        activeTopicName={activeTopicName}
                        updateActiveTopicName={updateActiveTopicName}
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
                    className={`${styles.asideToggle} ${
                        asideVisible && styles.asideShow
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
                                        editedUserMessageId={editedUserMessageId}
                                        updateEditedUserMessageId={updateEditedUserMessageId}
                                        editedUserMessage={editedUserMessage}
                                        updateEditedUserMessage={updateEditedUserMessage}
                                        chatGPTWithLatestUserPrompt={chatGPTWithLatestUserPrompt}
                                    />
                                ))}
                            {currentAssistantMessage.length > 0 && activeTopicId === loadingTopicId && (
                                <MessageItem
                                    id={tempCurrentAssistantMessageId.current}
                                    role={ERole.assistant}
                                    avatar={robotAvatar}
                                    message={currentAssistantMessage}
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
                                {t('apiKeyRequiredTip1')}
                            </div>
                            <div className={styles.desc}>
                                {t('apiKeyRequiredTip2')}
                                <Link href="https://openai.com" target="_blank">
                                    Open AI Platform
                                </Link>
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
                            <label htmlFor="apiKey">Open AI API Key</label>
                            <input
                                placeholder="Enter your open ai api key"
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
                                    Open AI Platform API KEYS
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
