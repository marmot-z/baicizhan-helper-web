import React, { useState } from "react";

// 导航栏组件
function Navbar({ darkMode, setDarkMode }) {
  return (
    <nav className="fixed top-0 left-0 w-full z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-800 transition">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
        <div className="font-bold text-xl text-blue-600 dark:text-blue-400">百词斩助手</div>
        <div className="flex items-center gap-6">
          <a href="#guide" className="text-gray-700 dark:text-gray-200 hover:text-blue-500 dark:hover:text-blue-400 transition">使用介绍</a>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="rounded-full p-2 bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-800 transition"
            aria-label="切换主题"
          >
            {darkMode ? (
              <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.22 2.03a1 1 0 011.42 1.42l-.7.7a1 1 0 11-1.42-1.42l.7-.7zM18 9a1 1 0 100 2h-1a1 1 0 100-2h1zm-2.03 4.22a1 1 0 011.42 1.42l-.7.7a1 1 0 11-1.42-1.42l.7-.7zM10 16a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm-4.22-2.03a1 1 0 00-1.42 1.42l.7.7a1 1 0 001.42-1.42l-.7-.7zM4 11a1 1 0 100-2H3a1 1 0 100 2h1zm2.03-4.22a1 1 0 00-1.42-1.42l-.7.7a1 1 0 001.42 1.42l.7-.7z" /></svg>
            ) : (
              <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}

// Hero 区域
function Hero() {
  return (
    <section className="pt-24 pb-12 bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950 transition" id="hero">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-10 px-4">
        {/* 左侧 */}
        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-6">
            百词斩助手可以让你在浏览器上使用百词斩的功能
          </h1>
          <div className="flex gap-4 mb-4">
            <a href="#" className="px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition">Chrome</a>
            <a href="#" className="px-5 py-2 rounded-lg bg-gray-200 text-gray-800 font-semibold shadow hover:bg-gray-300 transition dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">Edge</a>
            <a href="#" className="px-5 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold shadow hover:bg-gray-200 transition dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">GitHub</a>
          </div>
        </div>
        {/* 右侧 */}
        <div className="flex-1 flex justify-center">
          <div className="w-72 h-48 bg-gray-200 dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-lg">
            {/* 这里可替换为真实 GIF */}
            <span className="text-gray-400 dark:text-gray-500">[插件演示图/GIF]</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// 功能高亮区
const features = [
  { icon: <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2l4 -4" /></svg>, title: "选词翻译" },
  { icon: <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>, title: "搜索单词" },
  { icon: <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>, title: "与 app 同步" },
  { icon: <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16v16H4z" /></svg>, title: "导出到 Anki" },
  { icon: <svg className="w-8 h-8 text-pink-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 20l9-5-9-5-9 5 9 5z" /></svg>, title: "背单词" },
];

function FeatureGrid() {
  return (
    <section className="py-12 bg-white dark:bg-gray-950 transition" id="features">
      <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 px-4">
        {features.map((f, i) => (
          <div key={i} className="flex flex-col items-center bg-gray-50 dark:bg-gray-900 rounded-xl shadow p-5 transition">
            {f.icon}
            <div className="mt-3 text-base font-semibold text-gray-800 dark:text-gray-100">{f.title}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// 详细功能模块
const featureModules = [
  {
    title: "选词翻译",
    desc: "在网页中选中单词即可弹出翻译，支持多种释义和例句。",
    img: "[选词翻译截图]",
  },
  {
    title: "搜索单词",
    desc: "随时搜索生词，查看释义、发音和例句。",
    img: "[搜索单词截图]",
  },
  {
    title: "收藏/取消收藏同步到 app",
    desc: "插件与百词斩 app 实时同步收藏和取消收藏的单词。",
    img: "[同步截图]",
  },
  {
    title: "导出到 Anki",
    desc: "一键导出生词到 Anki，方便自定义记忆卡片。",
    img: "[Anki 导出截图]",
  },
  {
    title: "背单词",
    desc: "直接在浏览器中背单词，随时随地高效学习。",
    img: "[背单词截图]",
  },
];

function FeatureModule({ title, desc, img, reverse }) {
  return (
    <section className={`py-10 ${reverse ? 'bg-gray-50 dark:bg-gray-900' : 'bg-white dark:bg-gray-950'} transition`}>
      <div className={`max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-8 px-4 ${reverse ? 'md:flex-row-reverse' : ''}`}>
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{title}</h3>
          <p className="text-gray-700 dark:text-gray-300">{desc}</p>
        </div>
        <div className="flex-1 flex justify-center">
          <div className="w-64 h-40 bg-gray-200 dark:bg-gray-800 rounded-lg flex items-center justify-center shadow">
            <span className="text-gray-400 dark:text-gray-500">{img}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// 页脚
function Footer() {
  return (
    <footer className="py-8 bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 text-center text-sm text-gray-500 dark:text-gray-400">
      <div className="mb-2">
        友情链接：
        <a href="https://www.baicizhan.com/" className="mx-2 text-blue-500 hover:underline">百词斩官网</a>
        <a href="https://ankiweb.net/" className="mx-2 text-blue-500 hover:underline">Anki</a>
      </div>
      <div>© 2024 百词斩助手 | <a href="https://beian.miit.gov.cn/" className="hover:underline">蜀ICP备xxxxxxx号</a></div>
    </footer>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState(false);

  React.useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className="bg-white dark:bg-gray-950 min-h-screen transition">
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
      <main>
        <Hero />
        <FeatureGrid />
        {featureModules.map((m, i) => (
          <FeatureModule key={i} {...m} reverse={i % 2 === 1} />
        ))}
      </main>
      <Footer />
    </div>
  );
} 