export type TaskAnswer = 'YES' | 'NO';

export interface ChecklistTask {
  id: string;
  name: string;
}

export interface ChecklistCategory {
  id: string;
  name: string;
  tasks: ChecklistTask[];
}

export type TaskAnswers = Record<string, TaskAnswer>;
