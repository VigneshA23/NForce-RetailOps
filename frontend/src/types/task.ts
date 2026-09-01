export type TaskResponseType = 'YES_NO' | 'DONE_NOT_DONE' | 'NUMERIC' | 'TEXT';

export type CompletionType = 'SINGLE' | 'MULTIPLE';

export interface ChecklistTask {
  id: string;
  name: string;
  description: string | null;
  responseType: TaskResponseType;
  responseNote: string | null;
  numericUnit: string | null;
  numericMin: number | null;
  numericMax: number | null;
  textMaxLength: number | null;
  completionType: CompletionType;
  maxCompletions: number | null;
}

export interface ChecklistCategory {
  id: string;
  name: string;
  tasks: ChecklistTask[];
}

// A recorded employee response, shaped per the task's configured responseType --
// the actual value is kept in its native type instead of being flattened to Yes/No.
export type TaskAnswer =
  | { responseType: 'YES_NO'; value: 'YES' | 'NO' }
  | { responseType: 'DONE_NOT_DONE'; value: true }
  | { responseType: 'NUMERIC'; value: number }
  | { responseType: 'TEXT'; value: string };

export type TaskAnswers = Record<string, TaskAnswer>;

export function isAnswerComplete(answer: TaskAnswer | undefined): boolean {
  if (!answer) return false;
  switch (answer.responseType) {
    case 'YES_NO':
      return answer.value === 'YES';
    case 'DONE_NOT_DONE':
      return answer.value === true;
    case 'NUMERIC':
      return Number.isFinite(answer.value);
    case 'TEXT':
      return answer.value.trim().length > 0;
    default:
      return false;
  }
}
