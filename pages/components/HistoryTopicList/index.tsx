import React, { useState, useEffect } from 'react';

import { v4 as uuid } from 'uuid';

import { Topic, ChatService } from '../../../DBClient';

import { IMessage } from '../../../interface';

import styles from './index.module.scss';

const chatDB = new ChatService();

const HistoryTopicList: React.FC<{
    historyTopicListVisible: boolean;
    encApiKey: string;
    currentMessageList: IMessage[];
    updateCurrentMessageList: (messages: IMessage[]) => void;
    activeTopicId: string;
    updateActiveTopicId: (id: string) => void;
    activeTopicName: string;
    updateActiveTopicName: (name: string) => void;
    showMask: () => void;
    hideMask: () => void;
}> = ({
    historyTopicListVisible,
    encApiKey,
    currentMessageList,
    updateCurrentMessageList,
    activeTopicId,
    updateActiveTopicId,
    activeTopicName,
    updateActiveTopicName,
    showMask,
    hideMask,
}) => {
    const [historyTopicList, setHistoryTopicList] = useState<
        Topic[]
    >([]);

    const encApiKeyHeader = "APIKEYHEADER";

    const generateTopic = () => {
        const topicId = uuid();
        const newTopicName = "New chat";

        const newTopic: Topic = {
            id: topicId,
            name: newTopicName,
            createdAt: Date.now(),
            encApiKey: encApiKeyHeader + encApiKey,
        };

        chatDB.addTopic(newTopic);
        let newHistoryTopicList = historyTopicList.concat([]);
        newHistoryTopicList.unshift(newTopic);

        updateActiveTopicId(topicId);
        updateActiveTopicName(newTopicName);
        updateCurrentMessageList([]);
        
        setHistoryTopicList(newHistoryTopicList);
    };

    useEffect(() => {
        const updateCurrentTopicName = async () => {
            let tempTopicName = activeTopicName.trim().slice(0, 50);
            if (activeTopicId) {
                await chatDB.updateTopicNameById(activeTopicId, tempTopicName);
                setHistoryTopicList((list) =>
                    list.map((o) =>
                        o.id === activeTopicId ? { ...o, name: tempTopicName } : o
                    )
                );
            }
        };
        updateCurrentTopicName();
    }, [activeTopicName]);


    useEffect(() => {
        const init = async () => {
            const topics = await chatDB.getTopics(encApiKeyHeader + encApiKey);

            setHistoryTopicList(topics);
            updateActiveTopicId('');

            showMask();
            updateCurrentMessageList([]);
            hideMask();
        };
        init();
    }, [
        encApiKey,
        updateActiveTopicId,
        updateCurrentMessageList,
        hideMask,
        showMask,
    ]);

    const [editingTopicName, setEditingTopicName] = useState(false);
    const [tempTopicName, setTempTopicName] = useState('');

    const [removingTopic, setRemovingTopic] = useState(false);

    useEffect(() => {
        setEditingTopicName(false);
        setRemovingTopic(false);
    }, [activeTopicId]);

    return (
        <>
            <div
                className={`${styles.newChatBtn} ${
                    !historyTopicListVisible && styles.hide
                }`}
                onClick={() => {
                    // 新建对话
                    generateTopic();
                }}
            >
                <i className="fas fa-plus"></i>
                <span>New Chat</span>
            </div>
            <div
                className={`${styles.historyTopicList}  ${
                    !historyTopicListVisible && styles.hide
                }`}
            >
                <div className={styles.inner}>
                    {historyTopicList.map((item) => {
                        const isActive = item.id === activeTopicId;
                        return (
                            <div
                                key={item.id}
                                className={`${styles.historyTopic} ${
                                    isActive && styles.active
                                } `}
                                onClick={async () => {
                                    updateActiveTopicId(item.id);

                                    showMask();
                            
                                    const currentMessageList =
                                        await chatDB.getConversationsByTopicId(
                                            item.id
                                        );
                                    updateCurrentMessageList(
                                        currentMessageList as IMessage[]
                                    );

                                    hideMask();
                                }}
                            >
                                {editingTopicName && isActive ? (
                                    <div className={styles.inputContainer}>
                                        <input
                                            className={styles.editingTopicName}
                                            type="text"
                                            value={tempTopicName}
                                            onChange={(e) => {
                                                setTempTopicName(
                                                    e.target.value
                                                );
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <i className="fas fa-comment"></i>
                                        <div className={styles.topicName}>
                                            {item.name}
                                        </div>
                                    </>
                                )}
                                <div
                                    className={styles.action}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                    }}
                                >
                                    {(editingTopicName || removingTopic) &&
                                    isActive ? (
                                        <>
                                            <i
                                                className="fas fa-check"
                                                onClick={async () => {
                                                    if (editingTopicName) {
                                                        // 更新主题名字
                                                        await chatDB.updateTopicNameById(
                                                            item.id,
                                                            tempTopicName
                                                        );
                                                        setHistoryTopicList(
                                                            (list) =>
                                                                list.map((o) =>
                                                                    o.id ===
                                                                    item.id
                                                                        ? {
                                                                              ...o,
                                                                              name: tempTopicName,
                                                                          }
                                                                        : o
                                                                )
                                                        );
                                                    }
                                                    if (removingTopic) {
                                                        await chatDB.deleteTopicById(
                                                            item.id
                                                        );
                                                        setHistoryTopicList(
                                                            (list) =>
                                                                list.filter(
                                                                    (o) =>
                                                                        o.id !==
                                                                        item.id
                                                                )
                                                        );
                                                        updateCurrentMessageList(
                                                            []
                                                        );
                                                    }
                                                    setEditingTopicName(false);
                                                    setRemovingTopic(false);
                                                }}
                                            ></i>
                                            <i
                                                className="fas fa-times"
                                                onClick={() => {
                                                    setEditingTopicName(false);
                                                    setRemovingTopic(false);
                                                }}
                                            ></i>
                                        </>
                                    ) : (
                                        <>
                                            <i
                                                className="fas fa-pencil"
                                                onClick={() => {
                                                    setEditingTopicName(true);
                                                    setTempTopicName(item.name);
                                                }}
                                            ></i>
                                            <i
                                                className="fas fa-trash"
                                                onClick={async () => {
                                                    setRemovingTopic(true);
                                                }}
                                            ></i>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
};

export default HistoryTopicList;
