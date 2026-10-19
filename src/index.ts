import { pathToFileURL } from 'node:url';
import { AutoSchedulerEngine, createTimeSlots } from './autoScheduler.js';
import { DayOfWeek, type SubjectAssignment, type TeacherConstraint } from './types.js';

function buildSampleData(): {
  timeSlots: ReturnType<typeof createTimeSlots>;
  assignments: SubjectAssignment[];
  constraints: TeacherConstraint[];
} {
  const timeSlots = createTimeSlots(
    [
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
    ],
    6
  );

  const assignments: SubjectAssignment[] = [
    {
      subjectId: 'math-01',
      subjectCode: 'MATH',
      subjectName: 'Mathematics',
      classGroup: 'M.2/1',
      periodsPerWeek: 5,
      teacherIds: ['t1'],
      classroomId: 'room-a',
    },
    {
      subjectId: 'thai-01',
      subjectCode: 'THAI',
      subjectName: 'Thai Language',
      classGroup: 'M.2/1',
      periodsPerWeek: 4,
      teacherIds: ['t2'],
      classroomId: 'room-a',
    },
    {
      subjectId: 'science-01',
      subjectCode: 'SCI',
      subjectName: 'Science',
      classGroup: 'M.2/1',
      periodsPerWeek: 3,
      teacherIds: ['t3'],
      classroomId: 'room-lab',
    },
    {
      subjectId: 'english-01',
      subjectCode: 'ENG',
      subjectName: 'English',
      classGroup: 'M.2/2',
      periodsPerWeek: 4,
      teacherIds: ['t4'],
      classroomId: 'room-b',
    },
    {
      subjectId: 'pe-01',
      subjectCode: 'PE',
      subjectName: 'Physical Education',
      classGroup: 'M.2/2',
      periodsPerWeek: 2,
      teacherIds: ['t5'],
      classroomId: 'gym',
    },
  ];

  const constraints: TeacherConstraint[] = [
    {
      teacherId: 't1',
      unavailableSlots: new Set(['MONDAY_1', 'FRIDAY_6']),
      maxPeriodsPerDay: 3,
    },
    {
      teacherId: 't3',
      unavailableSlots: new Set(['WEDNESDAY_2']),
      maxPeriodsPerDay: 2,
    },
  ];

  return { timeSlots, assignments, constraints };
}

function main(): void {
  const { timeSlots, assignments, constraints } = buildSampleData();
  const engine = new AutoSchedulerEngine(timeSlots, assignments, constraints, {
    preferEarlierPeriods: true,
    allowSameSubjectMultiplePerDay: false,
    searchTimeLimitMs: 250,
  });

  const result = engine.run();
  console.log(JSON.stringify(result, null, 2));
}

const entryPoint = process.argv[1];
const isMain = entryPoint ? import.meta.url === pathToFileURL(entryPoint).href : false;

if (isMain) {
  main();
}

export { AutoSchedulerEngine, createTimeSlots, DayOfWeek };
