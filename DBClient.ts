const BASE_URL = `/api/db`;

export interface Topic {
    id: string;
    name: string;
    createdAt: number;
    encApiKey: string;
}

export interface Conversation {
    id: string;
    role: string;
    content: string;
    topicId: string;
    createdAt: number;
}

export class ChatService {
    async getTopics(encApiKey: string): Promise<Topic[]> {
        return fetch(`${BASE_URL}/topics/by-apikey/${encApiKey}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to get topics');
                }
                return response.json();
            })
            .then(data => {
                const topics: Topic[] = data.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    createdAt: item.createdAt,
                    encApiKey: item.encApiKey,
                }));
                return topics;
            })
            .catch(error => {
                console.error(error);
                throw error;
            });
    }

    async getTopicById(topicId: string): Promise<Topic | undefined> {
        return fetch(`${BASE_URL}/topics/by-id/${topicId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to get topic by id');
                }
                return response.json();
            })
            .then(data => {
                const topic: Topic = {
                    id: data.id,
                    name: data.name,
                    createdAt: data.createdAt,
                    encApiKey: data.encApiKey,
                };
                return topic;
            })
            .catch(error => {
                console.error(error);
                throw error;
            });
    }

    async getConversationsByTopicId(topicId: string): Promise<Conversation[]> {
        return fetch(`${BASE_URL}/topics/by-id/${topicId}/conversations`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to get conversations by topic id');
                }
                return response.json();
            })
            .then(data => {
                const conversations: Conversation[] = data.map((item: any): Conversation => ({
                    id: item.id,
                    role: item.role,
                    content: item.content,
                    topicId: item.topicId,
                    createdAt: item.createdAt,
                }));
                return conversations;
            })
            .catch(error => {
                console.error(error);
                throw error;
            });
    }

    async addConversation(conversation: Conversation): Promise<void> {
        return fetch(`${BASE_URL}/conversations`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(conversation),
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to add new conversation');
                }
            })
            .catch(error => console.error(error));
    }

    async deleteConversationById(conversationId: string): Promise<void> {
        return fetch(`${BASE_URL}/conversations/${conversationId}`, {
            method: 'DELETE'
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to delete conversation');
                }
            })
            .catch(error => console.error(error));
    }

    async addTopic(topic: Topic): Promise<void> {
        return fetch(`${BASE_URL}/topics`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(topic),
        })
            .then(response => {
                if (response.ok) {
                    throw new Error('Failed to add new topic');
                }
            })
            .catch(error => console.error(error));
    }

    async deleteTopicById(topicId: string): Promise<void> {
        return fetch(`${BASE_URL}/topics/by-id/${topicId}`, {
            method: 'DELETE',
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to delete topic');
                }
            })
            .catch(error => console.error(error));
    }

    async updateTopicNameById(topicId: string, name: string): Promise<void> {
        return fetch(`${BASE_URL}/topics/by-id/${topicId}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ name: name }),
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to update topic name');
                }
            })
            .catch(error => console.error(error));
    }
}