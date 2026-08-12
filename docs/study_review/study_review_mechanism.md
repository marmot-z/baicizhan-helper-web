# 百词斩学习与复习机制整理

本文基于当前已逆向得到的 `jadx` 结果整理，目标是回答以下问题：

- 学习的数据如何准备，跨设备的数据如何同步到本地
- 学习完成后数据如何上传到服务端
- 学习的数据如何本地维护，即哪些数据学了以后不用继续学
- 复习的数据如何准备，本地如何维护哪些数据复习了，是否需要继续复习

文中提到的类名、方法名、接口名均来自已逆向出的 Android App 代码。

## 1. 总体结论

学习和复习的核心不是“服务端直接下发今天该学哪些词、该复习哪些词”，而是：

1. 服务端下发学习计划、roadmap、远端已学记录等基础数据。
2. 设备将这些数据和本地 `TopicLearnRecord` 合并。
3. 首页和学习/复习流程基于“本地记录 + 本地 roadmap + 本地计划数”计算出当前状态。

换句话说：

- `unreviewedWords` 不是服务端直接返回的数值，而是本地计算结果。
- `todayLearnedWords` 也不是服务端直接返回的数组，而是本地记录分组结果。
- “某个词今天还要不要学”“某个词后续还要不要复习”，主要由本地 `TopicLearnRecord` 决定。

## 2. 关键数据对象

### 2.1 学习计划

类：

- `z8.n0` / `com.baicizhan.online.user_study_api.SelectBookPlanInfo`

关键字段：

- `book_id`
- `learned_words_count`
- `daily_plan_count`
- `review_plan_count`
- `count_per_round`

用途：

- 决定每日新学数量
- 决定每日复习数量
- 用于首页和学习/复习流程初始化

### 2.2 书籍选中信息

类：

- `z8.a2` / `com.baicizhan.online.user_study_api.UserSelectedBookInfo`

关键字段：

- `book_id`
- `learned_words_count`
- `daily_plan_count`
- `review_plan_count`
- `need_merge_count`
- `roadmap_version`

用途：

- 选书后更新当前书的计划
- 表示是否存在需要合并的历史学习数据

### 2.3 本地学习记录

类：

- `com.baicizhan.client.business.dataset.models.TopicLearnRecord`
- 管理器：`com.baicizhan.client.business.managers.LearnRecordManager`

从 `LearnRecordManager.X()`、`LearnHelper.RecordRsp.fromLocalRecords(...)` 可确认的核心字段：

- `topicId`
- `topicScore`
- `topicDay`
- `isTodayNew`
- `errNum`
- `reviewRound`
- `lastDoTime`
- `doNum`
- `totalTime`
- `extra` 中的听力/拼写/中文分数字段

它是学习与复习状态的本地事实来源。

### 2.4 上传到服务端的记录结构

类：

- `com.baicizhan.online.user_study_api.UserDoneWordRecord`

字段：

- 必填
  - `word_topic_id`
  - `current_score`
  - `span_days`
  - `used_time`
  - `done_times`
  - `wrong_times`
  - `is_first_do_at_today`
- 可选
  - `tag_id`
  - `spell_score`
  - `listening_score`
  - `chn_score`
  - `review_round`

这是本地学习记录上传到服务端时使用的 thrift 结构。

## 3. 学习数据如何准备

### 3.1 本地启动阶段准备的基础数据

`SchedulePrepareObservables` 是启动学习相关状态的主入口之一。

关键类：

- `com.baicizhan.main.rx.SchedulePrepareObservables`

关键步骤：

1. 拉取当前用户和当前学习计划
2. 拉取当前书信息
3. 拉取或刷新 roadmap
4. 加载本地学习记录
5. 在必要时把服务端已学记录同步到本地

相关代码点：

- `SchedulePrepareObservables.N(env)`
  - 调 `user_basic_info_v2()` 拉取当前用户学习信息
- `SchedulePrepareObservables.w(context, bookRecord)`
  - 调 `roadmap_by_word_level_v2(bookId)` 拉取 roadmap
- `LearnRecordManager.W(context, bookId, force)`
  - 触发重新加载本地学习记录
- `LearnRecordManager.X()`
  - 从本地表加载 `topic_obn / topic_day / is_today_new / err_num / review_round / extra`

### 3.2 首页数据准备方式

首页并不是直接拿一个“今日学习列表”接口。

关键链路：

1. `LearnHelper.learnInfoObs()` 组装首页计算输入
2. `LearnHelper.recordObs()` 读取本地 `LearnRecordManager.A().x()`
3. `LearnHelper.roadMapObs()` 读取本地 roadmap
4. `LearnHelper.a(...)` 填入：
   - `learnPlanCount`
   - `reviewPlanCount`
   - `increasedCount`
   - `planCount`
5. `com.baicizhan.main.home.plan.module.exam.a.c(...)`
   调用：

```js
BczBridge.getHomeStateData({
  "records": ...,
  "road": ...,
  "learnPlanCount": ...,
  "reviewPlanCount": ...,
  "increasedCount": ...,
  "settingOptions": ...,
  "mode": ...
})
```

因此首页“今天该学什么、今天该复习什么”的计算输入是：

- 本地 records
- 本地 road
- 学习计划数
- 复习计划数
- 加量信息

而不是服务端直接返回的成品列表。

### 3.3 实际的新学单词抽取逻辑

