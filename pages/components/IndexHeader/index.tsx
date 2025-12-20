import React, { useState } from 'react';

import { Theme } from '../../../interface';

import styles from './index.module.scss';

import { Models } from "../../../utils";

import '@fortawesome/fontawesome-free/css/all.min.css';


type ReasoningEffort = 'low' | 'medium' | 'high';

const IndexHeader: React.FC<{
    theme: Theme;
    updateTheme: (theme: Theme) => void;
    selectedModel: string;
    setSelectedModel: (model: string) => void;
    selectedReasoningEffort: ReasoningEffort;
    setSelectedReasoningEffort: (effort: ReasoningEffort) => void;
}> = ({
    selectedModel,
    setSelectedModel,
    selectedReasoningEffort,
    setSelectedReasoningEffort,
}) => {

    const ModelSelector: React.FC<{
        selectedModel: string;
        setSelectedModel: (modelId: string) => void;
    }> = ({ selectedModel, setSelectedModel }) => {
        const [isOpen, setIsOpen] = useState(false);
      
        const handleSelect = (modelId: string) => {
          setSelectedModel(modelId);
          setIsOpen(false); // Close the dropdown after selection
        };

        const selectedModelName = Models.find(model => model.id === selectedModel)?.name;
      
        return (
          <div className={styles.modelSelector}>
            <div className={styles.selectedModel} onClick={() => setIsOpen(!isOpen)}>
              {selectedModelName ? <strong>{selectedModelName}</strong> : 'Select a model'}
              <span className={styles.chevronIcon}><i className="fas fa-chevron-down"></i></span>
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

    const reasoningEfforts: { value: ReasoningEffort; label: string }[] = [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
    ];

    const ReasoningSelector = () => {
        return (
            <div className={styles.effortSelector}>
                {reasoningEfforts.map((effort) => (
                    <button
                        key={effort.value}
                        className={`${styles.effortButton} ${selectedReasoningEffort === effort.value ? styles.active : ''}`}
                        onClick={() => setSelectedReasoningEffort(effort.value)}
                        type="button"
                    >
                        {effort.label}
                    </button>
                ))}
            </div>
        );
    };

    return (
        <div className={styles.headerContainer}>
            <div className={styles.leftControls}>
                <ModelSelector
                    selectedModel={selectedModel}
                    setSelectedModel={setSelectedModel}
                />
                <ReasoningSelector />
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
