import { useCallback, useEffect, useRef, useState } from 'react';

import Link from 'next/link';

import { throttle } from 'lodash';

import { useTranslation } from 'react-i18next';

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { v4 as uuid } from 'uuid';

import '@fortawesome/fontawesome-free/css/all.min.css';

import styles from '@/styles/Home.module.scss';

import IndexHeader from './components/IndexHeader';

import HeadMeatSetup from './components/HeadMetaSetup';

import MessageItem from './components/MessageItem';

import HistoryTopicList from './components/HistoryTopicList';

import { generateImageWithText } from '../open.ai.service';

import { Theme, SystemSettingMenu, ERole, IMessage } from '../interface';

import { ChatService } from '../db';

import OpenAI from 'openai';

import {
    dataURItoBlob,
    ThemeLocalKey,
    APIKeyLocalKey,
    GenerateImagePromptPrefix,
    encryptApiKey,
    decryptApiKey,
    DefaultSystemRole,
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

    const [tempSystemRoleValue, setTempSystemRoleValue] = useState('');

    const [activeSystemMenu, setActiveSystemMenu] = useState<
        SystemSettingMenu | ''
    >('');

    const [tempApiKeyValue, setTempApiKeyValue] = useState('');
    const [apiKey, setApiKey] = useState('');

    const chatHistoryEle = useRef<HTMLDivElement | null>(null);

    const [systemRole, setSystemRole] = useState<IMessage>({
        role: ERole.system,
        content: DefaultSystemRole,
        id: uuid(),
        createdAt: Date.now(),
    });

    const updateCurrentSystemRole = useCallback((newSystemRole: string) => {
        setSystemRole((info) => ({
            ...info,
            content: newSystemRole,
        }));
        setTempSystemRoleValue(newSystemRole);
    }, []);

    const [messageList, setMessageList] = useState<IMessage[]>([]);

    const removeMessageById = useCallback(async (id: string) => {
        await chatDB.deleteConversationById(id);
        setMessageList((list) => list.filter((item) => item.id !== id));
    }, []);

    const updateCurrentMessageList = useCallback((messages: IMessage[]) => {
        setMessageList(messages);
    }, []);

    const tempCurrentUserMessageId = useRef(uuid());
    const userPromptRef = useRef<HTMLTextAreaElement | null>(null);

    const [currentAssistantMessage, setCurrentAssistantMessage] = useState('');
    const tempCurrentAssistantMessageId = useRef(uuid());

    const [loading, setLoading] = useState(false);

    const controller = useRef<AbortController | null>(null);

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

    const chatGPTTurboWithLatestUserPrompt = async (isRegenerate = false) => {
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
            toast.warn(`Api Requests are too frequent, try again later! `);
            return;
        }

        if (!apiKey) {
            toast.error('Please set API KEY', {
                autoClose: 1000,
            });
            setActiveSystemMenu(SystemSettingMenu.apiKeySettings);
            return;
        }

        // 先把用户输入信息展示到对话列表
        const currentUserMessage = userPromptRef.current?.value || '';
        if (!isRegenerate && !currentUserMessage) {
            toast.warn('Please enter your question', { autoClose: 1000 });
            return;
        }

        let newMessageList = [];
        if (isRegenerate) {
            // Delete the last assistant message
            newMessageList = messageList.slice(0, -1).concat([]);
        } else {
            newMessageList = messageList.concat([]);
            const newUserMessage = {
                role: ERole.user,
                content: currentUserMessage,
                id: uuid(),
                createdAt: Date.now(),
            };
            newMessageList.push(newUserMessage);
            if (activeTopicId) {
                // 更新
                await chatDB.addConversation({
                    topicId: activeTopicId,
                    ...newUserMessage,
                });
            }
        }

        setMessageList(newMessageList);
        userPromptRef.current!.value = '';
        if (!userPromptRef.current) return;
        userPromptRef.current.style.height = 'auto';
        scrollSmoothThrottle();

        const prompt = newMessageList[newMessageList.length - 1].content;
        const isGenerateImage = prompt.startsWith(GenerateImagePromptPrefix);

        // get response
        try {
            setServiceErrorMessage('');
            setLoading(true);
            controller.current = new AbortController();

            //let response: Response;
            let response: string;
            if (isGenerateImage) {
                response = await generateImageWithText(
                    apiKey,
                    prompt,
                    controller.current
                );
                const generateImgInfo = await response.json();
                archiveCurrentMessage(generateImgInfo?.data?.[0]?.url);
                setTimeout(() => {
                    scrollSmoothThrottle();
                }, 2000);
            } else {
                // Make sure to enable Cross-Origin Resource Sharing (CORS) on the server side
                let openai = new OpenAI({
                    // baseURL: `http://192.168.1.2:1234/v1`, // for local test
                    apiKey: apiKey,
                    dangerouslyAllowBrowser: true,
                });
            
                const stream = await openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
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

            setLoading(false);
        } catch (error: any) {
            setLoading(false);
            controller.current = null;
            setServiceErrorMessage(error?.message || 'Unknown Service Error');
        }
    };

    const archiveCurrentMessage = (newCurrentAssistantMessage: string) => {
        if (newCurrentAssistantMessage) {
            const newAssistantMessage = {
                role: ERole.assistant,
                content: newCurrentAssistantMessage,
                id: uuid(),
                createdAt: Date.now(),
            };
            setMessageList((list) => list.concat([newAssistantMessage]));
            if (activeTopicId) {
                // 更新
                chatDB.addConversation({
                    topicId: activeTopicId,
                    ...newAssistantMessage,
                });
            }
            setLoading(false);
            controller.current = null;
            setCurrentAssistantMessage('');
            scrollSmoothThrottle();
        }
    };

    // Avatars
    const robotAvatar = '/assistant.jpeg';
    const userAvatar = '/user.jpeg';

    const [activeTopicId, setActiveTopicId] = useState('');
    const changeActiveTopicId = useCallback((id: string) => {
        setActiveTopicId(id);
    }, []);

    useEffect(() => {
        const light_gpt_theme =
            window.localStorage.getItem(ThemeLocalKey) || 'light';
        setTheme(light_gpt_theme as Theme);

        const light_gpt_api_key =
            window.localStorage.getItem(APIKeyLocalKey) || '';
        const decryptedApiKey = decryptApiKey(light_gpt_api_key);
        if (decryptedApiKey !== '') {
            // 不显示设置过的api_key
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
            label: t('systemRoleSettings'),
            iconName: 'fa-id-badge',
            value: SystemSettingMenu.systemRoleSettings,
        },
        {
            label: t('apiKeySettings'),
            iconName: 'fa-key',
            value: SystemSettingMenu.apiKeySettings,
        },
    ];

    const [isZh, setIsZh] = useState(true);

    const changeLanguage = () => {
        const newIsZh = !isZh;
        i18n.changeLanguage(newIsZh ? 'zh' : 'en');
        setIsZh(newIsZh);
    };

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
                        currentMessageList={messageList}
                        updateCurrentMessageList={updateCurrentMessageList}
                        activeTopicId={activeTopicId}
                        changeActiveTopicId={changeActiveTopicId}
                        showMask={showMask}
                        hideMask={hideMask}
                        currentSystemRole={systemRole.content}
                        updateCurrentSystemRole={updateCurrentSystemRole}
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
                    <div className={styles.menu} onClick={changeLanguage}>
                        <i className={`fas fa-language`}></i>
                        <div>{t('changeLanguage')}</div>
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

                <HeadMeatSetup></HeadMeatSetup>

                <ToastContainer></ToastContainer>

                <div className={styles.header}>
                    <IndexHeader
                        theme={theme}
                        updateTheme={updateTheme}
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
                                        removeMessageById={removeMessageById}
                                    />
                                ))}
                            {loading && currentAssistantMessage.length > 0 && (
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
                                    Open Ai Platform
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
                                disabled={loading}
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
                                placeholder={`Message Light GPT plus...`}
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
                                {loading ? (
                                    <div className={styles.spinner}></div>
                                ) : (
                                    <i
                                        className="fas fa-paper-plane"
                                        style={{ transform: 'scale(1.2)' }}
                                        onClick={() =>
                                            chatGPTTurboWithLatestUserPrompt(
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
                        {loading ? (
                            <div
                                className={styles.btn}
                                onClick={() => {
                                    if (controller.current) {
                                        controller.current.abort();
                                        setLoading(false);
                                        archiveCurrentMessage(
                                            currentAssistantMessage
                                        );
                                    }
                                }}
                            >
                                Stop
                            </div>
                        ) : (
                            <div
                                className={styles.btn}
                                onClick={() =>
                                    chatGPTTurboWithLatestUserPrompt(true)
                                }
                            >
                                Regenerate
                            </div>
                        )}
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
                    {activeSystemMenu ===
                        SystemSettingMenu.systemRoleSettings && (
                        <div className={styles.systemRoleSettings}>
                            <label htmlFor="systemRole">System Role</label>
                            <textarea
                                placeholder="Enter system role here"
                                id="systemRole"
                                value={tempSystemRoleValue}
                                rows={4}
                                onChange={(e) => {
                                    setTempSystemRoleValue(e.target.value);
                                }}
                            ></textarea>

                            <div className={styles.description}>
                                {t('systemRoleDescription')}
                            </div>

                            <div className={styles.benefits}>
                                {t('systemRoleHelp')}
                                <Link
                                    href="https://github.com/f/awesome-chatgpt-prompts"
                                    target="_blank"
                                >
                                    Awesome ChatGPT Prompts
                                </Link>{' '}
                            </div>
                            <div className={styles.btnContainer}>
                                <button
                                    className={styles.saveButton}
                                    onClick={async () => {
                                        setActiveSystemMenu('');

                                        setSystemRole({
                                            role: ERole.system,
                                            content: tempSystemRoleValue,
                                            id: uuid(),
                                            createdAt: systemRole.createdAt,
                                        });
                                        if (activeTopicId) {
                                            // 更新当前主题的系统设置
                                            await chatDB.updateTopicSystemRoleById(
                                                activeTopicId,
                                                tempSystemRoleValue
                                            );
                                        }
                                        toast.success('Successful update', {
                                            autoClose: 1000,
                                        });
                                    }}
                                >
                                    {t('save')}
                                </button>
                            </div>
                        </div>
                    )}
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
                            <div className={styles.btnContainer}>
                                <button
                                    className={styles.saveButton}
                                    onClick={() => {
                                        setActiveSystemMenu('');
                                        setApiKey(tempApiKeyValue);

                                        const encryptedApiKey =
                                            encryptApiKey(tempApiKeyValue);
                                        window.localStorage.setItem(
                                            APIKeyLocalKey,
                                            encryptedApiKey
                                        );
                                        toast.success('Successful update', {
                                            autoClose: 1000,
                                        });
                                    }}
                                >
                                    {t('save')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