除了首页 JS 逻辑，新的 game/study 流里还有明确的新词抽取 use case。

关键类：

- `p6.z` / `SelectNewLearningWordsUC`

可直接确认的方法：

- `k(List<Integer> roadmap, Set<Long> learned, int maxCount)`

逻辑：

1. 遍历 roadmap
2. 过滤掉 `learned` 集合中已有的词
3. 取前 `maxCount`
4. 组成待学习词列表

从方法体可直接看出：

- 候选词来源是 roadmap
- 是否已学由 learned 集合决定
- 今日要学多少个由 `maxCount` 决定

这与首页 JS 计算结论一致：本地记录决定哪些词不再属于“新学”。

## 4. 跨设备数据如何同步到本地

### 4.1 同步的本质

跨设备同步不是“设备 A 学过后，设备 B 直接拿到一个今天不用学的列表”。

而是：

1. 设备 A 把自己的学习记录上传到服务端
2. 服务端保存该账号的 done/learned 数据
3. 设备 B 启动时从服务端拉回 learned list
4. 设备 B 将其合并进本地 `TopicLearnRecord`
5. 之后所有“是否已学、是否待复习”的判断继续按本地记录计算

### 4.2 服务端下发已学记录

服务接口：

- `UserStudyApiService.get_learned_words_list`

相关代码证据：

- `UserLearnedWordInfo` 的 xref 指向 `SchedulePrepareObservables`
- `SchedulePrepareObservables.H(env)`
  创建 `/rpc/user_study` thrift client，并进入内部类 `g`
- `SchedulePrepareObservables.g.a(client)`
  在本地记录加载后按版本判断是否调用 `get_learned_words_list(bookId)`
- `LearnRecordManager.Z(List<UserLearnedWordInfo>)`
  明确接收服务端 learned list 并合并进本地

虽然 `Z(...)` 反编译正文缺失，但调用关系和签名已经足够说明它就是“远端已学记录合并到本地”的核心方法。

更完整的准备链路是：

```text
MainTabActivity / ei.p
  -> SchedulePrepareObservables.F(context, requestFlag)
  -> SchedulePrepareObservables.L(context, env)
  -> SchedulePrepareObservables.K(env)
  -> SchedulePrepareObservables.H(env)
  -> SchedulePrepareObservables.g.a(client)
  -> client.get_learned_words_list(bookId)
  -> LearnRecordManager.Z(remoteLearnedWords)
```

其中 `SchedulePrepareObservables.L(...)` 会先通过 `K(env)` 准备当前计划和当前书，再并行执行 `H(env)` 加载/同步学习记录。因此 App 不是在每次进入单词学习时临时问服务端，而是在启动、首页刷新、计划准备、切书后的当前书准备阶段把远端 learned list 合并到本地。

### 4.3 启动时的同步标记

`SchedulePrepareObservables` 在拉 `user_basic_info_v2()` 时还会关注：

- `learn_info.last_sync_done_score_time`

相关代码：

- `SchedulePrepareObservables.b.call(...)`

逻辑：

- `last_sync_done_score_time <= 1` 时，会把某个本地标记置为 `true`
- 说明客户端认为当前设备需要重新关注 done score 同步状态

这进一步证明客户端在启动流程里就把“远端学习记录同步”作为正式步骤之一。

更具体地说，`user_basic_info_v2()` 返回的 `learn_info.last_sync_done_score_time` 会写入当前 `ScheduleRecord.remoteSyncVer`：

```java
scheduleRecord.remoteSyncVer = learn_info.getLast_sync_done_score_time();
```

`ScheduleRecord.localSyncVer` 则映射到本地 schedule 表的 `sync_state` 列：

```java
COLUMN_MAP.put("localSyncVer", "sync_state");
```

`SchedulePrepareObservables.g.a(client)` 会先调用：

```java
LearnRecordManager.A().W(context, bookId, isNewSchedule)
```

加载当前书本地记录，然后比较：

- `ScheduleRecord.localSyncVer`
- `ScheduleRecord.remoteSyncVer`
- 本地 `kv_need_learn_record_list` 标记

触发拉取 learned list 的条件可以概括为：

- `remoteSyncVer > 0`，并且本地版本为空或与远端版本不同
- 或 `kv_need_learn_record_list == true`
- 同时远端版本需要大于初始化占位值 `1`

拉取和合并成功后：

- 调 `LearnRecordManager.Z(remoteLearnedWords)` 合并远端记录
- `localSyncVer = remoteSyncVer`
- 清除 `kv_need_learn_record_list`

### 4.4 跨设备切换触发同步

登录态校验时还会比较：

- `last_device`
- 当前设备 `DeviceUtil.getUniqueID(context)`

相关代码：

- `SchedulePrepareObservables.v.call(...)`
- `gi.e.l(...)`

当当前设备与上次设备不一致时，客户端会把状态判定为另一类设备状态，并触发后续准备流程。虽然这里不是直接调用 `get_learned_words_list`，但说明客户端明确识别“换设备登录”这一场景，并为学习数据重新同步创造条件。

补充确认：

- `ei.p.x(activity)` 会调用 `SchedulePrepareObservables.F(activity, flags)`
- `ei.p.q(...)` 在检测到 device changed 后，会再次以 `REQUEST_REFRESH_SCHEDULE` 类标记触发刷新
- 这会重新进入 `SchedulePrepareObservables` 的计划准备和学习记录同步链路

