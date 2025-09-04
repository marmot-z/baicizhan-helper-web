import type { StudyWord } from './types';
import type { TopicResourceV2, UserRoadMapElementV2 } from '../../types';
import {bookService} from '../bookService'

/**
 * StudyUtils - 背单词功能的工具类
 * 提供生成选项、转换数据格式等辅助功能
 */
export class StudyUtils {
  
  public static async fetchWordInfo(word: UserRoadMapElementV2) : Promise<StudyWord> {
    const data: TopicResourceV2 = await bookService.getWordDetail(word.topic_id, true, false, true);
    const words: TopicResourceV2[] = await Promise.all(word.options.map(id => bookService.getWordDetail(id, true, false, false)));

    return {
      word: data,
      options: words.map(item => ({      
        id: item.dict.word_basic_info.topic_id,
        word: item.dict.word_basic_info.word,
        translation: item.dict.chn_means[0]?.mean_type + item.dict.chn_means[0]?.mean,
        isCorrect: false
      })).concat([{
        id: data.dict.word_basic_info.topic_id,
        word: data.dict.word_basic_info.word,
        translation: data.dict.chn_means[0]?.mean_type + data.dict.chn_means[0]?.mean,
        isCorrect: true
      }])
    }
  }
}