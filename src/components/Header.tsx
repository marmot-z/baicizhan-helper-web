import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUser,
  faCalendarDays,
  faCartShopping,
  faArrowRightFromBracket,
  faCommentDots,
  faDownload,
  faGear,
} from '@fortawesome/free-solid-svg-icons';
import { canLoginWithWeixin, useAuthStore } from '../stores/authStore';
import { faWeixin } from '@fortawesome/free-brands-svg-icons';
import toast from 'react-hot-toast';
import ExtensionsDownloadModel from './ExtensionsDownloadModel';
import InviteShare from './InviteShare';
import type { UserBindInfo } from '../types';
import { ROUTES } from '../constants';
import iconLogo from '../assets/icon.png';
import '../pages/Dashboard.css';

export default function Header() {
  const navigate = useNavigate();
  const [downloadModelShow, setDownloadModelShow] = React.useState(false);
  const auth = useAuthStore();
  const { user, logout, loginWithWeixin, isSwitchingAccount } = auth;

  const handleWeixinLogin = async () => {
    try {
      const discardedRecords = await loginWithWeixin();
      const message = discardedRecords ? '已登录微信账号，原账号未同步记录已清理' : '已登录微信账号';
      sessionStorage.setItem('account-switch-message', message);
      window.location.replace(ROUTES.DASHBOARD);
    } catch {
      toast.error('登录微信账号失败');
    }
  };

  const getUserNickname = (): string => {
    if (!user || user.length === 0) return 'guest';

    const weixinUser = user.find((u: UserBindInfo) => u.provider === 'weixin');
    if (weixinUser) return weixinUser.nickname;

    return user[0].nickname || 'guest';
  };

  const closeDownloadModel = () => {
    setDownloadModelShow(false);
  };

  return (
    <header className="navbar">
      <div className="container">
        <img
          src={iconLogo}
          alt="Logo"
          className="logo"
          onClick={() => navigate(ROUTES.DASHBOARD)}
        />
        <nav>
          <ul>
            <li>
              <div className="theme-bar">
                <InviteShare>
                  <button
                    title="邀请好友送会员"
                    className="invite-btn"
                  >
                    <span style={{ marginRight: '4px' }}>🎁</span>
                    <span style={{ fontSize: '16px', fontWeight: 'bold' }}>邀请好友送会员</span>
                  </button>
                </InviteShare>
                {canLoginWithWeixin(auth) && (
                  <button
                    type="button"
                    className="weixin-login-btn"
                    title="已绑定微信，可登录对应微信账号"
                    aria-label="登录微信账号"
                    disabled={isSwitchingAccount}
                    onClick={handleWeixinLogin}
                  >
                    <FontAwesomeIcon icon={faWeixin} />
                    <span>{isSwitchingAccount ? '登录中…' : '登录微信账号'}</span>
                  </button>
                )}
                  <div
                    className="user-profile"
                    onMouseEnter={(e) => {
                      const dropdown = e.currentTarget.querySelector('.dropdown-content') as HTMLElement;
                      if (dropdown) dropdown.style.display = 'block';
                    }}
                    onMouseLeave={(e) => {
                      const dropdown = e.currentTarget.querySelector('.dropdown-content') as HTMLElement;
                      if (dropdown) dropdown.style.display = 'none';
                    }}
                  >
                    <FontAwesomeIcon icon={faUser} />
                    <span>{getUserNickname()}</span>
                    <div className="dropdown-content">
                      <Link to="/page/study-calendar">
                        <FontAwesomeIcon icon={faCalendarDays} style={{ marginRight: '8px' }} />
                        我的日历
                      </Link>
                      <a href="/page/vip-center">
                        <FontAwesomeIcon icon={faCartShopping} style={{ marginRight: '8px' }} />
                        会员中心
                      </a>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setDownloadModelShow(true);
                        }}
                      >
                        <FontAwesomeIcon icon={faDownload} style={{ marginRight: '8px' }} />
                        插件下载
                      </a>
                      <Link to={ROUTES.FEEDBACK}>
                        <FontAwesomeIcon icon={faCommentDots} style={{ marginRight: '8px' }} />
                        反馈
                      </Link>
                      <Link to={ROUTES.SETTINGS}>
                        <FontAwesomeIcon icon={faGear} style={{ marginRight: '8px' }} />
                        设置
                      </Link>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          logout();
                        }}
                      >
                        <FontAwesomeIcon icon={faArrowRightFromBracket} style={{ marginRight: '8px' }} />
                        退出
                      </a>
                    </div>
                  </div>
                </div>
            </li>
          </ul>
        </nav>
      </div>
      <ExtensionsDownloadModel showModal={downloadModelShow} onClose={closeDownloadModel} />
    </header>
  );
}