### 4.5 当前书的数据准备规则

对于学习、复习主流程，不能只依赖“某本书上一次留在本地的缓存记录”。

为了避免以下场景出现陈旧数据问题：

1. 先学习书 A
2. 切换到书 B
3. 再切回书 A
4. 直接使用书 A 上次遗留在本地的旧 records 继续抽词

当前书的数据准备必须遵守这条规则：

1. `load local`
2. `sync remote`
3. `recompute homeState`

也就是：

1. 先读取该 `bookId` 对应的本地 `TopicLearnRecord`
2. 再拉该 `bookId` 的远端 learned 数据并 merge 到本地
3. 再基于同步后的 `records + roadmap + 计划数` 重新计算 `homeState`
4. 学习、复习只能使用这份“当前书已同步”的状态

这条规则不是为 Web 项目临时增加的特殊补丁，而是对 APP 原始机制的还原：

- APP 本来就是基于“本地记录 + roadmap + 必要时远端同步”来准备学习/复习状态
- Web 项目后续也应把“切书或当前书变化时必须重新准备当前书状态”作为固定规则

## 5. 学习完成后如何上传到服务端

### 5.1 上传入口

核心类：

- `com.baicizhan.client.business.managers.LearnRecordManager`

上传逻辑在内部类 `g` 中：

- `g.f(...)` 从本地 syncing 表取待上传记录
- `g.l(...)` 调服务端 `update_done_data`
- `g.g(...)` 上传成功后清理 syncing 表中的已同步记录

调用 `update_done_data` 的完整上传链路是：

```text
LearningActivity / DefaultReviewActivity
  -> LearnRecordManager.s/t/U(...)
  -> LearnRecordManager.a0(topicId)
  -> LearnRecordManager.e.f(...).g(...).c()
  -> LearnRecordManager.e.a.run()
  -> LearnRecordManager.g.e()
  -> LearnRecordManager.g.h(context)
  -> LearnRecordManager.g.j(context, bookId, client)
  -> LearnRecordManager.g.f(context, bookId, 800)
  -> LearnRecordManager.g.l(context, bookId, client, doneRecords)
  -> client.update_done_data(...)
```

其中：

- `s(...)` 表示答对
- `t(...)` 表示答错
- `U(...)` 表示 kill
- `LearnRecordManager.e.c()` 会同时更新内存 map、today-new 集合、total cache、syncing cache，并异步落库
- 落库 runnable `LearnRecordManager.e.a.run()` 结束时会调用 `LearnRecordManager.g.e()` 做自动上传检查

自动上传条件：

- 当前有网络
- 没有正在上传
- 当前书 syncing 表中 `sync_state = 0` 的待上传记录数达到 `50`

显式上传入口还包括：

- 打卡前：`com.baicizhan.main.activity.daka.datasource.g.w(...)`
- 首页/任务流程：`ji.u0.z()`
- 切书/选书前：`kg.u.E(...)`
- 清理前：`rk.e.e(...)`

### 5.2 实际调用的接口

服务：

- `UserStudyApiService.update_done_data`

客户端代码：

- `UserStudyApiService.Client.update_done_data(long, List<UserDoneWordRecord>, int, boolean): int`
- `LearnRecordManager.g.l(Context, int, Client, List<UserDoneWordRecord>)`

完整 thrift 语义可还原为：

```thrift
service UserStudyApiService {
  i32 update_done_data(
    1: i64 last_sync_at,
    2: list<UserDoneWordRecord> arr_done_records,
    3: i32 current_word_level_id,
    4: bool is_today_completed
  ) throws (
    1: SystemException boom,
    2: LogicException bomb
  )
}
```

App 端实际调用参数为：

```java
long version = TimeUtil.currentTimeSeconds();
client.update_done_data(version, doneRecords, bookId, false);
```

因此四个 thrift 业务参数分别是：

- `last_sync_at`：当前秒级时间戳
- `arr_done_records`：从 syncing 表读取并映射出的待上传记录
- `current_word_level_id`：当前 `bookId`
- `is_today_completed`：`false`

### 5.3 实际 URL

thrift 传输层 URL 模板：

- `com.baicizhan.client.business.thrift.a`
- 模板：`"%s%s/%s/%d"`

对 `/rpc/user_study` 来说，默认 host：

- `https://learn.baicizhan.com`
- `https://learn.bczeducation.cn`

因此 `update_done_data` 的实际请求路径为：

```text
POST https://learn.baicizhan.com/rpc/user_study/update_done_data/{System.currentTimeMillis()}
Content-Type: application/x-thrift
```

示例：

```text
https://learn.baicizhan.com/rpc/user_study/update_done_data/1776776105047
```

注意：URL 最后的时间戳来自 thrift transport 层，使用的是 `System.currentTimeMillis()` 级别的毫秒时间戳。它不是 `update_done_data` 的第一个业务参数；第一个业务参数由 `TimeUtil.currentTimeSeconds()` 生成，是秒级同步版本。

### 5.4 上传内容如何从本地记录映射

关键代码：

- `LearnRecordManager.g.d.map(TopicLearnRecord t) -> UserDoneWordRecord`
- `LearnRecordManager.g.f(context, bookId, 800)`
  从当前书 syncing 表读取：

