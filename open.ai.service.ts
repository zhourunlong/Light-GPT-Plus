import { parseOpenAIStream } from './utils';
import { IMessage } from './interface';
import OpenAI from 'openai';

export const generateImageWithText = async (
    apiKey: string,
    prompt: string,
    controller: AbortController
) => {
    throw new Error("Generate image with text not supported.");

    const requestInit: RequestInit = {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        method: 'POST',
        body: JSON.stringify({
            prompt: prompt,
            n: 1,
            size: '512x512',
        }),
        signal: controller.signal,
    };
    try {
        const res = await fetch(
            `https://api.openai.com/v1/images/generations`,
            requestInit
        ).then(async (response) => {
            if (!response.ok) {
                const text = await response.text();
                throw JSON.parse(text);
            }
            return response;
        });
        return res;
    } catch (error) {
        throw error;
    }
};

export const getCurrentApiKeyBilling = async (apiKey: string) => {
    const res = await fetch(
        `https://api.openai.com/dashboard/billing/credit_grants`,
        {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
                Accept: 'application/json',
            },
            method: 'GET',
        }
    );
    return res.json();
};
