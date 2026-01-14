# 复习功能开发文档

## 1. 背景与目标

当前 `StudyView` 仅支持「学习新单词」模式。我们需要新增「复习模式」，利用现有的单词卡片学习引擎（`Study` 类及 UI），但使用不同的**数据源**（已学单词）和**上报逻辑**。

核心差异对比：

| 特性 | 学习模式 (现有) | 复习模式 (新增) |
| :--- | :--- | :--- |
| **入口** | 默认 /study | /study?mode=review |
| **单词数量** | 学习计划中的 `daily_plan_count` | 学习计划中的 `review_plan_count` |
| **选词策略** | 从全局 `wordList` 筛选未学单词 | 从 `getLearnedWords` 获取已学单词，按 `update_days` 降序（距今最久）排序 |
| **选项来源** | `UserRoadMapElementV2.options` | 需将已学单词 `topic_id` 映射回全局 `wordList`，复用其中的 `options` |
| **完成上报** | `studyService.updateDoneData` | **新接口** `studyService.updateReviewData` (当前为空实现) |

---

## 2. 核心设计决策

为了保证代码的可维护性和可读性，避免在 `StudyView` 中堆砌 `if-else`，我们采用 **策略模式 (Strategy Pattern)** 进行重构：

1.  **解耦 `Study` 类**：不再硬编码上报逻辑，改为支持注入 `uploadHandler`。
2.  **抽象数据策略**：将“选词”和“上报”逻辑封装为独立的 Hook (`useStudyStrategy`)，UI 组件只负责渲染。
3.  **统一入口**：`StudyView` 根据 URL 参数 `mode` 自动切换策略。

---

## 3. 详细开发步骤

### 第一步：基础服务层改造 (Service & Model)

目标：让底层支持“复习”所需的接口和能力。

1.  **修改 `Study` 类** ([src/services/study/Study.ts](file:///Users/zhangxunwei/vscodeworkspace/baicizhan-helper-web/src/services/study/Study.ts))
    *   构造函数增加可选参数 `onUpload?: (study: Study) => void`。
    *   `complete()` 方法中：如果有 `onUpload` 则调用它，否则保持原有逻辑（调用 `updateDoneData`）。
2.  **修改 `studyService`** ([src/services/studyService.ts](file:///Users/zhangxunwei/vscodeworkspace/baicizhan-helper-web/src/services/studyService.ts))
    *   新增 `updateReviewData` 方法签名（空实现），参数结构复用 `UserDoneWordRecord[]`。

### 第二步：封装学习/复习策略 (Hooks)

目标：将复杂的数据准备逻辑从 UI 中剥离。

1.  **创建 `src/hooks/useStudyStrategy.ts`**
    *   定义统一返回结构：`{ studyInstance, loading, error, init }`。
    *   内部实现两个核心逻辑分支：
        *   **Learn Strategy**: 现有的逻辑（获取 `daily_plan_count` -> 筛选未学 -> `new Study(..., defaultUpload)`）。
        *   **Review Strategy**: 新增逻辑。
            *   获取 `review_plan_count`。
            *   获取 `learnedWords` 并按 `update_days` 降序排序。
            *   **关键点**：遍历筛选出的 `topic_id`，在全局 `wordList` ([src/stores/studyStore.ts](file:///Users/zhangxunwei/vscodeworkspace/baicizhan-helper-web/src/stores/studyStore.ts)) 中找到对应的 `UserRoadMapElementV2` 对象（为了复用 `options`）。
            *   `new Study(reviewWords, (s) => studyService.updateReviewData(...))`。

### 第三步：重构 `StudyView` 组件

目标：让组件回归纯 UI 容器。

1.  **修改 `StudyView.tsx`** ([src/pages/StudyView.tsx](file:///Users/zhangxunwei/vscodeworkspace/baicizhan-helper-web/src/pages/StudyView.tsx))
    *   引入 `useSearchParams` 获取 `mode` 参数。
    *   使用 `useStudyStrategy(mode)` 替代原有的 `useEffect` 初始化逻辑。
    *   保留键盘事件、音频播放、渲染卡片等纯 UI 逻辑。

### 第四步：路由与验证

1.  **入口适配**：确保可以通过 `/study?mode=review` 访问。
2.  **验证点**：
    *   复习模式下是否正确加载了“旧单词”？
    *   复习完成后是否调用了 `updateReviewData`？
    *   原有学习模式是否不受影响？

---

## 4. 待办事项 (TODOs)

- [ ] Modify `Study.ts`: Add `onUpload` callback support.
- [ ] Update `studyService.ts`: Add `updateReviewData` signature.
- [ ] Create `useStudyStrategy.ts`: Implement learn/review data fetching logic.
- [ ] Refactor `StudyView.tsx`: Integrate strategy hook and remove inline init logic.