```sql
sync_state = 0 LIMIT 800
```

映射关系：

- `word_topic_id <- topicId`
- `current_score <- topicScore`
- `span_days <- topicDay`
- `wrong_times <- errNum`
- `done_times <- doNum`
- `is_first_do_at_today <- isTodayNew`
- `used_time <- totalTime`
- `tag_id <- tagId`
- `review_round <- reviewRound`
- `spell_score <- total record.extra.ss`
- `listening_score <- total record.extra.ls`
- `chn_score <- total record.extra.ms`

这说明上传不是临时拼接，而是严格从本地 `TopicLearnRecord` 派生。

上传成功后的本地处理：

1. `LearnRecordManager.g.i(context, bookId, version)`
   - 更新当前内存 `ScheduleRecord.remoteSyncVer`
   - 更新本地 schedule 表 `sync_state = version`
2. `LearnRecordManager.g.g(context, bookId, doneRecords)`
   - 提取已上传的 `word_topic_id`
   - 从 syncing 表删除对应 topic
3. 如果当前内存中的 `ScheduleRecord.bookId == bookId`
   - 更新 `ScheduleRecord.localSyncVer = version`

这意味着 App 的上传语义是“先写本地 pending/syncing 队列，再批量上传，成功后清 pending”，而不是每次做完一题就直接把当前题目对象发给服务端。

## 6. 学习数据如何本地维护

### 6.1 本地记录加载与缓存

核心类：

- `LearnRecordManager`

关键字段：

- `f16383d: Map<Integer, TopicLearnRecord>`

关键方法：

- `L()` 返回整张本地记录 map
- `J(topicId)` 返回某词的本地记录
- `Q(topicId)` 判断某词是否没有本地记录
- `X()` 从本地表加载记录到内存 map

结论：

- App 内判断“某词是否已学/是否需要继续学”时，优先依据本地 map

### 6.2 做题后的本地写回

关键方法：

- `s(topicId, useTimeMillis, tagId, reviewMore)`
  - 答对
- `t(topicId, useTimeMillis, tagId)`
  - 答错
- `U(topicId, useTimeMillis, tagId)`
  - kill
- `u(topicId)`
  - 某些场景下把高分词降回 3
- `Y(topicId)`
  - 将高于 4 的分数拉回到 4

核心更新字段包括：

- `topicScore`
- `topicDay`
- `isTodayNew`
- `doNum`
- `errNum`
- `lastDoTime`
- `reviewRound`
- `extra`

这些更新会同时写：

- total 表
- syncing 表
- 内存缓存 map

### 6.3 哪些词学了以后不用继续学

首页/计划计算时的核心分组规则已经确认：

- `record == null` 或 `score == -1024`
  - `unlearnedWords`
- `todayNew == true`
  - `todayLearnedWords`
- `!todayNew && score in [0,4]`
  - `unreviewedWords`
- `!todayNew && score > 4`
  - `reviewedWords`

这意味着：

1. 一个词只要已经产生本地记录，就不再是“完全没学过”的状态。
2. 如果它仍是 `todayNew == true`，它会被归到“今天已新学”。
3. 如果它已经脱离 `todayNew`，但分数仍在 `0..4`，它不会再进入“新学”，而会进入待复习池。
4. 只有达到更高掌握度后，才会被归到 `reviewedWords`。

因此，“学了以后不用继续学”的准确含义不是“永远消失”，而是：

- 不再属于 `unlearnedWords`
- 后续会转入复习链路，直到掌握度足够高

## 7. 复习数据如何准备

### 7.1 复习不是单独的服务端成品列表

首页复习数据同样来源于本地计算。

关键链路：

- `LearnHelper.RecordRsp.fromLocalRecords(...)`
- `ExamJsBridge.c(records, roadMap, ...)`
- `BczBridge.getHomeStateData(...)`

在 JS 分组逻辑里直接产出：

- `todayLearnedWords`
- `unreviewedWords`
- `todayReviewedWords`
- `reviewedWords`

并且：

- `round = 0` 的复习池数量就是 `unreviewedWords.length`

所以“今天有哪些词要复习”并不是服务端单独给的 `review list`，而是本地按 records 分组出来的。

### 7.2 复习池的核心判定

复习相关最重要的分组规则：

- 非 `todayNew`
- `score in [0,4]`

满足这两个条件的词，会进入：

- `unreviewedWords`

这就是首页的待复习池。

### 7.3 复习计划数量的来源

数量上限仍由学习计划提供：

- `SelectBookPlanInfo.review_plan_count`

但真正哪些词进入复习候选池，仍由本地记录决定。

## 8. 复习如何本地维护，复习后是否还需要继续复习

### 8.1 本地维护方式与学习共用一套记录

复习没有单独的“复习记录表结构”，而是继续更新同一套 `TopicLearnRecord`：

- `topicScore`
- `topicDay`
- `reviewRound`
- `errNum`
- `lastDoTime`
- `doNum`

相关方法仍然是 `LearnRecordManager.s/t/U/...` 这一套。

### 8.2 reviewRound 的维护

`LearnRecordManager.e.f(...)` 会从做题过程中的 `problemProxy` 里取：

- `topicScore`
- `reviewRound`

并写回 total/syncing record。

说明：

- 复习轮次是本地记录的重要组成部分
- 复习后是否还需要继续复习，不仅和分数有关，也和轮次有关

