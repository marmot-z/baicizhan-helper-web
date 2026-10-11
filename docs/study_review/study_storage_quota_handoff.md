# Handoff：学习页 `study-storage` 配额异常

## 1. Handoff metadata

- **项目**：`baicizhan-helper-web`
- **页面**：`http://localhost:5173/page/study-view`
- **问题**：
  `Failed to execute 'setItem' on 'Storage': Setting the value of 'study-storage' exceeded the quota.`
- **当前状态**：已完成原因定位，尚未实施业务代码修复
- **本轮代码状态**：未保留代码修改
- **诊断日期**：2026-10-11

## 2. 用户可见现象

进入学习页后，页面停留在“正在准备学习内容”，并出现初始化失败提示。控制台堆栈指向 `studyStore.ts` 的持久化写入，以及 `StudyView.tsx` 的初始化流程。

## 3. 已确认的根因

问题发生在 Zustand `persist` 将 `study-storage` 写入浏览器 `localStorage` 时。当前持久化内容包含多个可能随词书规模和学习历史增长的大对象：

- `wordList`：整本词书的路线图
- `learnRecords`：当前词书的全部学习记录
- `homeState`：由路线图和学习记录计算出的多组词书数组
- `lastStudyStatistics` / `lastReviewStatistics`：学习统计数据

其中：

1. `learnRecords` 已经由独立的 `study-record-store` 持久化，存在重复保存。
2. `homeState` 是派生数据，可以由 `wordList` 和 `learnRecords` 重新计算。
3. `wordList` 可以从接口重新加载，不应作为大体量缓存长期放在 `localStorage`。
4. Zustand `persist` 会在每次相关 `set()` 后重新序列化整个 `partialize` 结果，而不是只写发生变化的字段。

学习页初始化路径如下：

```text
StudyView
  -> useStudyStrategy.init()
    -> syncCurrentBookState()
      -> set({ learnRecords })
      -> set({ wordList })
      -> set({ learnRecords, homeState, syncedBookId })
        -> persist('study-storage')
          -> localStorage.setItem()
```

因此，错误虽然显示在学习页，但本质是学习缓存设计导致的浏览器存储超限。

## 4. 代码证据

| 文件 | 位置 | 证据 |
| --- | --- | --- |
| `src/stores/studyStore.ts` | `61-82` | 同步时将本地记录、路线图写入 Zustand 状态 |
| `src/stores/studyStore.ts` | `145-158` | 重新设置完整 `learnRecords` 和派生 `homeState` |
| `src/stores/studyStore.ts` | `394-414` | `study-storage` 持久化了上述大对象 |
| `src/services/study/homeStateCalculator.ts` | `20-70` | `homeState` 遍历整本路线图并复制到多个数组 |
| `src/services/study/recordStore.ts` | `1-80` | 学习记录已经有独立的 `study-record-store` |
| `src/hooks/useStudyStrategy.ts` | `45-55` | 学习初始化首先触发当前词书同步 |
| `src/pages/StudyView.tsx` | `125-143` | 页面进入后调用学习初始化 |

## 5. 临时恢复方式

在确认可以丢弃学习缓存后，可在 `localhost:5173` 对应页面的 DevTools Console 执行：

```js
localStorage.removeItem('study-storage')
```

这会清除当前学习缓存，但按当前代码设计不会直接清除：

- `study-record-store` 中的正式学习记录
- `study-session-store` 中的进行中学习草稿

清理后刷新页面，应用应重新从接口和独立记录库构建学习状态。若浏览器的其他本地存储也已接近配额，还需要在 Application 面板检查同一 `localhost:5173` origin 下的其他 key。

## 6. 推荐解决方案

### P0：缩小 `study-storage` 的职责

将 `partialize` 限制为小型、确实需要跨刷新保留的缓存，例如：

- `currentBook`
- `studyPlan`
- `studyPlans`
- 必要的当日统计摘要

从 `study-storage` 移除：

- `wordList`
- `wordListBookId`
- `learnRecords`
- `homeState`
- `syncedBookId`

这些数据分别可以通过接口、`study-record-store` 和 `calculateHomeState()` 重建。

### P1：避免旧大对象重新进入运行时

当前 `merge` 使用了 `...persisted`。即使后续缩小 `partialize`，旧版本已经写入的巨大对象仍可能被重新合并进状态。

修复时应：

1. 在 `merge` 中只读取允许保留的字段。
2. 提升 persist 版本号。
3. 为旧版本增加迁移逻辑，只迁移小型字段。
4. 确保下一次写入会覆盖旧的巨大 `study-storage` 值。

### P1：持久化失败降级

即使缩小后，也建议对 `QuotaExceededError` 做保护：

- 清理旧的 `study-storage` 缓存并重试一次；或
- 放弃本次缓存写入，但保留内存中的学习状态；
- 不应因为缓存写入失败而让学习初始化失败。

进行中学习的准确恢复仍应由已有的 `study-session-store` 负责，并继续通过 `draftSaveFailed` 向用户提示草稿保存失败。

### P2：需要大体量离线数据时使用 IndexedDB

如果未来要求离线保存整本词书或大量记录，应将这类数据迁移到 IndexedDB，而不是继续扩大 `localStorage`。`localStorage` 适合小型设置和摘要，不适合整本词书缓存。

## 7. 实施顺序

1. 为 `study-storage` 定义明确的轻量持久化类型。
2. 修改 `partialize`，移除路线图、记录映射和派生首页状态。
3. 修改 `merge`，采用字段白名单。
4. 增加 persist 版本和迁移逻辑。
5. 增加配额异常降级处理。
6. 清理本地旧缓存后执行构建和测试。
7. 使用已登录的同一浏览器 origin 验收真实学习流程。

## 8. 验收标准

### 基本流程

- 打开 `/page/study-view` 不再出现 `study-storage exceeded the quota`。
- 学习初始化完成并显示第一张单词卡。
- 刷新页面后，当前日期内的进行中学习草稿仍能恢复。
- 完成学习后，正式学习记录仍能写入 `study-record-store` 并按原流程同步。
- Dashboard、学习统计页和当前词书页仍能通过重新获取的数据正常工作。

### 缓存迁移

- 浏览器中存在旧的巨大 `study-storage` 时，刷新后不会再次因旧值初始化失败。
- 迁移后 `study-storage` 不再包含 `wordList`、`learnRecords` 和 `homeState`。
- 删除 `study-storage` 后，应用能够从接口和记录库恢复必要状态。

### 异常场景

- 模拟 `localStorage.setItem` 抛出 `QuotaExceededError` 时，学习页面仍不应被阻断。
- 草稿存储失败时，仍应设置 `draftSaveFailed` 并展示退出可能丢失进度的提示。

## 9. 当前验证边界

- 已通过源码定位确认错误来自 `study-storage` 的大对象持久化。
- 当前工作区未保留本轮临时修复代码。
- 本次浏览器检查使用的会话未登录，只能确认页面进入登录态，未能完成受保护学习页的真实浏览器验收。
- 因此，实施修复后必须使用已登录的 `localhost:5173` 会话重新验证，不能只以静态构建通过作为功能验收。

## 10. 交接结论

优先修复 `study-storage` 的数据边界，而不是简单扩大浏览器存储配额或反复清理用户数据。核心原则是：

> 进行中学习草稿单独保存；正式学习记录单独保存；路线图和首页状态按需重建；`study-storage` 只保存小型缓存和摘要。

