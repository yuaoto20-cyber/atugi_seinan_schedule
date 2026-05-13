import type { AttendanceStatus, LessonSlot, Subject, SubjectStats } from "@/lib/types";

export function buildSubjectStats(subjects: Subject[], slots: LessonSlot[]): Record<string, SubjectStats> {
  return subjects.reduce<Record<string, SubjectStats>>((acc, subject) => {
    const attended = slots.filter(
      (slot) => slot.subject_id === subject.id && slot.is_attended
    ).length;
    acc[subject.id] = {
      attended,
      status: getAttendanceStatus(attended, subject.minimum_attendance)
    };
    return acc;
  }, {});
}

export function getAttendanceStatus(attended: number, minimumAttendance: number): AttendanceStatus {
  if (attended >= minimumAttendance) return "completed";
  if (attended >= Math.ceil(minimumAttendance / 2)) return "test_eligible";
  return "normal";
}

export function slotBackground(subject: Subject | undefined, stats: SubjectStats | undefined) {
  if (!subject) return "#ffffff";
  if (stats?.status === "completed") return "#dcfce7";
  if (stats?.status === "test_eligible") return "#fef3c7";
  return subject.color;
}