### 8.3 复习后是否继续复习

从已确认规则可得：

- 如果词仍满足 `!todayNew && score in [0,4]`
  - 仍属于 `unreviewedWords`
  - 说明还需要继续复习
- 如果分数进一步提升到 `>4`
  - 会进入 `reviewedWords`
  - 说明它已脱离当前待复习池

因此复习是否结束，本质由本地 `topicScore` 的区间决定。

### 8.4 跨天时的本地修正

`LearnRecordManager.n()` 会在跨天时更新离线状态；
`LearnRecordManager.d0()` 会根据 `topicDay` 和 `topicScore` 修正部分词的分数：

- `topic_day > 0 && topic_day < 8 && topic_score < 3`
  - 调整为 `3`
- `topic_day > 7 && topic_score < 4`
  - 调整为 `4`

这说明：

- 复习状态不是一次性写死
- 跨天后客户端会按天数和掌握度对本地状态做修正

## 9. 结合项目实现时的启示

对于当前 `baicizhan-helper-web` 项目，如果要尽量贴近原 App 逻辑，建议按下面的建模思路实现：

1. 本地保存 `TopicLearnRecord` 等价结构，而不是只保留“今天学了几个”的统计缓存。
2. roadmap 作为学习与复习候选全集。
3. 学习页面和复习页面都基于“roadmap + 本地 record”派生数据。
4. 首页展示值如：
   - `todayLearnedWords`
   - `unreviewedWords`
   - `reviewedWords`
   均通过本地分组计算，不直接依赖成品接口。
5. 做题后先写本地 record，再决定：
   - 首页状态怎么变
   - 哪些词退出新学
   - 哪些词进入复习
   - 哪些词可以从待复习池移出
6. 与服务端同步时：
   - 上传：`update_done_data`
   - 下行：`get_learned_words_list`
   - 必要时做历史书目/升级书目的 merge

## 10. 最终结论

学习与复习的真实模型可以概括为一句话：

> 服务端负责提供计划、roadmap、远端已学记录与接收 done 数据；客户端负责把这些信息落到本地 `TopicLearnRecord`，并基于本地记录计算今天学什么、今天复习什么、哪些词已经不用继续新学、哪些词仍需要继续复习。

因此，当前项目如果要对齐原 App，最重要的不是继续寻找“成品接口”，而是把本地学习记录模型、分组计算模型以及上传/下行同步链路实现完整。

## 11. 当前项目需要补充的逻辑方案

本节基于本文档前述 APP 实现机制，并结合当前 `baicizhan-helper-web` 项目的已有实现，整理出建议的补充方案。

目标不是做一个“接口驱动的简化版学习页”，而是把当前项目补成“本地学习记录驱动、与 APP 使用相同 API 完成同步与上报”的实现。

### 11.1 第一阶段：补齐本地学习记录模型

当前项目最关键的缺口，是还没有把本地学习记录作为一等数据源。

建议新增本地记录模型，字段至少覆盖：

- `topicId`
- `topicScore`
- `topicDay`
- `isTodayNew`
- `errNum`
- `reviewRound`
- `lastDoTime`
- `doNum`
- `totalTime`
- `tagId`
- `spellScore`
- `listeningScore`
- `chnScore`

建议新增本地记录仓库，例如：

- `src/services/studyRecordService.ts`
- 或 `src/services/study/recordStore.ts`

职责：

- 读取某个词的本地记录
- 读取某本书的全部本地记录
- 写入/更新本地记录
- 将远端 learned list 合并到本地记录

本地存储方式第一版可以使用：

- `zustand persist`
- `localStorage`

但对外暴露的接口应尽量接近 APP 中 `LearnRecordManager` 的职责。

### 11.2 第二阶段：补齐首页状态计算器

当前项目首页仍以“会话统计”为主，不是 APP 的实现方式。

建议新增独立纯函数模块，例如：

- `src/services/study/homeStateCalculator.ts`

输入：

- 本地 `records`
- 本地 `roadmap`
- `learnPlanCount`
- `reviewPlanCount`
- `increasedCount`

输出至少包含：

- `unlearnedWords`
- `todayLearnedWords`
- `unreviewedWords`
- `reviewedWords`
- `todayReviewedWords`
- `reviewingPoolCount`

规则直接按 APP 文档实现：

- 无记录或 `score == -1024` -> `unlearnedWords`
- `todayNew == true` -> `todayLearnedWords`
- 非 `todayNew` 且 `score in [0,4]` -> `unreviewedWords`
- 非 `todayNew` 且 `score > 4` -> `reviewedWords`

这样首页“今日已新学”“今日已复习”“是否可复习”“复习池数量”等信息，就可以统一从 `homeState` 读取。

### 11.3 第三阶段：学习抽词改为本地状态驱动

当前项目学习页初始化主要依赖远端 `learnedWords`，这与 APP 不一致。

需要修改：

- `src/hooks/useStudyStrategy.ts`

当前问题：

- 通过 `studyService.getLearnedWords(bookId)` 直接得到已学词集合
- 再从 roadmap 中把不在该集合里的词当成未学词

这套逻辑过于粗糙，无法表达：

- `todayNew`
- `score == -1024`
- 已脱离新学但进入待复习池

应改为：

1. 先基于本地 `records + roadmap` 计算出 `homeState`
2. 学习入口从 `homeState.unlearnedWords` 取前 `daily_plan_count`

