import { useMemo } from 'react';
import { faChrome, faEdge } from '@fortawesome/free-brands-svg-icons';
import { faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants';
import iconImg from '../assets/icon.png';
import { useAuthStore } from '../stores/authStore';
import type { UserBindInfo } from '../types';
import styles from './Home.module.css';

const DOWNLOAD_LINKS = {
  chrome:
    'https://chromewebstore.google.com/detail/%E7%99%BE%E8%AF%8D%E6%96%A9%E5%8A%A9%E6%89%8B/ofdejofffdjcmlbclhhfeaefodgffbnm',
  edge:
    'https://microsoftedge.microsoft.com/addons/detail/%E7%99%BE%E8%AF%8D%E6%96%A9%E5%8A%A9%E6%89%8B/ibfhkheckdidljgkaigigmempdpkjjpb',
};

const BILIBILI_VIDEO = {
  embedUrl: 'https://player.bilibili.com/player.html?bvid=BV1kK1pB2Eyx&poster=0&autoplay=1&muted=1&high_quality=1',
};

function getUserNickname(user: UserBindInfo[] | null | undefined): string {
  if (!user || user.length === 0) {
    return '个人主页';
  }

  const weixinUser = user.find((item) => item.provider === 'weixin');
  return weixinUser?.nickname || user[0]?.nickname || '个人主页';
}

export default function Home() {
  const { user, isAuthenticated } = useAuthStore();
  const nickname = useMemo(() => getUserNickname(user), [user]);

  const primaryActionTo = isAuthenticated ? ROUTES.DASHBOARD : ROUTES.LOGIN;
  const primaryActionLabel = isAuthenticated ? '个人主页' : '登录';
  const navUserLabel = isAuthenticated ? nickname : '登录';

  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <Link to={ROUTES.HOME} className={styles.navLogo} aria-label="百词斩助手首页">
          <img src={iconImg} alt="百词斩助手" className={styles.navLogoImage} />
          <span className={styles.navLogoText}>百词斩助手</span>
        </Link>

        <nav className={styles.navLinks} aria-label="主导航">
          <a
            className={styles.navLink}
            href="https://gitee.com/mamotz/baicizhan-helper/wikis/%E4%BD%BF%E7%94%A8%E6%89%8B%E5%86%8C"
            target="_blank"
            rel="noreferrer"
          >
            使用介绍
          </a>
          <Link className={styles.navLink} to={primaryActionTo}>
            {navUserLabel}
          </Link>
        </nav>
      </header>

      <main className={styles.hero}>
        <section className={styles.heroLeft}>
          <div className={styles.badge}>
            <span className={styles.badgeDot} />
            浏览器扩展 · 免费使用
          </div>

          <h1 className={styles.title}>
            在浏览器里
            <br />
            随时使用
            <em className={styles.titleAccent}>百词斩</em>
          </h1>

          <p className={styles.subtitle}>
            无需切换 App，浏览任何网页时划词即可查单词、查句意、学例句，让英语学习自然融入你的每一天。
          </p>

          <div className={styles.actions}>
            <Link className={`${styles.button} ${styles.buttonPrimary}`} to={primaryActionTo}>
              <FontAwesomeIcon className={styles.buttonIcon} icon={faUser} />
              {primaryActionLabel}
            </Link>
            <a
              className={`${styles.button} ${styles.buttonOutline}`}
              href={DOWNLOAD_LINKS.chrome}
              target="_blank"
              rel="noreferrer"
            >
              <FontAwesomeIcon className={styles.buttonIcon} icon={faChrome} />
              插件下载
            </a>
            <a
              className={`${styles.button} ${styles.buttonOutline}`}
              href={DOWNLOAD_LINKS.edge}
              target="_blank"
              rel="noreferrer"
            >
              <FontAwesomeIcon className={styles.buttonIcon} icon={faEdge} />
              插件下载
            </a>
          </div>
        </section>

        <section className={styles.heroRight} aria-label="产品介绍视频">
          <div className={styles.videoCard}>
            <div className={styles.videoPanel}>
              <div className={styles.videoFrame}>
                <iframe
                  src={BILIBILI_VIDEO.embedUrl}
                  title="Bilibili 产品介绍视频"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerLeft}>
          <div>© 2026 百词斩网页助手 · 备案号：浙ICP备2025174200号-1</div>
        </div>
        <div className={styles.footerRight}>
          <a className={styles.footerLink} href="#!">
            联系我们
          </a>
          <a
            className={styles.footerLink}
            href="https://gitee.com/mamotz/baicizhan-helper"
            target="_blank"
            rel="noreferrer"
          >
            Gitee
          </a>
          <a
            className={styles.footerLink}
            href="https://github.com/marmot-z/baicizhan-helper-web"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
