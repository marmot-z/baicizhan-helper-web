import { Link } from 'react-router-dom';
import accountDiagram from '../assets/account-guide/account-diagram.png';
import accountSettings from '../assets/account-guide/account-settings.png';
import phoneBound from '../assets/account-guide/phone-bound.png';
import phoneAccountCancellation from '../assets/account-guide/phone-account-cancellation.png';
import { ROUTES } from '../constants';
import styles from './AccountGuide.module.css';

export default function AccountGuide() {
  return (
    <main className={styles.page}>
      <article className={styles.content}>
        <header className={styles.header}>
          <Link className={styles.link} to={ROUTES.LOGIN}>
            <span aria-hidden="true">←</span> 返回登录
          </Link>
          <h1>百词斩账号指南</h1>
        </header>

        <section className={styles.section} aria-labelledby="account-system">
          <h2 id="account-system">账号体系</h2>
          <p>
            微信和手机号都能单独注册百词斩账号。微信账号绑定手机号后，如果该号码没有单独注册，两种登录方式都能进入微信注册的账号；
            如果已经单独注册，短信验证码仍会登录手机号注册的账号。
          </p>
          <figure className={styles.diagram}>
            <img
              src={accountDiagram}
              width={1680}
              height={1340}
              alt="百词斩账号关联与登录示意图。微信注册的账号可关联手机号；手机号注册的账号只能关联未注册百词斩账号的微信。"
            />
            <figcaption>
              <a className={styles.link} href={accountDiagram} target="_blank" rel="noopener noreferrer" aria-label="查看原图（新窗口）">
                查看原图
              </a>
            </figcaption>
          </figure>
        </section>

        <section className={styles.section} aria-labelledby="sms-login">
          <h2 id="sms-login">用短信验证码登录微信注册的账号</h2>

          <div className={styles.scenario}>
            <h3 id="bind-phone">手机号未单独注册</h3>
            <ol className={styles.steps}>
              <li>打开百词斩 App，用微信登录，进入「设置 → 账号管理」。</li>
              <li>在手机号一栏点「绑定」，按提示完成短信验证。</li>
              <li>返回助手登录页，用绑定的手机号接收验证码并登录。</li>
            </ol>
            <div className={styles.screenshots}>
              <figure className={styles.screenshot}>
                <img
                  className={styles.settingsImage}
                  src={accountSettings}
                  width={1200}
                  height={2640}
                  loading="lazy"
                  alt="百词斩 App 设置页，账号管理入口已用红框标出。"
                />
                <figcaption>在「设置」中打开「账号管理」。</figcaption>
              </figure>
              <figure className={styles.screenshot}>
                <img
                  className={styles.boundImage}
                  src={phoneBound}
                  width={1200}
                  height={2640}
                  loading="lazy"
                  alt="微信登录后的账号管理页面，手机号已列在已绑定账号下。"
                />
                <figcaption>绑定成功后的状态。显示「解绑」表示手机号已绑定。</figcaption>
              </figure>
            </div>
          </div>

          <div className={styles.scenario}>
            <h3>手机号已单独注册</h3>
            <ol className={styles.steps}>
              <li>在百词斩 App 用短信验证码登录手机号注册的账号。</li>
              <li>进入「设置 → 账号管理」，确认「当前登录方式」为手机，再按 App 提示注销该账号。</li>
              <li>注销完成后，用微信登录，按<a className={styles.link} href="#bind-phone">上面的步骤</a>绑定手机号。</li>
            </ol>
            <p className={styles.caution}>
              <strong>注销前</strong>，请先核对手机号账号里的学习记录和账号权益，具体影响以百词斩 App 的注销提示为准。
            </p>
            <figure className={styles.screenshot}>
              <img
                className={styles.cancellationImage}
                src={phoneAccountCancellation}
                width={1200}
                height={2640}
                loading="lazy"
                alt="账号管理页的当前登录方式为手机，右侧注销按钮已用红框标出。"
              />
              <figcaption>确认当前登录方式是「手机」，再点右侧的「注销」。</figcaption>
            </figure>
          </div>
        </section>
      </article>
    </main>
  );
}
