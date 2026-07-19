import type { StudyOption } from '../services/study/types';

export const getStudyOptionSetKey = (options: StudyOption[]): string =>
  options
    .map((option) => option.id)
    .sort((left, right) => left - right)
    .join(',');

export const shuffleStudyOptionIds = (
  optionIds: number[],
  random: () => number = Math.random,
): number[] => {
  const ids = [...optionIds];
  for (let index = ids.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [ids[index], ids[target]] = [ids[target], ids[index]];
  }
  return ids;
};

export const orderStudyOptions = <T extends StudyOption>(
  options: T[],
  optionIds: number[],
): T[] => {
  const optionsById = new Map(options.map((option) => [option.id, option]));
  return optionIds
    .map((optionId) => optionsById.get(optionId))
    .filter((option): option is T => option !== undefined);
};
