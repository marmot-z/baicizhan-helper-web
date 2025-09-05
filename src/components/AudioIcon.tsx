import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVolumeUp } from '@fortawesome/free-solid-svg-icons';

const CDN_HOST = 'https://7n.bczcdn.com';

interface AudioIconProps {
    src: string;
}

const AudioIcon: React.FC<AudioIconProps> = ({ src }) => {
    return <FontAwesomeIcon
        icon={faVolumeUp}
        style={{
            width: '20px',
            height: '20px',
            cursor: 'pointer',
            color: '#6c757d'
        }}
        onClick={() => {
            const audio = new Audio(CDN_HOST + src);
            audio.play().catch(error => console.error('音频播放失败:', error));
        }}
        title="播放发音"
    />;
};

export default AudioIcon;