这样才能对齐 APP 的新词选择语义。

### 11.4 第四阶段：复习抽词改为待复习池驱动

当前项目复习初始化逻辑同样偏离 APP。

需要修改：

- `src/services/review/reviewService.ts`

当前问题：

- 使用 `/learnedWords`
- 按 `done_times` 排序
- 截取 `review_plan_count`

APP 的核心逻辑不是这样，而是：

- 先本地分组出 `unreviewedWords`
- `round = 0` 时，复习池就是 `unreviewedWords`

因此应改为：

1. 从本地 `homeState.unreviewedWords` 取词
2. 按 `review_plan_count` 控制本轮复习数量
3. 后续如果需要，再补 `reviewRound` 参与筛选

### 11.5 第五阶段：补齐学习过程中的本地写回

当前项目学习过程只做了统计，没有真正维护 APP 那套本地记录。

需要重点修改：

- `src/services/study/Study.ts`

建议在以下行为中更新本地 record：

- 答对
- 答错
- 单词完成
- 复习完成

至少要维护这些字段：

- `topicScore`
- `topicDay`
- `isTodayNew`
- `errNum`
- `reviewRound`
- `lastDoTime`
- `doNum`
- `totalTime`

建议抽出独立函数，例如：

- `applyStudyCorrect(record, payload)`
- `applyStudyWrong(record, payload)`
- `applyReviewCorrect(record, payload)`
- `applyReviewWrong(record, payload)`

这样可以把本地状态维护与页面渲染逻辑解耦。

### 11.6 第六阶段：上传逻辑改为从本地 record 映射

当前项目上传 `doneRecords` 时大量字段写死为默认值，这与 APP 明显不一致。

需要修改：

- `src/services/study/Study.ts`
- `src/hooks/useStudyStrategy.ts`
- `src/services/studyService.ts`
- `src/services/review/reviewService.ts`

原则：

- 先维护本地 `TopicLearnRecord` 等价结构
- 再从本地 record 映射生成 `UserDoneWordRecord`
- 使用与 APP 相同语义的 `update_done_data` 完成上传

字段映射应与 APP 保持一致：

- `word_topic_id <- topicId`
- `current_score <- topicScore`
- `span_days <- topicDay`
- `used_time <- totalTime`
- `done_times <- doNum`
- `wrong_times <- errNum`
- `is_first_do_at_today <- isTodayNew`
- `review_round <- reviewRound`
- `tag_id / spell_score / listening_score / chn_score` 也应一并带上

此外，当前复习完成后的上传还是空实现，也需要补齐。

### 11.7 第七阶段：跨设备同步改为“先合并本地，再参与计算”

当前项目虽然已有获取已学词的接口封装，但还缺少“远端数据合并进本地记录”的关键步骤。

需要在学习数据初始化流程中补齐：

1. 拉学习计划
2. 拉 roadmap
3. 拉远端 learned 数据
4. 把远端 learned 数据 merge 到本地 record
5. 重算本地 `homeState`

不要继续让页面逻辑直接把 `/learnedWords` 当最终事实源。

正确方式应接近 APP：

- 远端 learned 数据只作为同步来源
- 同步完成后，以本地 `record store` 为准

### 11.8 第八阶段：补齐跨天维护逻辑

如果没有跨天维护，本地状态很快会与 APP 行为拉开。

建议新增模块，例如：

- `src/services/study/dayTransition.ts`

职责：

- 判断是否跨天
- 推进 `topicDay`
- 重置或迁移 `isTodayNew`
- 必要时修正 `topicScore`

这会直接影响：

- 今天哪些词还算“今日已新学”
- 哪些词进入待复习池
- 哪些词已经脱离复习池

### 11.9 第九阶段：把 UI 层全部切到本地状态驱动

在以上基础完成后，UI 层应统一切换到本地状态驱动。

建议改造方向：

- `src/pages/Dashboard.tsx`
  - 书籍总进度仍可读服务端 `studyPlan`
  - 今日新学、今日复习、复习池数量应读本地 `homeState`
- `src/pages/StudyView.tsx`
  - 初始化依赖本地学习状态
- `src/pages/review/ReviewPage.tsx`
  - 初始化依赖 `unreviewedWords`

这样 UI 层就不再直接承担学习/复习规则判断，而只消费本地状态。

### 11.10 调整后的执行计划

为了同时满足以下目标：

- 先构建基础，不影响现有逻辑
- 后续每一步都可测试、验证通过再进入下一步
- 保留一套本地 `store / record store` 作为学习、复习事实源
- 改动范围只限定在学习、复习两个功能内部
- 不调整原有 UI 交互、页面流转、事件上报逻辑

建议将实施方案改成“两阶段 + 领域边界约束”的形式。

两大阶段：

1. 基础建设阶段
2. 渐进切换阶段

核心原则：

- 第一阶段只新增接口、结构体、计算器、仓库封装，不替换现有逻辑
- 第二阶段每次只切换一小块学习/复习领域逻辑，并确保这一步可独立测试
- 本地 `store` 是必要建设，但它只服务学习/复习数据准备、抽词、写回、上传，不主动接管其他页面展示
- 只有当前一步验证通过，才进入下一步

硬性边界：

