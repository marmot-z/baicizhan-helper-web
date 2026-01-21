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
  faSun,
  faMoon,
} from '@fortawesome/free-solid-svg-icons';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import ExtensionsDownloadModel from './ExtensionsDownloadModel';
import type { UserBindInfo } from '../types';
import { ROUTES } from '../constants';
import iconLogo from '../assets/icon.png';
import '../pages/Dashboard.css';

export default function Header() {
  const navigate = useNavigate();
  const [downloadModelShow, setDownloadModelShow] = React.useState(false);
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useSettingsStore();

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
              {
                <div className="theme-bar">
                  <button
                    title={theme === 'dark' ? '切换为明亮' : '切换为暗黑'}
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    role="switch"
                    aria-checked={theme === 'dark'}
                    className="theme-switch"
                  >
                    <span className="theme-switch-inner">
                      <span className="track">
                        <span className="thumb" />
                      </span>
                      <FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} />
                    </span>
                  </button>
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
                      <a href="http://www.baicizhan-helper.cn/comments" target="_blank">
                        <FontAwesomeIcon icon={faCommentDots} style={{ marginRight: '8px' }} />
                        反馈
                      </a>
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
              }
            </li>
          </ul>
        </nav>
      </div>
      <ExtensionsDownloadModel showModal={downloadModelShow} onClose={closeDownloadModel} />
    </header>
  );
}

