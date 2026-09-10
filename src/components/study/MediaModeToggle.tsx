import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEyeSlash, faImage } from '@fortawesome/free-solid-svg-icons';
import { useSettingsStore } from '../../stores/settingsStore';
import styles from './MediaModeToggle.module.css';

const MediaModeToggle = () => {
  const showMedia = useSettingsStore((state) => state.showMedia);
  const toggleMedia = useSettingsStore((state) => state.toggleMedia);
  const accessibleLabel = showMedia ? '切换为无图模式' : '切换为有图模式';

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggleMedia}
      role="switch"
      aria-checked={!showMedia}
      aria-label={accessibleLabel}
      title={accessibleLabel}
    >
      <FontAwesomeIcon icon={showMedia ? faImage : faEyeSlash} />
    </button>
  );
};

export default MediaModeToggle;