- 不改 `StudyView`、`ReviewPage`、`Dashboard` 的现有 UI 交互方式
- 不改学习、复习现有页面流转和入口时机
- 不改现有事件上报调用点与语义
- 不对非学习/复习模块做顺带重构
- 如果某一步需要影响 UI 展示，必须放到学习/复习主流程稳定之后，且作为独立步骤处理

### 11.11 第一阶段：基础建设，不影响现有功能

这一阶段的目标是把后续改造所需的基础设施准备好，但不改变当前学习和复习行为。

这一阶段允许新增一套本地 `store / record store`，但它只作为新逻辑的准备层存在，不直接接管现有页面行为。

#### Step 1：补齐本地学习记录类型定义

建议新增：

- `TopicLearnRecord` 等价前端结构
- `HomeState` 结构
- 学习/复习过程中的 record 更新输入结构

建议位置：

- `src/types/studyRecord.ts`
- 或 `src/services/study/types.ts` 中拆分子模块

这一步不修改任何现有逻辑，只补类型定义。

验证方式：

- TypeScript 编译通过
- 不影响现有页面行为

#### Step 2：补齐本地 record store 接口

建议新增：

- `studyRecordService` 或 `recordStore`

对外暴露的方法建议包括：

- `getAllRecords(bookId)`
- `getRecord(bookId, topicId)`
- `upsertRecord(bookId, record)`
- `upsertRecords(bookId, records)`
- `mergeRemoteLearnedWords(bookId, remoteWords)`
- `clearRecords(bookId)`

第一版实现可以先用本地持久化存储，但暂时不要接入现有学习/复习流程。

这里保留一套本地 `record store` 是必要的，因为后续学习、复习的抽词都要以它为事实源；但第一阶段只建设，不替换现有逻辑。

验证方式：

- 可以通过单元测试或临时调试脚本写入/读取 record
- 不影响当前 `useStudyStrategy`、`reviewService` 行为

#### Step 3：补齐学习/复习状态计算器

建议新增：

- `src/services/study/homeStateCalculator.ts`

内容：

- 输入 `records + roadmap + learnPlanCount + reviewPlanCount + increasedCount`
- 输出 `HomeState`

规则完全按 APP 文档实现。

注意：

- 这一步先只提供纯函数
- 当前主要服务学习、复习抽词和本地状态维护
- 不接管 `Dashboard` 现有展示逻辑

验证方式：

- 写纯函数单测
- 构造输入数据，验证：
  - `unlearnedWords`
  - `todayLearnedWords`
  - `unreviewedWords`
  - `reviewedWords`
  - `todayReviewedWords`
  - `reviewingPoolCount`
  是否符合预期

#### Step 4：补齐本地 record 更新器

建议新增：

- `applyStudyCorrect`
- `applyStudyWrong`
- `applyReviewCorrect`
- `applyReviewWrong`
- `applyDayTransition`

建议位置：

- `src/services/study/recordReducers.ts`

注意：

- 这一步仍然不替换 `Study.ts` 的现有行为
- 只是把 APP 的本地维护规则先落成纯函数

验证方式：

- 对每个 reducer 写输入输出测试
- 验证字段变化是否符合 APP 文档

#### Step 5：补齐上传映射器

建议新增：

- `toUserDoneWordRecord(record: TopicLearnRecord): UserDoneWordRecord`

建议位置：

- `src/services/study/uploadAdapter.ts`

注意：

- 先做结构映射
- 暂不接管当前 `updateDoneData` 的调用点

验证方式：

- 单元测试验证映射字段与 APP 文档一致

到这里为止，第一阶段结束。此时项目行为不变，但后续切换所需的基础模块已经齐全。

### 11.12 第二阶段：渐进切换，每一步都可验证

第二阶段开始真正调整学习和复习流程，但每一步只切换一部分领域逻辑。

这一阶段默认只改：

- 学习初始化与抽词
- 学习过程中的本地写回
- 学习上传
- 复习初始化与抽词
- 复习过程中的本地写回
- 复习上传
- 学习/复习所需的同步与跨天维护

这一阶段默认不改：

- `Dashboard` 展示逻辑
- `StudyView`、`ReviewPage` 的交互和跳转
- 事件上报调用点

#### Step 6：在本地 store 中引入 learnRecords 和 homeState，但仅服务学习/复习领域

修改：

- `src/stores/studyStore.ts`

新增状态：

- `learnRecords`
- `homeState`
- `fetchLearnRecords`
- `mergeRemoteLearnRecords`
- `recomputeHomeState`

注意：

- 先让 store 能加载并维护这些数据
- 这套状态先只供学习/复习逻辑读取
- 暂时不改 `Dashboard`、`StudyView`、`ReviewPage`

验证方式：

- 启动后 store 中可看到：
  - roadmap
  - learnRecords
  - homeState
- 页面行为暂时保持不变

#### Step 7：接入远端 learned 数据到本地记录

修改：

- `studyStore.fetchStudyData()`
- 或新增专门的学习/复习初始化同步流程

流程：

1. 拉 `getBookPlanInfo`
2. 拉 `getRoadmap`
3. 拉远端 learned 数据
4. merge 到本地 record store
5. 计算 homeState

这里需要再明确一条当前书规则：

- 每次 `currentBook` 或 `studyPlan.book_id` 变化时
- 必须执行一次该书的 `load local -> sync remote -> recompute homeState`
- 学习、复习后续只能读取这份当前书的同步结果

