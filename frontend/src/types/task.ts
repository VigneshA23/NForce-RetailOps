export type TaskAnswer = 'YES' | 'NO';

export type TaskResponseType = 'YES_NO' | 'DONE_NOT_DONE' | 'NUMERIC' | 'TEXT';

export interface ChecklistTask {
  id: number;
  name: string;
  responseType: TaskResponseType;
}

export interface ChecklistCategory {
  id: number;
  name: string;
  tasks: ChecklistTask[];
}

export type TaskAnswers = Record<string, TaskAnswer>;
