import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileArrowDown } from '@fortawesome/free-solid-svg-icons';
import { faChrome, faEdge } from '@fortawesome/free-brands-svg-icons';
import styles from './ExtensionDownloadModel.module.css';

interface ExtensionsDownloadModelProps {
    showModal: boolean;
    onClose?: () => void;
}

function chromeExtensionDownload() {
    window.open('https://chromewebstore.google.com/detail/%E7%99%BE%E8%AF%8D%E6%96%A9%E5%8A%A9%E6%89%8B/ofdejofffdjcmlbclhhfeaefodgffbnm', '_blank');
}

function edgeExtensionDownload() {
    window.open('https://microsoftedge.microsoft.com/addons/detail/%E7%99%BE%E8%AF%8D%E6%96%A9%E5%8A%A9%E6%89%8B/ibfhkheckdidljgkaigigmempdpkjjpb', '_blank');
}

function offlineExtensionDownload() {
    window.open('https://gitee.com/mamotz/baicizhan-helper/releases', '_blank');
}

const ExtensionsDownloadModel: React.FC<ExtensionsDownloadModelProps> = ({ showModal, onClose }) => {
    if (!showModal) return null;

    return (
        <div className={styles.downloadModelContainer}>
            <div className={styles.downloadModelContent}>
                <div className={styles.downloadModelHeader}>
                    <h2 className={styles.downloadModelHeaderTitle}>百词斩插件下载</h2>
                    <button
                        onClick={onClose}
                        className={styles.downloadModelCloseButton}
                    >&times;</button>
                </div>
                <div className={styles.downloadModelBody}>
                    <p>百词斩插件相对于网页，有以下功能：</p>
                    <ol>
                        <li>在任意页面上进行选词翻译</li>
                        <li>快速搜索单词</li>
                        <li>导出单词到 anki 中</li>
                        <li>及更多功能...</li>
                    </ol>
                </div>
                <div className={styles.downloadModelFooter}>
                    <div className={styles.downloadModelFooterButton}>
                        <FontAwesomeIcon icon={faChrome}
                            onClick={chromeExtensionDownload}
                            className={styles.downloadModelFooterButtonIcon} />
                        <span className={styles.downloadModelFooterButtonText2}>chrome 下载</span>
                        <a
                            href='https://www.bilibili.com/video/BV1d6mAYFEUw/'
                            target='_blank'
                            className={styles.downloadModelFooterButtonText}
                        >如何下载</a>
                    </div>
                    <div className={styles.downloadModelFooterButton}>
                        <FontAwesomeIcon icon={faEdge}
                            onClick={edgeExtensionDownload}
                            className={styles.downloadModelFooterButtonIcon} />
                        <span className={styles.downloadModelFooterButtonText2}>edge 下载</span>
                        <a
                            href='https://www.bilibili.com/video/BV15kmAYZEoo/'
                            target='_blank'
                            className={styles.downloadModelFooterButtonText}
                        >如何下载</a>
                    </div>
                    <div className={styles.downloadModelFooterButton}>
                        <FontAwesomeIcon icon={faFileArrowDown}
                            onClick={offlineExtensionDownload}
                            className={styles.downloadModelFooterButtonIcon} />
                        <span className={styles.downloadModelFooterButtonText2}>离线下载</span>
                        <a
                            href='https://www.bilibili.com/video/BV1XbyKYWEtU/'
                            target='_blank'
                            className={styles.downloadModelFooterButtonText}
                        >如何下载</a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExtensionsDownloadModel;