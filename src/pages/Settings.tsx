import React from 'react';
import {
  DEFAULT_SHORTCUTS,
  formatShortcutCode,
  getShortcutConflict,
  type PronunciationPreference,
  type ShortcutAction,
  type ShortcutCode,
  useSettingsStore,
} from '../stores/settingsStore';
import styles from './Settings.module.css';

interface SwitchRowProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const SwitchRow: React.FC<SwitchRowProps> = ({ title, description, checked, onChange }) => (
  <div className={styles.settingRow}>
    <div className={styles.settingCopy}>
      <div className={styles.settingTitle}>{title}</div>
      <div className={styles.settingDescription}>{description}</div>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={title}
      className={styles.switch}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.switchThumb} />
    </button>
  </div>
);

interface ChoiceRowProps<T extends string> {
  title: string;
  description: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

function ChoiceRow<T extends string>({
  title,
  description,
  value,
  options,
  onChange,
}: ChoiceRowProps<T>) {
  return (
    <div className={styles.settingRow}>
      <div className={styles.settingCopy}>
        <div className={styles.settingTitle}>{title}</div>
        <div className={styles.settingDescription}>{description}</div>
      </div>
      <div className={styles.segmented} role="group" aria-label={title}>
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            className={value === option.value ? styles.segmentedActive : ''}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const shortcutRows: Array<{ action: ShortcutAction; label: string; description: string }> = [
  { action: 'option1', label: '选项一', description: '学习和复习的第一个选项' },
  { action: 'option2', label: '选项二', description: '学习和复习的第二个选项' },
  { action: 'option3', label: '选项三', description: '学习和复习的第三个选项' },
  { action: 'option4', label: '选项四', description: '学习和复习的第四个选项' },
  { action: 'next', label: '下一步', description: '查看答案后继续，或进入下一张卡片' },
  { action: 'kill', label: '斩词', description: '在学习或复习中打开斩词确认' },
];

const Settings: React.FC = () => {
  const {
    theme,
    showMedia,
    wordDetailAutoPronounce,
    studyReviewAutoPronounce,
    pronunciationPreference,
    shortcuts,
    setTheme,
    setShowMedia,
    setWordDetailAutoPronounce,
    setStudyReviewAutoPronounce,
    setPronunciationPreference,
    setShortcut,
    resetShortcuts,
  } = useSettingsStore();
  const [capturing, setCapturing] = React.useState<ShortcutAction | null>(null);
  const [shortcutError, setShortcutError] = React.useState<string | null>(null);

  const beginCapture = (action: ShortcutAction) => {
    setShortcutError(null);
    setCapturing(action);
  };

  const handleShortcutKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, action: ShortcutAction) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.code === 'Escape') {
      setCapturing(null);
      setShortcutError(null);
      return;
    }

    if (event.ctrlKey || event.altKey || event.metaKey) {
      setShortcutError('快捷键请使用单个按键，不支持 Ctrl、Alt 或 Meta 组合。');
      return;
    }

    const code = event.code as ShortcutCode;
    const conflict = getShortcutConflict(shortcuts, action, code);
    if (conflict) {
      setShortcutError(`该按键已分配给“${shortcutRows.find((row) => row.action === conflict)?.label}”。`);
      return;
    }

    setShortcut(action, code);
    setCapturing(null);
    setShortcutError(null);
  };

  const handleResetShortcuts = () => {
    resetShortcuts();
    setCapturing(null);
    setShortcutError(null);
  };

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>PREFERENCES</p>
            <h1>设置</h1>
            <p>调整学习体验，修改会即时保存并立即生效。</p>
          </div>
        </header>

        <section className={styles.card} aria-labelledby="appearance-heading">
          <div className={styles.sectionHeader}>
            <h2 id="appearance-heading">外观</h2>
            <p>选择你喜欢的页面显示方式。</p>
          </div>
          <div className={styles.rows}>
            <ChoiceRow
              title="主题"
              description="在明亮和暗黑主题之间切换。"
              value={theme}
              options={[
                { value: 'light', label: '明亮' },
                { value: 'dark', label: '暗黑' },
              ]}
              onChange={setTheme}
            />
            <SwitchRow
              title="显示图片和视频"
              description="学习、复习和拼写页面显示单词媒体。"
              checked={showMedia}
              onChange={setShowMedia}
            />
          </div>
        </section>

        <section className={styles.card} aria-labelledby="pronunciation-heading">
          <div className={styles.sectionHeader}>
            <h2 id="pronunciation-heading">发音</h2>
            <p>控制自动播放和拼写页面的单一发音按钮。</p>
          </div>
          <div className={styles.rows}>
            <ChoiceRow<PronunciationPreference>
              title="首选口音"
              description="首选音频缺失时会自动回退到另一种口音。"
              value={pronunciationPreference}
              options={[
                { value: 'uk', label: '英音' },
                { value: 'us', label: '美音' },
              ]}
              onChange={setPronunciationPreference}
            />
            <SwitchRow
              title="单词详情自动发音"
              description="详情数据加载完成后自动播放首选发音。"
              checked={wordDetailAutoPronounce}
              onChange={setWordDetailAutoPronounce}
            />
          </div>
        </section>

        <section className={styles.card} aria-labelledby="study-heading">
          <div className={styles.sectionHeader}>
            <h2 id="study-heading">学习与复习</h2>
            <p>控制进入卡片时的自动发音行为。</p>
          </div>
          <div className={styles.rows}>
            <SwitchRow
              title="学习和复习自动发音"
              description="进入单词卡片时按首选口音播放单词，必要时继续播放例句。"
              checked={studyReviewAutoPronounce}
              onChange={setStudyReviewAutoPronounce}
            />
          </div>
        </section>

        <section className={styles.card} aria-labelledby="shortcuts-heading">
          <div className={styles.sectionHeader}>
            <div>
              <h2 id="shortcuts-heading">快捷键</h2>
              <p>点击按键后按下新键位；按 Escape 取消，重复分配会被提示。</p>
            </div>
            <button type="button" className={styles.resetButton} onClick={handleResetShortcuts}>
              恢复默认快捷键
            </button>
          </div>
          <div className={styles.shortcutList}>
            {shortcutRows.map((row) => {
              const isCapturing = capturing === row.action;
              return (
                <div className={styles.shortcutRow} key={row.action}>
                  <div className={styles.settingCopy}>
                    <div className={styles.settingTitle}>{row.label}</div>
                    <div className={styles.settingDescription}>{row.description}</div>
                  </div>
                  <button
                    type="button"
                    className={`${styles.captureButton} ${isCapturing ? styles.captureButtonActive : ''}`}
                    onClick={() => beginCapture(row.action)}
                    onKeyDown={(event) => handleShortcutKeyDown(event, row.action)}
                    onBlur={() => {
                      if (isCapturing) setCapturing(null);
                    }}
                    aria-label={`${row.label}快捷键`}
                  >
                    {isCapturing ? '请按键…' : formatShortcutCode(shortcuts[row.action])}
                  </button>
                </div>
              );
            })}
          </div>
          {shortcutError && <p className={styles.shortcutError} role="alert">{shortcutError}</p>}
          <p className={styles.shortcutFootnote}>
            当前默认：{formatShortcutCode(DEFAULT_SHORTCUTS.option1)}–{formatShortcutCode(DEFAULT_SHORTCUTS.option4)} 选择，
            {formatShortcutCode(DEFAULT_SHORTCUTS.next)} 下一步，{formatShortcutCode(DEFAULT_SHORTCUTS.kill)} 斩词。
          </p>
        </section>
      </div>
    </div>
  );
};

export default Settings;
