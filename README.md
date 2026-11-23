# 百词斩助手 Web

百词斩助手的网页端项目。

它的目标是把浏览器里的查词、选词翻译、收藏同步、Anki 导出、学习复习等能力整合到一个 Web 界面里，方便用户在电脑上使用百词斩相关功能。

## 功能简介

- 选词翻译：选中网页单词后查看释义
- 单词搜索：搜索单词详情内容
- 收藏同步：同步收藏/取消收藏到百词斩
- Anki 导出：导出单词到 Anki
- 学习复习：在浏览器中背单词

## 本地运行

```bash
npm install
npm run dev
```

## 英语学习 Agent 开发入口

启动英语学习 Agent 后端，登录后从用户菜单进入「英语学习 Agent」，页面地址为 `/page/learning-agent`。该入口仅在开发环境启用。

Vite 将 `/api/learning-agent` 原样转发至 `http://127.0.0.1:18034`。后端地址变更时，在前端根目录的 `.env.local` 设置 `LEARNING_AGENT_PROXY_TARGET`，例如 `LEARNING_AGENT_PROXY_TARGET=http://127.0.0.1:18035`。后端的健康接口为 `GET /api/learning-agent/health`。

## 构建

```bash
npm run build
```
