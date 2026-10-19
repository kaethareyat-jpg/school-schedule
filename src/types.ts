export enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

export const DAY_ORDER: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
];

export interface TeacherConstraint {
  teacherId: string;
  unavailableSlots: Set<string>;
  maxPeriodsPerDay?: number;
}

export interface SubjectAssignment {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  classGroup: string;
  periodsPerWeek: number;
  teacherIds: string[];
  classroomId: string;
}

export interface TimeSlotData {
  id: string;
  day: DayOfWeek;
  period: number;
  key: string;
}

export interface ScheduledEntry {
  subjectId: string;
  classGroup: string;
  classroomId: string;
  teacherIds: string[];
  timeSlotId: string;
  day: DayOfWeek;
  period: number;
}

export interface UnplacedAssignment {
  subjectName: string;
  classGroup: string;
  remainingPeriods: number;
  reason: string;
}

export interface AutoScheduleResult {
  success: boolean;
  totalPlaced: number;
  totalRequired: number;
  schedules: ScheduledEntry[];
  unplacedAssignments: UnplacedAssignment[];
  executionTimeMs: number;
}

export interface SchedulerOptions {
  allowSameSubjectMultiplePerDay?: boolean;
  preferEarlierPeriods?: boolean;
  searchTimeLimitMs?: number;
}
