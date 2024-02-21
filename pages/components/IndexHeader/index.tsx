import React from 'react';

import { Theme } from '../../../interface';

import styles from './index.module.scss';

const IndexHeader: React.FC<{
    theme: Theme;
    updateTheme: (theme: Theme) => void;
    selectedModel: string;
    setSelectedModel: (model: string) => void;
} > = ({selectedModel, setSelectedModel}) => {

    return (
        <div className={styles.headerContainer}>
            <div className={styles.modelSelector}>
                <select
                    id="modelSelect"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                >
                    <option value="gpt-3.5-turbo">GPT-3.5 turbo</option>
                    <option value="gpt-4">GPT-4</option>
                </select>
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
