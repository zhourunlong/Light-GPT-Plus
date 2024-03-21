import { React, useState } from 'react';

import { Theme } from '../../../interface';

import styles from './index.module.scss';

import { Models } from "../../../utils";


const IndexHeader: React.FC<{
    theme: Theme;
    updateTheme: (theme: Theme) => void;
    selectedModel: string;
    setSelectedModel: (model: string) => void;
} > = ({selectedModel, setSelectedModel}) => {

    const ModelSelector = ({ selectedModel, setSelectedModel }) => {
        const [isOpen, setIsOpen] = useState(false);
      
        const handleSelect = (modelId) => {
          setSelectedModel(modelId);
          setIsOpen(false); // Close the dropdown after selection
        };
      
        return (
          <div className={styles.modelSelector}>
            <div className={styles.selectedModel} onClick={() => setIsOpen(!isOpen)}>
              {<strong>{Models.find(model => model.id === selectedModel)?.name}</strong> || 'Select a model'}
            </div>
            {isOpen && (
              <div className={styles.dropdown}>
                {Models.map((model) => (
                    <div key={model.id} className={styles.dropdownItem} onClick={() => handleSelect(model.id)}>
                    <div className={styles.modelName}>{model.name}</div>
                    <div className={styles.modelDescription}>{model.description}</div>
                    </div>
                ))}
              </div>
            )}
          </div>
        );
    };

    return (
        <div className={styles.headerContainer}>
            <ModelSelector
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
            />

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
