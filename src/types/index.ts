export interface LoginRequest {
  phoneNum: string;
  smsVerifyCode: string;
}

// 发送验证码请求
export interface SendSmsRequest {
  phoneNum: string;
}

// 发送验证码响应
export interface SendSmsResponse {
  verifyCode: string;
}

// 学习相关类型
export interface Word {
  id: string;
  word: string;
  pronunciation: string;
  meaning: string;
  example: string;
  difficulty: number;
  isLearned: boolean;
  learnedAt?: string;
}

export interface StudyPlan {
  id: string;
  name: string;
  description: string;
  totalWords: number;
  learnedWords: number;
  dailyTarget: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface StudyRecord {
  id: string;
  date: string;
  wordsLearned: number;
  timeSpent: number; // 分钟
  accuracy: number; // 百分比
}

export interface SelectBookPlanInfo {
  book_id: number;
  learned_words_count: number;
  group_id: number;
  daily_plan_count: number;
  review_plan_count: number;
}

export interface UserBookBasicInfo {
  id: number;
  name: string;
  total_words_count: number;
  is_word_course: boolean;
  group_count: number;
  book_flag: number;
  img: string;
  desc: string;
}

export interface BooksInfoResponse {
  books_info: UserBookBasicInfo[];
}

// 用户单词本项目
export interface UserBookItem {
  user_book_id: number;
  book_name: string;
  word_num: number;
  cover: string;
  updated_at: number;
}

// 用户单词本响应
export interface UserBooksResponse {
  user_books: UserBookItem[];
}

// 单词本中的单词详情
export interface UserBookWordDetail {
  topic_id: number;
  book_id: number;
  created_at: number;
  word: string;
  mean: string;
  audio_us: string;
  audio_uk: string;
}

// API响应类型
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  code?: number;
}

