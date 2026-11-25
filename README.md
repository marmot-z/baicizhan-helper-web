# 百词斩助手 Web

百词斩助手的网页端项目。

它的目标是把浏览器里的查词、选词翻译、收藏同步、Anki 导出、学习复习等能力整合到一个 Web 界面里，方便用户在电脑上使用百词斩相关功能。

## 功能简介

- 选词翻译：选中网页单词后查看释义
- 单词搜索：搜索单词详情内容
- 收藏同步：同步收藏/取消收藏到百词斩
- Anki 导出：导出单词到 Anki
- 学习复习：在浏览器中背单词

## 本地开发

在 Web 项目运行 `npm ci`，随后运行 `npm run dev`。在 `english-learning-agent` 项目运行 `npm ci` 和 `npm run dev`。浏览器访问 `http://localhost:5173`，登录后从用户菜单进入「英语学习 Agent」。

| 浏览器请求 | Vite 转发目标 | 可选覆盖项 |
| --- | --- | --- |
| `/api/*` | `https://www.baicizhan-helper.cn`，去掉 `/api` 前缀 | `API_PROXY_TARGET` |
| `/agent/*` | `http://127.0.0.1:18034/api/learning-agent/*` | `LEARNING_AGENT_PROXY_TARGET` |

Web 和 Agent 在开发时默认使用线上 Proxy。两者应使用同一个 Proxy，保证浏览器登录后签发的凭证能用于 Agent 的档案查询。

如需联调三个本地服务，先按 `baicizhan-helper-proxy` 的说明启动 Proxy（`127.0.0.1:18033`），再在各自项目目录启动 Web 和 Agent。

```sh
# baicizhan-helper-web
API_PROXY_TARGET=http://127.0.0.1:18033 npm run dev

# english-learning-agent
BAICIZHAN_HELPER_API_BASE_URL=http://127.0.0.1:18033 npm run dev
```

如需持久化本地覆盖，在 Web 根目录使用 `.env.development.local`，在 Agent 根目录使用 `.env`。修改后重启对应服务。开发环境可用 `curl http://localhost:5173/agent/health` 检查 Agent 转发。

## 生产部署

```sh
npm ci
npm run build
```

将 `dist/` 的内容发布到 Nginx 的站点目录，默认 `/opt/baicizhan-helper-web`。站点配置使用 `baicizhan-helper-proxy` 仓库的 `deploy/nginx.conf`。如果站点已有 HTTPS，在现有的 HTTPS 虚拟主机中合并路由和请求头配置。

| 同域请求 | Nginx 处理方式 |
| --- | --- |
| `/`、`/page/*`、静态资源 | 读取 `dist/`。直接打开或刷新 `/page/*` 时回退到 `index.html` |
| `/agent/*` | 转给本机 Agent（`127.0.0.1:18034`） |
| 普通接口，例如 `/userInfo`、`/booksInfo` | 保留路径并转给本机 Proxy（`127.0.0.1:18033`） |

Agent 在生产使用 `npm start`，默认通过本机 Proxy 验证用户。加载 Nginx 配置前先运行 `nginx -t`，部署后检查同域的 `/agent/health` 以及 `/page/learning-agent`。
