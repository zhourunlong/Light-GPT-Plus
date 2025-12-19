export const PORT = 3000;

import CryptoJS from 'crypto-js';

const SECRET_KEY = CryptoJS.enc.Utf8.parse('08cba61fd32b2f26bb096d5e12532f6cf3ec876639b4493329709188cb6973d0');
const FIXED_IV = CryptoJS.enc.Utf8.parse('b2c55084b1b4f96bd84257a1abbf5f93');

export const encrypt = (message: string): string => {
    const options = {
        iv: FIXED_IV,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    };

    const encrypted = CryptoJS.AES.encrypt(message, SECRET_KEY, options);
    let base64 = encrypted.toString();
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const decrypt = (encryptedMessage: string): string => {
    encryptedMessage = encryptedMessage.replace(/-/g, '+').replace(/_/g, '/');

    const options = {
        iv: FIXED_IV,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    };

    const decrypted = CryptoJS.AES.decrypt(encryptedMessage, SECRET_KEY, options);
    const originalMessage = decrypted.toString(CryptoJS.enc.Utf8);
    return originalMessage;
};


function getCurrentDate(): string {
    const today: Date = new Date();
    const year: number = today.getFullYear();
    const month: number = today.getMonth() + 1;
    const day: number = today.getDate();

    const formattedMonth: string = month < 10 ? `0${month}` : `${month}`;
    const formattedDay: string = day < 10 ? `0${day}` : `${day}`;

    return `${year}-${formattedMonth}-${formattedDay}`;
}

export const ThemeLocalKey = 'light_gpt_theme';
export const APIKeyLocalKey = 'light_gpt_api_key';


export const TextModels = [
    { id: 'gpt-5.2', name: 'GPT-5.2', description: '', cutOffDate: '2025-08-31' },
    { id: 'gpt-5.2-pro', name: 'GPT-5.2 Pro', description: '', cutOffDate: '2025-08-31' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: '', cutOffDate: '2024-05-31' },
];

export const Models = TextModels;

export const GetAttributes = (modelId: string) => {
    const idx = TextModels.findIndex(model => model.id === modelId);
    if (idx == -1) {
        return { id: modelId, name: modelId, description: '', cutOffDate: 'Unknown' };
    }
    return TextModels[idx];
}

export const ChatSystemMessage = (modelId: string) => {
    const attributes = GetAttributes(modelId);
    return `You are ChatGPT, a large language model trained by OpenAI, based on the ${attributes.name} architecture. Knowledge cutoff: ${attributes.cutOffDate} Current date: ${getCurrentDate()}`;
}

export const SummarizePrompt = "Summarize a topic for the following message in 5 words. Output only the topic content.\n\n----- Message -----\n";