这样切换到新书、再切回旧书时，不会直接使用旧书上一次遗留在本地的陈旧缓存。

注意：

- 先只做同步，不切换学习/复习选词逻辑
- 同步结果先只服务学习/复习后续切换，不影响现有页面展示

验证方式：

- 切换设备或清空本地后重新登录
- 确认远端已学词被合并到本地 records
- `homeState` 已能反映同步结果

#### Step 8：切换学习抽词逻辑

修改：

- `src/hooks/useStudyStrategy.ts`

切换方式：

- 当前逻辑保留作为 fallback
- 增加新逻辑，从 `homeState.unlearnedWords` 选词
- 验证通过后删除旧逻辑

注意：

- 这是第一次真正影响学习流程
- 只替换内部抽词逻辑，不改现有 UI 交互、页面流转、事件上报
- 切换后要重点验证“已学词不会再进入新学”

验证方式：

- 有本地记录的词不再进入新学
- `todayNew` 词不会重复进入新学
- 未学词仍按计划数正常进入学习

#### Step 9：把学习过程中的本地写回接入 Study

修改：

- `src/services/study/Study.ts`

切换内容：

- 在正确/错误/完成节点调用 record reducer
- 同步更新本地 record store
- 每次写回后重算 `homeState`

注意：

- 先接本地写回
- 暂时仍可保留旧上传逻辑，避免一次改太多
- 不改答题页现有交互与事件触发点

验证方式：

- 学完一个词后，本地 record 正确更新
- `homeState` 中相关分组随之正确变化

#### Step 10：切换学习上传逻辑

修改：

- `Study.ts`
- `studyService.ts`

切换内容：

- 不再直接拼默认值 `UserDoneWordRecord`
- 改为从本地 `TopicLearnRecord` 映射生成上传结构
- 使用与 APP 一致的 `update_done_data` 语义完成上传

注意：

- 不改上传时机和原有事件上报调用点

验证方式：

- 上传 payload 字段符合预期
- 学习完成后服务端状态正常更新
- 刷新或跨设备后可同步回来

#### Step 11：切换复习抽词逻辑

修改：

- `src/services/review/reviewService.ts`

切换内容：

- 从 `homeState.unreviewedWords` 取复习词
- 按 `review_plan_count` 控制数量
- 保留旧逻辑作为 fallback，验证通过后再移除

验证方式：

- 只有待复习池中的词进入复习
- 已掌握词不会误进复习
- 新学词不会误进复习

#### Step 12：接入复习过程中的本地写回

修改：

- `ReviewFlow`
- `reviewService`
- 相关页面状态

切换内容：

- 复习答对/答错后，更新本地 record
- 更新 `topicScore / reviewRound / errNum / totalTime`
- 重算 `homeState`

注意：

- 只替换复习内部状态维护
- 不改复习页现有交互、流转与事件上报

验证方式：

- 复习后词可以移出待复习池
- 仍需继续复习的词留在池中
- `homeState` 中复习相关分组即时更新

#### Step 13：切换复习上传逻辑

修改：

- `reviewService.finishReview`
- `studyService.updateReviewData`

切换内容：

- 改为从本地 record 映射上传数据
- 使用与 APP 一致的上报语义

注意：

- 不改原有上传触发点与事件上报逻辑

验证方式：

- 复习完成后服务端状态正常更新
- 跨设备可同步到相同复习状态

#### Step 14：补齐跨天维护

修改：

- 新增 `dayTransition` 模块
- 在应用启动或学习数据初始化时执行

切换内容：

- 推进 `topicDay`
- 重置/迁移 `isTodayNew`
- 修正部分 `topicScore`

这一步建议放在最后，因为它影响全局状态较大。

验证方式：

- 手动构造跨天数据验证
- 次日复习池和学习可选词状态符合 APP 规则

### 11.13 推荐的验证节奏

每一步进入下一步之前，建议至少完成以下验证之一：

- 单元测试通过
- 本地手动验证通过
- 与现有线上接口联调通过

推荐顺序：

1. 先验证纯函数和本地仓库
2. 再验证 store 数据可用
3. 再切学习流程
4. 再切学习上传
5. 再切复习流程
6. 最后补跨天逻辑

补充要求：

- 每一步优先验证“学习/复习功能结果是否正确”
- 不以首页展示是否同步切换作为本阶段阻塞条件
- 若某一步需要动 UI 或页面流转，需单独评审，不默认纳入本轮

### 11.14 调整后的最小可执行顺序

如果只保留最小但可落地的步骤，可以归纳成下面这条链：

1. 新增类型与结构定义
2. 新增本地 record store
3. 新增 `homeStateCalculator`
4. 新增 record reducer 与 upload adapter
5. store 接入 `learnRecords + homeState`
6. 同步远端 learned 数据到本地
7. 学习选词切到 `unlearnedWords`
8. 学习过程接入本地写回
9. 学习上传切到本地 record 映射
10. 复习选词切到 `unreviewedWords`
11. 复习过程接入本地写回与上传
12. 最后补跨天维护

这种执行方式能够满足：

- 第一阶段不影响现有功能
- 第二阶段每一步都能独立验证
- 保留本地 `store` 作为学习、复习的事实源
- 改动范围集中在学习、复习领域内部
- 不默认修改 UI、页面流转、事件上报
- 每一步验证通过后再继续下一步
