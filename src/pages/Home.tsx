import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* 导航栏 */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="text-xl font-bold text-gray-900">
                百词斩助手
              </div>
            </div>
            <div className="flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">
                使用介绍
              </a>
              <Link to="/login" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                登录
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* 主要内容区域 */}
      <main>
        {/* 插件介绍区域 */}
        <section className="py-20 bg-gradient-to-b from-blue-50 to-white">
          <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              智能浏览器翻译插件
            </h1>
            <p className="text-xl text-gray-600 mb-12">
              一键翻译、单词收藏、同步学习，让英语学习更高效
            </p>
            
            {/* 下载按钮 */}
            <div className="flex justify-center space-x-4 mb-16">
              <button className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
                <span>Chrome 下载</span>
              </button>
              <button className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2">
                <span>Edge 下载</span>
              </button>
              <button className="bg-gray-800 text-white px-8 py-3 rounded-lg hover:bg-gray-900 transition-colors flex items-center space-x-2">
                <span>GitHub</span>
              </button>
            </div>
            
            {/* 插件截图 */}
            <div className="bg-gray-100 rounded-lg p-8 shadow-lg">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="text-gray-500 text-center">
                  插件截图展示区域
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 功能详细介绍 */}
        <section id="features" className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                强大功能，助力学习
              </h2>
            </div>
            
            {/* 功能列表 */}
            <div className="space-y-16">
              {/* 选词翻译 */}
              <div className="text-center">
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    选词翻译
                  </h3>
                  <p className="text-lg text-gray-600 mb-6 max-w-3xl mx-auto">
                    鼠标选中任意单词或句子，即可快速获得准确翻译，支持多种语言互译。
                  </p>
                </div>
                <div className="max-w-4xl mx-auto">
                  <div className="bg-gray-100 rounded-lg p-8 h-80 flex items-center justify-center shadow-lg">
                    <span className="text-gray-500">选词翻译功能截图</span>
                  </div>
                </div>
              </div>
              
              {/* 搜索单词 */}
              <div className="text-center">
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    搜索单词
                  </h3>
                  <p className="text-lg text-gray-600 mb-6 max-w-3xl mx-auto">
                    快速搜索单词释义、发音、例句，提供全面的单词学习信息。
                  </p>
                </div>
                <div className="max-w-4xl mx-auto">
                  <div className="bg-gray-100 rounded-lg p-8 h-80 flex items-center justify-center shadow-lg">
                    <span className="text-gray-500">搜索单词功能截图</span>
                  </div>
                </div>
              </div>
              
              {/* 收藏同步 */}
              <div className="text-center">
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    收藏同步
                  </h3>
                  <p className="text-lg text-gray-600 mb-6 max-w-3xl mx-auto">
                    一键收藏生词，自动同步到百词斩APP，随时随地复习学习。
                  </p>
                </div>
                <div className="max-w-4xl mx-auto">
                  <div className="bg-gray-100 rounded-lg p-8 h-80 flex items-center justify-center shadow-lg">
                    <span className="text-gray-500">收藏同步功能截图</span>
                  </div>
                </div>
              </div>
              
              {/* Anki导出 */}
              <div className="text-center">
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    Anki导出
                  </h3>
                  <p className="text-lg text-gray-600 mb-6 max-w-3xl mx-auto">
                    将收藏的单词导出为Anki卡片，利用间隔重复算法高效记忆。
                  </p>
                </div>
                <div className="max-w-4xl mx-auto">
                  <div className="bg-gray-100 rounded-lg p-8 h-80 flex items-center justify-center shadow-lg">
                    <span className="text-gray-500">Anki导出功能截图</span>
                  </div>
                </div>
              </div>
              
              {/* 背单词 */}
              <div className="text-center">
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    背单词
                  </h3>
                  <p className="text-lg text-gray-600 mb-6 max-w-3xl mx-auto">
                    内置背单词功能，科学记忆曲线，让单词记忆更持久。
                  </p>
                </div>
                <div className="max-w-4xl mx-auto">
                  <div className="bg-gray-100 rounded-lg p-8 h-80 flex items-center justify-center shadow-lg">
                    <span className="text-gray-500">背单词功能截图</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 页脚 */}
      <footer className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                友情链接
              </h3>
              <ul className="space-y-2 text-gray-600">
                <li><a href="#" className="hover:text-gray-900">百词斩官网</a></li>
                <li><a href="#" className="hover:text-gray-900">Anki官网</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                联系我们
              </h3>
              <p className="text-gray-600">
                邮箱：support@baicizhan-helper.com
              </p>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-200 text-center text-gray-600">
            <p>&copy; 2025 百词斩助手. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;