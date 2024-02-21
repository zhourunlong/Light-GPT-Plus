import OpenAI from "openai";

const openai = new OpenAI({
    baseURL: "http://192.168.1.2:1234/v1",
    apiKey: "random",
    dangerouslyAllowBrowser: true
});

async function main() {
    const stream = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: "Say this is a test" }],
        temperature: 0.7,
        top_p: 0.9,
        stream: true,
    });

    let str = "";
    for await (const chunk of stream) {
        str += chunk.choices[0]?.delta?.content || "";
    }

    console.log(str);
}

main();
