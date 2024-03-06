import Head from 'next/head';

const HeadMetaSetup = () => {
    return (
        <Head>
            <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0"
            />
            <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
            />
            <meta
                name="description"
                content="Light-GPT Plus is an interactive website project"
            />

            <meta name="keywords" content="Next.js,ChatGPT,GPT,AI" />

            <title>Light-GPT Plus</title>
        </Head>
    );
};

export default HeadMetaSetup;
