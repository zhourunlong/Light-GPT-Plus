import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import { appWithTranslation } from 'next-i18next';
import '@/styles/globals.scss';
import 'normalize.css';

import i18n from '../i18n';

function App({ Component, pageProps }: AppProps) {
    // set default language to English
    i18n.changeLanguage('en');

    return <Component {...pageProps} />;
}

export default appWithTranslation(App);