// 用户绑定信息类型
export interface UserBindInfo {
  nickname: string;
  openid: string;
  provider: string;
  setNickname: boolean;
  setOpenid: boolean;
  setProvider: boolean;
  setUnionid: boolean;
  unionid: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 通用类型
export interface SelectOption {
  label: string;
  value: string | number;
}

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// 商品信息DTO
export interface GoodsDTO {
  /** 商品ID */
  id: number;
  /** 商品名称 */
  name: string;
  /** 原价（分） */
  price: number;
  /** 实际价格（分） */
  realPrice: number;
  /** 有效天数 */
  effectDays: number;
}

export interface OrderInfoDTO {
  /** 订单号 */
  orderNo: string;
  /** 商品名称 */
  goodsName: string;
  /** 用户名称 */
  username: string;
  /** 用户id */
  userId: number;
  /** 订单状态 */
  state: number;
  /** 付款金额 */
  amount: number;
  /** 付款时间 */
  payTime: string;
  /** 订单开始生效时间 */
  startTime: string;
  /** 订单结束生效时间 */
  endTime: string;
  /** 订单生效时间 */
  effectTime: string;
}

export interface OrderInfoResponse {
  /** 总数 */
  total: number;
  /** 未过滤总数 */
  totalNotFiltered: number;
  /** 订单列表 */
  rows: OrderInfoDTO[];
}

// 日历学习内容相关类型
export interface CalendarDailyWord {
  topic_id: number;
  word: string;
  mean: string;
  accent: string;
  audio_url: string;
  word_level_id: number;
}

export interface CalendarDailyInfo {
  state: number;
  hint: string;
  daily_wod_count: number;
  words: CalendarDailyWord[];
  resign_state: number;
  resign_message: string;
}

// 单词详情相关类型定义
export interface TopicKey {
  topic_id: number;
  word_level_id: number;
  tag_id: number;
}

export interface ZpkInfo {
  topic_key: TopicKey;
  zpk_uri: string;
  zpk_md5: string;
  zpk_size: number;
  zpk_version: number;
}

export interface WordBasicInfo {
  topic_id: number;
  word: string;
  accent_usa: string;
  accent_uk: string;
  accent_usa_audio_uri: string;
  accent_uk_audio_uri: string;
  deformation_img_uri: string;
  etyma: string;
}

export interface MeanInfo {
  id: number;
  topic_id: number;
  mean_type: string;
  mean: string;
  accent_usa: string;
  accent_uk: string;
  accent_usa_audio_uri: string;
  accent_uk_audio_uri: string;
}

export interface SentenceInfo {
  id: number;
  topic_id: number;
  chn_mean_id: number;
  sentence: string;
  sentence_trans: string;
  highlight_phrase: string;
  img_uri: string;
  audio_uri: string;
}

export interface ShortPhraseInfo {
  id: number;
  topic_id: number;
  chn_mean_id: number;
  short_phrase: string;
  short_phrase_trans: string;
  short_phrase_topic_id: number;
}

export interface SynAntInfo {
  syn_ant_id: number;
  topic_id: number;
  chn_mean_id: number;
  syn_ant_topic_id: number;
  syn_ant: string;
}

export interface VariantInfo {
  topic_id: number;
  pl: string;
  pl_topic_id: number;
  third: string;
  third_topic_id: number;
  past: string;
  past_topic_id: number;
  done: string;
  done_topic_id: number;
  ing: string;
  ing_topic_id: number;
  er: string;
  er_topic_id: number;
  est: string;
  est_topic_id: number;
  prep: string;
  prep_topic_id: number;
  adv: string;
  adv_topic_id: number;
  verb: string;
  verb_topic_id: number;
  noun: string;
  noun_topic_id: number;
  adj: string;
  adj_topic_id: number;
  conn: string;
  conn_topic_id: number;
}

export interface WordDictV2 {
  word_basic_info: WordBasicInfo;
  chn_means: MeanInfo[];
  en_means: MeanInfo[];
  sentences: SentenceInfo[];
  short_phrases: ShortPhraseInfo[];
  antonyms: SynAntInfo[];
  synonyms: SynAntInfo[];
  variant_info: VariantInfo;
  exams: string[];
}

export interface DictWiki {
  dict: WordDictV2;
  origin_word: string;
  variant_type: string;
}

export interface WordMedia {
  topic_id: number;
  m4a_audio_path: string;
  amr_audio_path: string;
  tv_path: string;
  tv_snapshot_path: string;
  word: string;
  word_mean_cn: string;
  word_type: string;
  word_sentence: string;
  fm_updated_at: number;
  tv_updated_at: number;
  poster_updated_at: number;
  poster_zpk: string;
}

export interface SimilarWord {
  topic_id: number;
  word_level_id: number;
  word: string;
}

export interface TopicResourceV2 {
  zpk_info: ZpkInfo;
  dict: WordDictV2;
  dict_wiki: DictWiki;
  media: WordMedia;
  similar_words: SimilarWord[];
  collected?: boolean;
}

// 搜索单词结果类型
export interface SearchWordResultV2 {
  word: string;
  topic_id: number;
  mean_cn: string;
  accent: string;
}

// 微信支付相关类型
export interface LTWxpayResponseData {
  /** 微信原生支付链接，此URL用于生成支付二维码，然后提供给用户扫码支付。 */
  code_url: string;
  /** 生成的二维码链接地址 */
  QRcode_url: string;
}

export interface LTWxpayResponseDTO {
  /** 返回状态，枚举值：0：成功，1：失败 */
  code: number;
  msg: string;
  /** 唯一请求ID */
  request_id: string;
  data: LTWxpayResponseData;
}

export interface UserRoadMapElementV2 {
  topic_id: number;
  word_level_id: number;
  tag_id: number;
  options: number[];
}

export interface UserLearnedWordInfo {
  topic_id: number;
  score: number;
  used_time: number;
  wrong_times: number;
  done_times: number;
  span_days: number;
  update_days: number;
  created_at: number;
  spell_score: number;
  listening_score: number;
  chn_score: number;
  review_round: number;
}

// 信用状态接口
export interface CreditStatus {
  inExperiment: boolean;
  reviewCreditObtained: boolean;
  studyCreditObtained: boolean;
}

// X模式单词详情接口
export interface XModeWordDetail {
  resource: Resource;
  wiki: Wiki;
  xModeTopic: XModeTopic;
  similarWordList: SimilarWordItem[];
  collected: boolean;
}

export interface Resource {
  word: Word;
  mnemonic: Mnemonic;
  cnMean: Mean[];
  enMean: Mean[];
  sentences: Sentence[];
  phrases: Phrase[];
  variant: Variant[];
  derivations: Derivation[];
  tvInfo: unknown;
  synonyms: Synonym[];
  antonyms: Synonym[];
  similars: Similar[];
}

export interface Word {
  topicId: number;
  word: string;
  wordSplit: string;
  accentUs: string;
  accentUk: string;
  audioUs: string;
  audioUk: string;
  exam: unknown;
}

export interface Mnemonic {
  type: number;
  content: string;
  imgContent: string;
}

export interface Mean {
  mId: number;
  meanType: string;
  mean: string;
  percent: unknown;
}

export interface Sentence {
  sId: number;
  sentenceEn: string;
  translate: string;
  audio: string;
  audioUK: string;
  image: string;
  origin: unknown;
  phrase: string;
}

export interface Phrase {
  pId: number;
  phrase: string;
  mean: string;
}

export interface Variant {
  vId: number;
  type: string;
  variant: string;
}

export interface Derivation {
  dId: number;
  word: string;
  mean: string;
}

export interface Similar {
  sId: number;
  word: string;
  meanType: string;
  mean: string;
}

export interface Synonym {
  sId: number;
  word: string;
}

export interface Wiki {
  cnMean: CnMeanInfo;
  pages: Page[];
  extension: Extension;
}

export interface CnMeanInfo {
  examOrder: number[];
  meanOrder: string[];
}

export interface Page {
  meanId: number;
  sentenceIds: number[];
}

export interface Extension {
  order: number[];
  bold: unknown[];
}

export interface XModeTopic {
  id: number;
  topicId: number;
  bookId: number;
  chnMean: string;
  sentence: string;
  sentenceTrans: string;
  sentenceAudio: string;
  sentenceImg: string;
  video: string;
  videoImg: string;
  optionChn: OptionChn[];
}

export interface OptionChn {
  text: string;
}

export interface SimilarWordItem {
  topicId: number;
  word: string;
  meanType: string;
  mean: string;
  choose: boolean;
  senId: number;
}

export interface UserDoneWordRecord {
  word_topic_id: number;
  current_score: number;
  span_days: number;
  used_time: number;
  done_times: number;
  wrong_times: number;
  is_first_do_at_today: number;
  tag_id: number;
  spell_score: number;
  listening_score: number;
  chn_score: number;
  review_round: number;
}