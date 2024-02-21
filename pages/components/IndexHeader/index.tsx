import React, { useState, useEffect } from 'react';

// import { useTranslation } from 'react-i18next';

// import { getCurrentApiKeyBilling } from '../../../open.ai.service';

import { Theme } from '../../../interface';

// import { ThemeLocalKey, formatTimestamp } from '../../../utils';

import styles from './index.module.scss';

const IndexHeader: React.FC<{
    theme: Theme;
    updateTheme: (theme: Theme) => void;
} > = () => {

    return (
        <div className={styles.headerContainer}>
            <div className={styles.currentApiKeyBilling}>
                {/*Keep this to remain formated*/}
            </div>

            <div className={styles.siteIntroduction}>
                <div className={styles.title}>
                    <span className={styles.item}>Light</span>
                    <span className={styles.item}>GPT</span>
                    <span className={styles.item}>Plus</span>
                </div>
                <div className={styles.description}>
                    <span>Based on </span>
                    <a href="https://github.com/riwigefi/light-gpt">Light GPT</a>
                </div>
            </div>
            <div className={styles.sideMenus}>
                <i
                    className="fab fa-github"
                    onClick={() => {
                        window.open(
                            'https://github.com/zhourunlong/Light-GPT-plus',
                            '_blank'
                        );
                    }}
                ></i>
            </div>
        </div>
    );
};

export default IndexHeader;
