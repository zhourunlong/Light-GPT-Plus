export const PORT = 3000;

import {
    createParser,
    ParseEvent,
    ReconnectInterval,
} from 'eventsource-parser';

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


export const parseOpenAIStream = (rawResponse: Response) => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const stream = new ReadableStream({
        async start(controller) {
            const streamParser = (event: ParseEvent | ReconnectInterval) => {
                if (event.type === 'event') {
                    const data = event.data;
                    if (data === '[DONE]') {
                        controller.close();
                        return;
                    }
                    try {
                        const json = JSON.parse(data);
                        const text = json.choices?.[0]?.delta?.content || '';
                        const queue = encoder.encode(text);
                        controller.enqueue(queue);
                    } catch (e) {}
                }
            };
            const parser = createParser(streamParser);
            if (!rawResponse.body) return;
            const reader = rawResponse.body.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break;
                    }
                    parser.feed(decoder.decode(value));
                }
            } catch (error) {}
        },
    });
    return stream;
};

export function dataURItoBlob(dataURI: string) {
    // 将base64编码的数据去掉头部信息
    const byteString = atob(dataURI.split(',')[1]);
    // 创建一个类型数组对象来存放转换后的字符
    const ia = new Uint8Array(byteString.length);
    // 循环遍历每个字符，将它们转换成Unicode字符码，并存储到数组中
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    // 使用Blob对象封装二进制数据，并设置MIME类型为图片格式
    const blob = new Blob([ia], { type: 'image/png' });
    return blob;
}

export const readBlobAsDataURL = (blob: Blob): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result?.toString() || '');
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const formatTimestamp = (timestamp: number) => {
    const length = timestamp.toString().length;
    if (length === 10) {
        timestamp *= 1000; // 转换为毫秒
    }
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const formattedDate =
        year +
        '/' +
        (month > 9 ? month : `0${month}`) +
        '/' +
        (day > 9 ? day : `0${day}`);
    return formattedDate;
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
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', reasoning: false, description: '', cutOffDate: '2023-12' },
    { id: 'gpt-4o', name: 'GPT-4o', reasoning: false, description: '', cutOffDate: '2023-10' },
    { id: 'gpt-4o-mini', name: 'GPT-4o mini', reasoning: false, description: '', cutOffDate: '2023-10' },
    { id: 'o1-mini', name: 'o1 mini', reasoning: true, description: '', cutOffDate: '2023-10' },
];
// TODO: add GPT-4o

export const ImageModels = [
    { id: 'dall-e-3', name: 'DALL·E 3', description: ''},
    { id: 'dall-e-2', name: 'DALL·E 2', description: ''},
];

export const Models = [...TextModels, ...ImageModels];

export const GetAttributes = (modelId: string) => {
    const idx = TextModels.findIndex(model => model.id === modelId);
    if (idx == -1) {
        return { id: modelId, name: modelId, reasoning: false, description: '', cutOffDate: 'Unknown' };
    }
    return TextModels[idx];
}

export const ChatSystemMessage = (modelId: string) => {
    const attributes = GetAttributes(modelId);
    return `You are ChatGPT, a large language model trained by OpenAI, based on the ${attributes.name} architecture. Knowledge cutoff: ${attributes.cutOffDate} Current date: ${getCurrentDate()}`;
}

export const SummarizePrompt = "Summarize a topic for the following message in 5 words. Output only the topic content.\n\n----- Message -----\n";
