export enum ERole {
    system = 'system',
    assistant = 'assistant',
    user = 'user',
}

export interface IMessage {
    role: ERole;
    content: string;
    id: string;
    createdAt: number;
    summary?: string;
}

export type Theme = 'light' | 'dark';

export enum SystemSettingMenu {
    apiKeySettings = 'apiKeySettings',
}
