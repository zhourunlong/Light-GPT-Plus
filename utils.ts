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

// TODO: Modify the system message like below, with fillable model name and current data.

// You are ChatGPT, a large language model trained by OpenAI, based on the GPT-3.5 architecture. Knowledge cutoff: 2022-01 Current date: 2024-02-22



const ModelName: Record<string, string> = {
    "gpt-3": "GPT-3.5",
    "gpt-4": "GPT-4",
};

const CutOffDate: Record<string, string> = {
    "gpt-3": "2022-01",
    "gpt-4": "2023-04",
}

export const ChatSystemMessage = (modelFullName: string) => {
    const model = modelFullName.slice(0, 5);
    return `You are ChatGPT, a large language model trained by OpenAI, based on the ${ModelName[model]} architecture. Knowledge cutoff: ${CutOffDate[model]} Current date: ${getCurrentDate()}`;
}

export const SummarizePrompt = "Summarize a topic for the following message in 5 words, and output only the topic.\n\n----- Message -----\n";
