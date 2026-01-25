import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { authService } from '../services/authService';
import styles from './InviteShare.module.css';

const InviteShare: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  // 当模态框打开时，获取邀请码
  useEffect(() => {
    if (isOpen && !inviteCode) {
      const fetchCode = async () => {
        setLoading(true);
        try {
          const code = await authService.getInviteCode();
          setInviteCode(code);
        } catch (error) {
          console.error('Failed to get invite code:', error);
          toast.error('获取邀请码失败，请稍后重试');
        } finally {
          setLoading(false);
        }
      };
      fetchCode();
    }
  }, [isOpen, inviteCode]);

  // 生成分享链接
  const shareUrl = inviteCode 
    ? `${window.location.origin}?inviteCode=${inviteCode}`
    : '正在生成专属链接...';

  // 复制功能
  const handleCopy = async () => {
    if (!inviteCode) return;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('链接已复制，快去分享给好友吧！');
    } catch (err) {
      console.error('Copy failed:', err);
      // 降级方案：选中输入框文本
      const input = document.getElementById('share-link-input') as HTMLInputElement;
      if (input) {
        input.select();
        toast('请手动复制链接', { icon: '👉' });
      }
    }
  };

  return (
    <>
      {/* 悬浮球 */}
      <div 
        className={styles.floatBtn} 
        onClick={() => setIsOpen(true)}
        title="邀请好友送会员"
      >
        <span className={styles.giftIcon}>🎁</span>
        <span className={styles.btnText}>邀请有礼</span>
      </div>

      {/* 模态框 */}
      {isOpen && (
        <div className={styles.overlay} onClick={() => setIsOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
              ×
            </button>
            
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>邀请好友送月度会员</h2>
            </div>

            <div className={styles.modalBody}>
              {loading ? (
                <div className={styles.loadingContainer}>
                  正在生成您的专属邀请函...
                </div>
              ) : (
                <>
                  <div className={styles.linkSection}>
                    <input 
                      id="share-link-input"
                      type="text" 
                      className={styles.linkInput} 
                      value={shareUrl} 
                      readOnly 
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button className={styles.copyBtn} onClick={handleCopy}>
                      复制链接
                    </button>
                  </div>

                  <div className={styles.rules}>
                    <h4 className={styles.rulesTitle}>活动规则：</h4>
                    <ul className={styles.rulesList}>
                      <li>7日内，好友通过您的链接注册并登录。</li>
                      <li>好友注册成功后，您可获得月度会员奖励。</li>
                      <li>奖励自动到账，多邀多得，上不封顶。</li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InviteShare;
