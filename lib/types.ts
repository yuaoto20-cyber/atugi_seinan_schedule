export type Subject = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  total_lessons: number;
  minimum_attendance: number;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
};

export type LessonSlot = {
  id: string;
  user_id: string;
  school_day_id: string;
  period: number;
  subject_id: string | null;
  is_attended: boolean;
  created_at: string;
  updated_at: string;
};

export type SchoolDay = {
  id: string;
  user_id: string;
  date: string;
  created_at: string;
  updated_at: string;
  lesson_slots: LessonSlot[];
};

export type AttendanceStatus = "normal" | "test_eligible" | "completed";

export type SubjectStats = {
  attended: number;
  status: AttendanceStatus;
};

export type Database = {
  public: {
    Tables: {
      subjects: {
        Row: Subject;
        Insert: Omit<Subject, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Subject, "id" | "user_id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      school_days: {
        Row: Omit<SchoolDay, "lesson_slots">;
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          date?: string;
        };
        Relationships: [];
      };
      lesson_slots: {
        Row: LessonSlot;
        Insert: {
          id?: string;
          user_id: string;
          school_day_id: string;
          period: number;
          subject_id?: string | null;
          is_attended?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          subject_id?: string | null;
          is_attended?: boolean;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};
