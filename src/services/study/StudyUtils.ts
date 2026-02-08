import type { StudyWord, StudyOption, StudyUIModel, StudyMedia, StudyAccent, StudySentence, StudyMean, StudyPhrase, StudyVariant, StudyRelatedWord } from './types';
import type { TopicResourceV2, UserRoadMapElementV2, XModeWordDetail, SimilarWordItem, Mean } from '../../types';
import {bookService} from '../bookService'

/**
 * StudyUtils - 背单词功能的工具类
 * 提供生成选项、转换数据格式等辅助功能
 */
export class StudyUtils {
  public static optionsCache: Map<number, StudyOption[]> = new Map();
  public static getRandomizedOptions(topicId: number): StudyOption[] | undefined {
    const options = this.optionsCache.get(topicId);
    if (!options) return undefined;

    const shuffled = [...options];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }
  public static getCachedOptions(topicId: number): StudyOption[] | undefined {
    return this.optionsCache.get(topicId);
  }
  public static setCachedOptions(
    topicId: number,
    options: StudyOption[]
  ): void {
    this.optionsCache.set(topicId, options);
  }
  public static async loadOptionsForTopic(
    word: UserRoadMapElementV2,
    uiModel: StudyUIModel
  ): Promise<StudyOption[]> {
    const words: TopicResourceV2[] = await Promise.all(
      word.options.map((id) =>
        bookService.getWordDetail(id, true, false, false)
      )
    );
    const options: StudyOption[] = words
      .map((item) => ({
        id: item.dict.word_basic_info.topic_id,
        word: item.dict.word_basic_info.word,
        translation:
          item.dict.chn_means[0]?.mean_type + item.dict.chn_means[0]?.mean,
        isCorrect: false,
      }))
      .concat([
        {
          id: uiModel.topicId,
          word: uiModel.word,
          translation: uiModel.front.chnMean,
          isCorrect: true,
        },
      ]);
    this.optionsCache.set(word.topic_id, options);
    return options;
  }

  /**
   * 将 XModeWordDetail 转换为 UI 优化的 StudyUIModel
   * @param detail XMode 单词详情
   * @param collected 是否已收藏
   * @returns StudyUIModel
   */
  public static adaptXModeToUIModel(
    detail: XModeWordDetail,
    collected: boolean = false
  ): StudyUIModel {
    const { resource, xModeTopic } = detail;
    const { word } = resource;

    // 1. FrontCard - Media
    let media: StudyMedia | null = null;
    if (xModeTopic?.video) {
      media = {
        type: 'video',
        url: xModeTopic.video,
        poster: xModeTopic.videoImg || '',
      };
    } else if (xModeTopic?.sentenceImg) {
      media = {
        type: 'image',
        url: xModeTopic.sentenceImg,
      };
    } else if (resource.sentences?.[0]?.image) {
      // Fallback to first sentence image
      media = {
        type: 'image',
        url: resource.sentences[0].image,
      };
    }

    // 2. FrontCard - Accent
    const accent: StudyAccent = {
      us: word.accentUs || '',
      uk: word.accentUk || '',
      usAudio: word.audioUs || '',
      ukAudio: word.audioUk || '',
    };

    // 3. BackCard - Sentences
    const sentences: StudySentence[] = [];
    // Priority 1: XModeTopic sentence
    if (xModeTopic?.sentence) {
      sentences.push({
        en: xModeTopic.sentence,
        cn: xModeTopic.sentenceTrans || '',
        audio: xModeTopic.sentenceAudio || '',
        img: xModeTopic.videoImg || xModeTopic.sentenceImg || '',
        highlightPhrase: '', // XModeTopic doesn't seem to have highlight phrase
      });
    }
    // Priority 2: Resource sentences
    if (resource.sentences) {
      resource.sentences.forEach((s) => {
        // Avoid duplicate if same as xModeTopic (simple check)
        if (s.sentenceEn !== xModeTopic?.sentence) {
          sentences.push({
            en: s.sentenceEn,
            cn: s.translate,
            audio: s.audio || s.audioUK,
            img: s.image,
            highlightPhrase: s.phrase,
          });
        }
      });
    }

    // 4. BackCard - Means
    const cnMeans: StudyMean[] = resource.cnMean
      ? resource.cnMean.map((m) => ({
          type: m.meanType,
          text: m.mean,
        }))
      : [];

    // 5. Extensions
    const enMeans: StudyMean[] = resource.enMean
      ? resource.enMean.map((m) => ({
          type: m.meanType,
          text: m.mean,
        }))
      : [];

    // Helper to flatten variants
    const variants: StudyVariant[] = [];
    if (resource.variant && resource.variant.length > 0) {
      resource.variant.forEach((v: any) => {
        if (v && v.type) {
          variants.push({
            label: v.type,
            word: v.variant || '',
          });
        }
      });
    }

    const phrases: StudyPhrase[] = ((resource as any).phrases || []).map(
      (p: any) => ({
        phrase: p.phrase || '',
        cn: p.mean || '',
      })
    );

    // Synonyms / Antonyms / Similars
    // Type assertion or safe access
    const res: any = resource || {};
    const synonyms: StudyRelatedWord[] = (res.synonyms || []).map((s: any) => ({
      word: s.word || '',
      topicId: s.sId,
    }));
    const antonyms: StudyRelatedWord[] = (res.antonyms || []).map((a: any) => ({
      word: a.word || '',
      topicId: a.sId,
    }));
    const similars: StudyRelatedWord[] = (res.similars || []).map((s: any) => ({
      word: s.word || '',
      topicId: s.sId,
    }));

    return {
      topicId: word.topicId,
      word: word.word,
      collected: collected,
      front: {
        media,
        accent,
        options: [], // To be filled by lazy loader
        chnMean: xModeTopic?.chnMean || '',
      },
      back: {
        cnMeans,
        sentences,
        mnemonic: resource.mnemonic,
      },
      extensions: {
        enMeans,
        phrases,
        variants,
        synonyms,
        antonyms,
        similars,
      },
    };
  }
}
