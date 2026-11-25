import type { UserBookBasicInfo } from '../types';
import { ApiService } from './api';

export interface LearningAgentProfile {
  bookId: number;
  bookIntroduction: string | null;
  learningRoute: string | null;
  book: Pick<UserBookBasicInfo, 'id' | 'name' | 'img' | 'total_words_count'> | null;
}

const profilePath = '/agent/profile';

export const learningAgentService = {
  async getProfile(signal: AbortSignal): Promise<LearningAgentProfile | null> {
    const { data } = await ApiService.get<LearningAgentProfile | null>(profilePath, { baseURL: '/', signal });
    return data;
  },

  async selectBook(bookId: number): Promise<LearningAgentProfile> {
    const { data } = await ApiService.put<LearningAgentProfile>(`${profilePath}/book`, { bookId }, { baseURL: '/' });
    return data;
  },
};
