export type ResponseType = 'YES_NO' | 'DONE_NOT_DONE' | 'NUMERIC' | 'TEXT';

export type CompletionType = 'SINGLE' | 'MULTIPLE';

export type ScheduleType = 'EVERY_DAY' | 'WEEKDAYS' | 'WEEKENDS' | 'SELECTED_DAYS';

export type TimeMode = 'ANYTIME' | 'WINDOW';

export type DayCode = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export interface TaskStoreOption {
  id: number;
  name: string;
}

export interface AdminTask {
  id: number;
  name: string;
  description: string | null;
  categoryId: number;
  categoryName: string;
  displayOrder: number;
  appliesToAllStores: boolean;
  stores: TaskStoreOption[];
  responseType: ResponseType;
  responseNote: string | null;
  numericUnit: string | null;
  numericMin: number | null;
  numericMax: number | null;
  textMaxLength: number | null;
  completionType: CompletionType;
  maxCompletions: number | null;
  scheduleType: ScheduleType;
  selectedDays: DayCode[];
  startDate: string;
  endDate: string | null;
  timeMode: TimeMode;
  startTime: string | null;
  endTime: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTaskFormValues {
  name: string;
  categoryId: number | null;
  displayOrder: string;
  appliesToAllStores: boolean;
  storeIds: number[];
  responseType: ResponseType | null;
  responseNote: string;
  numericUnit: string;
  numericMin: string;
  numericMax: string;
  completionType: CompletionType | null;
  scheduleType: ScheduleType | null;
  selectedDays: DayCode[];
  startDate: string;
  endDate: string;
  active: boolean;
}
