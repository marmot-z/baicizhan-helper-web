import React from 'react';

const WordBook: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            学习单词本
          </h1>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:p-6">
              <p className="text-gray-600">
                单词本功能正在开发中...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WordBook;