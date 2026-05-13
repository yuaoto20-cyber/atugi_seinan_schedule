"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, PointerEvent, ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import {
  BookOpen,
  CalendarPlus,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  LayoutList,
  Loader2,
  LogIn,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Table2,
  Trash2,
  UserPlus,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { buildSubjectStats, slotBackground } from "@/lib/attendance";
import { DEFAULT_SUBJECTS } from "@/lib/defaultSubjects";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { LessonSlot, SchoolDay, Subject, SubjectStats } from "@/lib/types";

type ViewMode = "table" | "cards";
type ActivePanel = "date" | "subjects" | "settings" | null;
type SubjectTab = "visible" | "hidden";

const PERIODS = [1, 2, 3, 4, 5, 6];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function formatDateLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short"
  }).format(parsed);
}

function dateForInput() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function isValidDateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

function sortSlots(slots: LessonSlot[] = []) {
  return [...slots].sort((a, b) => a.period - b.period);
}

export default function Home() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schoolDays, setSchoolDays] = useState<SchoolDay[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [dateInput, setDateInput] = useState(dateForInput());
  const [subjectTab, setSubjectTab] = useState<SubjectTab>("visible");
  const [subjectFormOpen, setSubjectFormOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<LessonSlot | null>(null);
  const [selectedDay, setSelectedDay] = useState<SchoolDay | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);
  const [subjectForm, setSubjectForm] = useState({
    name: "",
    color: "#e0f2fe",
    total_lessons: 1,
    minimum_attendance: 1
  });

  const allSlots = useMemo(
    () => schoolDays.flatMap((day) => day.lesson_slots ?? []),
    [schoolDays]
  );
  const subjectsById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects]
  );
  const stats = useMemo(() => buildSubjectStats(subjects, allSlots), [subjects, allSlots]);
  const visibleSubjects = useMemo(
    () => subjects.filter((subject) => !subject.is_hidden),
    [subjects]
  );
  const hiddenSubjects = useMemo(
    () => subjects.filter((subject) => subject.is_hidden),
    [subjects]
  );

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setSubjects([]);
      setSchoolDays([]);
      return;
    }

    void loadData(user.id);
  }, [user]);

  async function loadData(userId = user?.id) {
    if (!supabase || !userId) return;

    setLoading(true);
    setMessage("");

    try {
      const { data: subjectRows, error: subjectError } = await supabase
        .from("subjects")
        .select("*")
        .eq("user_id", userId)
        .order("is_hidden", { ascending: true })
        .order("created_at", { ascending: true });

      if (subjectError) throw subjectError;

      let loadedSubjects = (subjectRows ?? []) as Subject[];

      if (loadedSubjects.length === 0) {
        const { error: seedError } = await supabase.from("subjects").insert(
          DEFAULT_SUBJECTS.map((subject) => ({
            ...subject,
            user_id: userId,
            is_hidden: false
          }))
        );
        if (seedError) throw seedError;

        const { data: seededRows, error: seededError } = await supabase
          .from("subjects")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true });

        if (seededError) throw seededError;
        loadedSubjects = (seededRows ?? []) as Subject[];
      }

      const { data: dayRows, error: dayError } = await supabase
        .from("school_days")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: true });

      if (dayError) throw dayError;

      const { data: slotRows, error: slotError } = await supabase
        .from("lesson_slots")
        .select("*")
        .eq("user_id", userId)
        .order("period", { ascending: true });

      if (slotError) throw slotError;

      const slotsByDay = ((slotRows ?? []) as LessonSlot[]).reduce<Record<string, LessonSlot[]>>(
        (acc, slot) => {
          acc[slot.school_day_id] = [...(acc[slot.school_day_id] ?? []), slot];
          return acc;
        },
        {}
      );

      setSubjects(loadedSubjects);
      setSchoolDays(
        ((dayRows ?? []) as Array<Omit<SchoolDay, "lesson_slots">>).map((day) => ({
          ...day,
          lesson_slots: sortSlots(slotsByDay[day.id] ?? [])
        }))
      );
    } catch (error) {
      setMessage(getErrorMessage(error, "データの取得に失敗しました。"));
    } finally {
      setLoading(false);
    }
  }

  async function handleAuth(mode: "signin" | "signup") {
    if (!supabase) return;
    setAuthLoading(true);
    setMessage("");

    try {
      const auth =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });

      if (auth.error) throw auth.error;
      if (mode === "signup" && !auth.data.session) {
        setMessage("登録メールを確認してください。メール認証をオフにしている場合はそのままログインできます。");
      }
    } catch (error) {
      setMessage(getErrorMessage(error, "認証に失敗しました。"));
    } finally {
      setAuthLoading(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  async function addSchoolDay(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !user) return;
    setMessage("");

    if (!dateInput || !isValidDateInput(dateInput)) {
      setMessage("日付は YYYY-MM-DD 形式で入力してください。");
      return;
    }

    if (schoolDays.some((day) => day.date === dateInput)) {
      setMessage("同じ日付はすでに追加されています。");
      return;
    }

    try {
      const { data: insertedDay, error } = await supabase
        .from("school_days")
        .insert({ user_id: user.id, date: dateInput })
        .select("*")
        .single();

      if (error) throw error;

      const { data: existingSlots, error: slotCheckError } = await supabase
        .from("lesson_slots")
        .select("*")
        .eq("school_day_id", insertedDay.id);

      if (slotCheckError) throw slotCheckError;

      if ((existingSlots ?? []).length === 0) {
        const { error: slotError } = await supabase.from("lesson_slots").insert(
          PERIODS.map((period) => ({
            user_id: user.id,
            school_day_id: insertedDay.id,
            period,
            subject_id: null,
            is_attended: false
          }))
        );
        if (slotError) throw slotError;
      }

      setActivePanel(null);
      setDateInput(dateForInput());
      await loadData(user.id);
    } catch (error) {
      setMessage(getErrorMessage(error, "日付の追加に失敗しました。"));
    }
  }

  function openSlot(day: SchoolDay, slot: LessonSlot) {
    setSelectedDay(day);
    setSelectedSlot(slot);
    if (slot.subject_id) {
      setDetailOpen(true);
    } else {
      setSubjectPickerOpen(true);
    }
  }

  async function chooseSubject(subjectId: string | null) {
    if (!supabase || !user || !selectedSlot) return;

    const nextAttended =
      subjectId !== null && subjectId === selectedSlot.subject_id ? selectedSlot.is_attended : false;

    const { error } = await supabase
      .from("lesson_slots")
      .update({ subject_id: subjectId, is_attended: nextAttended })
      .eq("id", selectedSlot.id)
      .eq("user_id", user.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setSubjectPickerOpen(false);
    setDetailOpen(false);
    setSelectedSlot(null);
    await loadData(user.id);
  }

  async function toggleAttended() {
    if (!supabase || !user || !selectedSlot || !selectedSlot.subject_id) return;

    const { error } = await supabase
      .from("lesson_slots")
      .update({ is_attended: !selectedSlot.is_attended })
      .eq("id", selectedSlot.id)
      .eq("user_id", user.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setDetailOpen(false);
    setSelectedSlot(null);
    await loadData(user.id);
  }

  async function clearSlot(slot: LessonSlot) {
    if (!supabase || !user) return;
    if (!slot.subject_id) return;
    if (!window.confirm("このコマの授業を削除しますか？")) return;

    const { error } = await supabase
      .from("lesson_slots")
      .update({ subject_id: null, is_attended: false })
      .eq("id", slot.id)
      .eq("user_id", user.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setDetailOpen(false);
    setSubjectPickerOpen(false);
    await loadData(user.id);
  }

  function openSubjectForm(subject?: Subject) {
    setEditingSubject(subject ?? null);
    setSubjectForm({
      name: subject?.name ?? "",
      color: subject?.color ?? "#e0f2fe",
      total_lessons: subject?.total_lessons ?? 1,
      minimum_attendance: subject?.minimum_attendance ?? 1
    });
    setSubjectFormOpen(true);
  }

  function validateSubjectForm() {
    if (!subjectForm.name.trim()) return "科目名は必須です。";
    if (!subjectForm.color) return "色は必須です。";
    if (subjectForm.total_lessons < 1) return "総授業数は1以上にしてください。";
    if (subjectForm.minimum_attendance < 1) return "最低出席数は1以上にしてください。";
    if (subjectForm.minimum_attendance > subjectForm.total_lessons) {
      return "最低出席数は総授業数以下にしてください。";
    }
    return "";
  }

  async function saveSubject(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !user) return;

    const validation = validateSubjectForm();
    if (validation) {
      setMessage(validation);
      return;
    }

    const payload = {
      name: subjectForm.name.trim(),
      color: subjectForm.color,
      total_lessons: subjectForm.total_lessons,
      minimum_attendance: subjectForm.minimum_attendance,
      is_hidden: editingSubject?.is_hidden ?? false
    };

    const result = editingSubject
      ? await supabase.from("subjects").update(payload).eq("id", editingSubject.id).eq("user_id", user.id)
      : await supabase.from("subjects").insert({ ...payload, user_id: user.id });

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setSubjectFormOpen(false);
    setEditingSubject(null);
    await loadData(user.id);
  }

  async function updateSubjectVisibility(subject: Subject, isHidden: boolean) {
    if (!supabase || !user) return;

    const { error } = await supabase
      .from("subjects")
      .update({ is_hidden: isHidden })
      .eq("id", subject.id)
      .eq("user_id", user.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadData(user.id);
  }

  if (!isSupabaseConfigured) {
    return <MissingConfig />;
  }

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-stone-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        email={email}
        password={password}
        setEmail={setEmail}
        setPassword={setPassword}
        loading={authLoading}
        message={message}
        onAuth={handleAuth}
      />
    );
  }

  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <Sidebar
        userEmail={user.email ?? ""}
        activePanel={activePanel}
        setActivePanel={setActivePanel}
        onSignOut={signOut}
      />

      <main className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 lg:pl-[284px] lg:pr-8">
        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-stone-500">授業予定と出席状況</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-stone-900">授業管理</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadData(user.id)}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700 shadow-sm transition hover:bg-stone-50"
            >
              <RefreshCw className={cx("h-4 w-4", loading && "animate-spin")} />
              同期
            </button>
            <button
              type="button"
              onClick={() => setActivePanel("date")}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-stone-900 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800"
            >
              <CalendarPlus className="h-4 w-4" />
              日付追加
            </button>
          </div>
        </header>

        {message ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {message}
          </div>
        ) : null}

        <AttendanceSummary subjects={subjects} stats={stats} />

        <section className="mt-5 rounded-lg border border-stone-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-stone-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-stone-900">授業予定表</h2>
              <p className="mt-1 text-sm text-stone-500">追加済み {schoolDays.length} 日</p>
            </div>
            <div className="inline-flex w-fit rounded-md border border-stone-200 bg-stone-50 p-1">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cx(
                  "inline-flex h-9 items-center gap-2 rounded px-3 text-sm transition",
                  viewMode === "table" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
                )}
              >
                <Table2 className="h-4 w-4" />
                表
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={cx(
                  "inline-flex h-9 items-center gap-2 rounded px-3 text-sm transition",
                  viewMode === "cards" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
                )}
              >
                <LayoutList className="h-4 w-4" />
                カード
              </button>
            </div>
          </div>

          {schoolDays.length === 0 ? (
            <EmptySchedule onAddDate={() => setActivePanel("date")} />
          ) : viewMode === "table" ? (
            <ScheduleTable
              days={schoolDays}
              subjectsById={subjectsById}
              stats={stats}
              onOpenSlot={openSlot}
              onClearSlot={clearSlot}
            />
          ) : (
            <ScheduleCards
              days={schoolDays}
              subjectsById={subjectsById}
              stats={stats}
              onOpenSlot={openSlot}
              onClearSlot={clearSlot}
            />
          )}
        </section>
      </main>

      <MobileNav
        activePanel={activePanel}
        setActivePanel={setActivePanel}
        onSignOut={signOut}
      />

      <Modal open={activePanel === "date"} title="日付を追加" onClose={() => setActivePanel(null)}>
        <form className="space-y-4" onSubmit={addSchoolDay}>
          <div>
            <label className="text-sm font-medium text-stone-700" htmlFor="school-date">
              授業日
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                id="school-date"
                type="date"
                value={isValidDateInput(dateInput) ? dateInput : ""}
                onChange={(event) => setDateInput(event.target.value)}
                className="h-11 rounded-md border border-stone-200 bg-white px-3 text-sm outline-none ring-stone-300 transition focus:ring-2"
              />
              <input
                type="text"
                value={dateInput}
                onChange={(event) => setDateInput(event.target.value)}
                placeholder="YYYY-MM-DD"
                className="h-11 rounded-md border border-stone-200 bg-white px-3 text-sm outline-none ring-stone-300 transition focus:ring-2"
              />
            </div>
          </div>
          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-stone-900 px-4 text-sm font-medium text-white transition hover:bg-stone-800"
          >
            <Plus className="h-4 w-4" />
            追加する
          </button>
        </form>
      </Modal>

      <Modal open={activePanel === "subjects"} title="科目管理" onClose={() => setActivePanel(null)} wide>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-md border border-stone-200 bg-stone-50 p-1">
              <button
                type="button"
                onClick={() => setSubjectTab("visible")}
                className={cx(
                  "inline-flex h-9 items-center gap-2 rounded px-3 text-sm",
                  subjectTab === "visible" ? "bg-white shadow-sm" : "text-stone-500"
                )}
              >
                <BookOpen className="h-4 w-4" />
                表示中
              </button>
              <button
                type="button"
                onClick={() => setSubjectTab("hidden")}
                className={cx(
                  "inline-flex h-9 items-center gap-2 rounded px-3 text-sm",
                  subjectTab === "hidden" ? "bg-white shadow-sm" : "text-stone-500"
                )}
              >
                <EyeOff className="h-4 w-4" />
                非表示
              </button>
            </div>
            <button
              type="button"
              onClick={() => openSubjectForm()}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-stone-900 px-3 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              科目追加
            </button>
          </div>

          {subjectFormOpen ? (
            <SubjectForm
              form={subjectForm}
              setForm={setSubjectForm}
              editing={Boolean(editingSubject)}
              onSubmit={saveSubject}
              onCancel={() => {
                setSubjectFormOpen(false);
                setEditingSubject(null);
              }}
            />
          ) : null}

          <div className="grid gap-2">
            {(subjectTab === "visible" ? visibleSubjects : hiddenSubjects).map((subject) => (
              <SubjectRow
                key={subject.id}
                subject={subject}
                attended={stats[subject.id]?.attended ?? 0}
                hiddenTab={subjectTab === "hidden"}
                onEdit={() => openSubjectForm(subject)}
                onHide={() => void updateSubjectVisibility(subject, true)}
                onRestore={() => void updateSubjectVisibility(subject, false)}
              />
            ))}
            {(subjectTab === "visible" ? visibleSubjects : hiddenSubjects).length === 0 ? (
              <div className="rounded-md border border-dashed border-stone-200 bg-stone-50 px-4 py-8 text-center text-sm text-stone-500">
                該当する科目はありません。
              </div>
            ) : null}
          </div>
        </div>
      </Modal>

      <Modal open={activePanel === "settings"} title="設定" onClose={() => setActivePanel(null)}>
        <div className="space-y-3 text-sm text-stone-700">
          <div className="rounded-md border border-stone-200 bg-stone-50 p-4">
            <p className="font-medium text-stone-900">同期</p>
            <p className="mt-1 text-stone-500">Supabase</p>
          </div>
          <div className="rounded-md border border-stone-200 bg-stone-50 p-4">
            <p className="font-medium text-stone-900">PWA</p>
            <p className="mt-1 text-stone-500">有効</p>
          </div>
        </div>
      </Modal>

      <Modal
        open={detailOpen && Boolean(selectedSlot)}
        title="授業詳細"
        onClose={() => {
          setDetailOpen(false);
          setSelectedSlot(null);
        }}
      >
        {selectedSlot && selectedDay ? (
          <LessonDetail
            day={selectedDay}
            slot={selectedSlot}
            subject={selectedSlot.subject_id ? subjectsById.get(selectedSlot.subject_id) : undefined}
            onToggle={() => void toggleAttended()}
            onChange={() => setSubjectPickerOpen(true)}
            onClear={() => void clearSlot(selectedSlot)}
          />
        ) : null}
      </Modal>

      <Modal
        open={subjectPickerOpen && Boolean(selectedSlot)}
        title="科目を選択"
        onClose={() => {
          setSubjectPickerOpen(false);
          if (!detailOpen) setSelectedSlot(null);
        }}
      >
        <SubjectPicker
          subjects={visibleSubjects}
          selectedSubjectId={selectedSlot?.subject_id ?? null}
          onChoose={(subjectId) => void chooseSubject(subjectId)}
        />
      </Modal>
    </div>
  );
}

function MissingConfig() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-lg border border-stone-200 bg-white p-6 shadow-soft">
        <h1 className="text-xl font-semibold text-stone-900">Supabase の設定が必要です</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          <code className="rounded bg-stone-100 px-1.5 py-1">.env.local</code> に
          <code className="mx-1 rounded bg-stone-100 px-1.5 py-1">NEXT_PUBLIC_SUPABASE_URL</code>
          と
          <code className="mx-1 rounded bg-stone-100 px-1.5 py-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
          を設定してください。
        </p>
      </div>
    </div>
  );
}

function AuthScreen({
  email,
  password,
  setEmail,
  setPassword,
  loading,
  message,
  onAuth
}: {
  email: string;
  password: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  loading: boolean;
  message: string;
  onAuth: (mode: "signin" | "signup") => void;
}) {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-6 shadow-soft">
        <div className="mb-6">
          <p className="text-sm text-stone-500">通信制高校向け</p>
          <h1 className="mt-1 text-2xl font-semibold text-stone-900">授業管理</h1>
        </div>
        {message ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {message}
          </div>
        ) : null}
        <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
          <div>
            <label className="text-sm font-medium text-stone-700" htmlFor="email">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-stone-200 px-3 text-sm outline-none ring-stone-300 transition focus:ring-2"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-stone-700" htmlFor="password">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-stone-200 px-3 text-sm outline-none ring-stone-300 transition focus:ring-2"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => onAuth("signin")}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-stone-900 px-4 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              ログイン
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => onAuth("signup")}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-stone-200 bg-white px-4 text-sm font-medium text-stone-800 transition hover:bg-stone-50 disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" />
              新規登録
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Sidebar({
  userEmail,
  activePanel,
  setActivePanel,
  onSignOut
}: {
  userEmail: string;
  activePanel: ActivePanel;
  setActivePanel: (panel: ActivePanel) => void;
  onSignOut: () => void;
}) {
  return (
    <aside className="fixed left-0 top-0 z-20 hidden h-screen w-64 flex-col border-r border-stone-200 bg-white px-4 py-5 lg:flex">
      <div className="mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-stone-900 text-white">
          <BookOpen className="h-5 w-5" />
        </div>
        <p className="mt-3 truncate text-sm text-stone-500">{userEmail}</p>
      </div>
      <nav className="grid gap-1">
        <NavButton icon={CalendarPlus} active={activePanel === "date"} onClick={() => setActivePanel("date")}>
          日付を追加
        </NavButton>
        <NavButton icon={BookOpen} active={activePanel === "subjects"} onClick={() => setActivePanel("subjects")}>
          科目管理
        </NavButton>
        <NavButton icon={EyeOff} active={activePanel === "subjects"} onClick={() => setActivePanel("subjects")}>
          非表示科目
        </NavButton>
        <NavButton icon={Settings} active={activePanel === "settings"} onClick={() => setActivePanel("settings")}>
          設定
        </NavButton>
      </nav>
      <button
        type="button"
        onClick={onSignOut}
        className="mt-auto inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm text-stone-600 transition hover:bg-stone-100"
      >
        <LogOut className="h-4 w-4" />
        ログアウト
      </button>
    </aside>
  );
}

function NavButton({
  icon: Icon,
  active,
  onClick,
  children
}: {
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm transition",
        active ? "bg-stone-100 text-stone-900" : "text-stone-600 hover:bg-stone-50"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function MobileNav({
  activePanel,
  setActivePanel,
  onSignOut
}: {
  activePanel: ActivePanel;
  setActivePanel: (panel: ActivePanel) => void;
  onSignOut: () => void;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-stone-200 bg-white/95 px-2 pb-3 pt-2 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] backdrop-blur lg:hidden">
      <div className="grid grid-cols-4 gap-1">
        <MobileNavButton icon={CalendarPlus} active={activePanel === "date"} onClick={() => setActivePanel("date")}>
          日付
        </MobileNavButton>
        <MobileNavButton icon={BookOpen} active={activePanel === "subjects"} onClick={() => setActivePanel("subjects")}>
          科目
        </MobileNavButton>
        <MobileNavButton icon={Settings} active={activePanel === "settings"} onClick={() => setActivePanel("settings")}>
          設定
        </MobileNavButton>
        <MobileNavButton icon={LogOut} active={false} onClick={onSignOut}>
          退出
        </MobileNavButton>
      </div>
    </div>
  );
}

function MobileNavButton({
  icon: Icon,
  active,
  onClick,
  children
}: {
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex h-14 flex-col items-center justify-center gap-1 rounded-md text-xs transition",
        active ? "bg-stone-100 text-stone-900" : "text-stone-500"
      )}
    >
      <Icon className="h-5 w-5" />
      {children}
    </button>
  );
}

function AttendanceSummary({
  subjects,
  stats
}: {
  subjects: Subject[];
  stats: Record<string, SubjectStats>;
}) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-stone-900">出席状況一覧</h2>
        <span className="text-xs text-stone-500">{subjects.length} 科目</span>
      </div>
      <div className="thin-scrollbar flex gap-3 overflow-x-auto pb-1">
        {subjects.map((subject) => {
          const attended = stats[subject.id]?.attended ?? 0;
          const status = stats[subject.id]?.status ?? "normal";
          return (
            <div
              key={subject.id}
              className="min-w-[220px] rounded-md border border-stone-200 bg-white p-3"
            >
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: subject.color }} />
                <p className="truncate text-sm font-medium text-stone-900">{subject.name}</p>
                {subject.is_hidden ? (
                  <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-500">非表示</span>
                ) : null}
              </div>
              <div className="mt-3 flex items-center gap-3 text-sm text-stone-600">
                <span>出席 {attended}/{subject.total_lessons}</span>
                <span>最低 {attended}/{subject.minimum_attendance}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
                <div
                  className={cx(
                    "h-full rounded-full",
                    status === "completed"
                      ? "bg-green-400"
                      : status === "test_eligible"
                        ? "bg-yellow-400"
                        : "bg-stone-300"
                  )}
                  style={{
                    width: `${Math.min(100, (attended / subject.minimum_attendance) * 100)}%`
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EmptySchedule({ onAddDate }: { onAddDate: () => void }) {
  return (
    <div className="grid place-items-center px-4 py-16 text-center">
      <div>
        <CalendarPlus className="mx-auto h-10 w-10 text-stone-400" />
        <p className="mt-4 font-medium text-stone-900">まだ授業日がありません</p>
        <button
          type="button"
          onClick={onAddDate}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-stone-900 px-4 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" />
          日付を追加
        </button>
      </div>
    </div>
  );
}

function ScheduleTable({
  days,
  subjectsById,
  stats,
  onOpenSlot,
  onClearSlot
}: {
  days: SchoolDay[];
  subjectsById: Map<string, Subject>;
  stats: Record<string, SubjectStats>;
  onOpenSlot: (day: SchoolDay, slot: LessonSlot) => void;
  onClearSlot: (slot: LessonSlot) => void;
}) {
  return (
    <div className="thin-scrollbar overflow-x-auto">
      <table className="w-full min-w-[960px] border-collapse">
        <thead>
          <tr className="bg-stone-50 text-left text-xs font-medium uppercase text-stone-500">
            <th className="w-32 border-b border-stone-200 px-3 py-3">日付</th>
            {PERIODS.map((period) => (
              <th key={period} className="border-b border-stone-200 px-2 py-3">
                {period}限
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.id} className="align-top">
              <td className="border-b border-stone-100 px-3 py-3 text-sm font-medium text-stone-900">
                {formatDateLabel(day.date)}
              </td>
              {PERIODS.map((period) => {
                const slot = day.lesson_slots.find((item) => item.period === period);
                return (
                  <td key={period} className="border-b border-stone-100 px-2 py-2">
                    {slot ? (
                      <SlotTile
                        day={day}
                        slot={slot}
                        subject={slot.subject_id ? subjectsById.get(slot.subject_id) : undefined}
                        stats={slot.subject_id ? stats[slot.subject_id] : undefined}
                        onOpen={onOpenSlot}
                        onClear={onClearSlot}
                      />
                    ) : (
                      <MissingSlot />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScheduleCards({
  days,
  subjectsById,
  stats,
  onOpenSlot,
  onClearSlot
}: {
  days: SchoolDay[];
  subjectsById: Map<string, Subject>;
  stats: Record<string, SubjectStats>;
  onOpenSlot: (day: SchoolDay, slot: LessonSlot) => void;
  onClearSlot: (slot: LessonSlot) => void;
}) {
  return (
    <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
      {days.map((day) => (
        <article key={day.id} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
          <h3 className="mb-3 text-sm font-semibold text-stone-900">{formatDateLabel(day.date)}</h3>
          <div className="grid gap-2">
            {PERIODS.map((period) => {
              const slot = day.lesson_slots.find((item) => item.period === period);
              return (
                <div key={period} className="grid grid-cols-[44px_1fr] items-stretch gap-2">
                  <div className="flex items-center justify-center rounded-md border border-stone-200 bg-white text-sm font-medium text-stone-500">
                    {period}限
                  </div>
                  {slot ? (
                    <SlotTile
                      compact
                      day={day}
                      slot={slot}
                      subject={slot.subject_id ? subjectsById.get(slot.subject_id) : undefined}
                      stats={slot.subject_id ? stats[slot.subject_id] : undefined}
                      onOpen={onOpenSlot}
                      onClear={onClearSlot}
                    />
                  ) : (
                    <MissingSlot />
                  )}
                </div>
              );
            })}
          </div>
        </article>
      ))}
    </div>
  );
}

function SlotTile({
  day,
  slot,
  subject,
  stats,
  compact,
  onOpen,
  onClear
}: {
  day: SchoolDay;
  slot: LessonSlot;
  subject?: Subject;
  stats?: SubjectStats;
  compact?: boolean;
  onOpen: (day: SchoolDay, slot: LessonSlot) => void;
  onClear: (slot: LessonSlot) => void;
}) {
  const timerRef = useRef<number | null>(null);
  const background = slotBackground(subject, stats);

  function clearLongPress() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!slot.subject_id) return;
    if (event.pointerType === "mouse") return;
    timerRef.current = window.setTimeout(() => {
      onClear(slot);
    }, 650);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(day, slot);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(day, slot)}
      onKeyDown={handleKeyDown}
      onContextMenu={(event) => {
        event.preventDefault();
        if (slot.subject_id) onClear(slot);
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
      onPointerLeave={clearLongPress}
      className={cx(
        "group relative flex cursor-pointer flex-col justify-between rounded-md border border-stone-200 p-3 text-left shadow-sm outline-none ring-stone-300 transition hover:-translate-y-0.5 hover:shadow focus:ring-2",
        compact ? "min-h-[66px]" : "min-h-[92px]"
      )}
      style={{ backgroundColor: background }}
    >
      <div className="pr-7">
        <p className={cx("font-medium text-stone-900", compact ? "text-sm" : "text-sm")}>
          {subject?.name ?? "空き"}
        </p>
        {subject?.is_hidden ? <p className="mt-1 text-xs text-stone-500">非表示科目</p> : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        {slot.is_attended ? (
          <span className="inline-flex items-center gap-1 rounded bg-white/75 px-2 py-1 text-xs font-medium text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            済
          </span>
        ) : subject ? (
          <span className="inline-flex items-center gap-1 rounded bg-white/65 px-2 py-1 text-xs text-stone-600">
            <Circle className="h-3.5 w-3.5" />
            未済
          </span>
        ) : (
          <span className="text-xs text-stone-400">空き</span>
        )}
      </div>
      {slot.subject_id ? (
        <button
          type="button"
          aria-label="削除メニュー"
          onClick={(event) => {
            event.stopPropagation();
            onClear(slot);
          }}
          className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded bg-white/70 text-stone-500 opacity-100 transition hover:bg-white hover:text-stone-900 lg:opacity-0 lg:group-hover:opacity-100"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function MissingSlot() {
  return (
    <div className="grid min-h-[66px] place-items-center rounded-md border border-dashed border-stone-200 bg-white text-xs text-stone-400">
      未作成
    </div>
  );
}

function SubjectForm({
  form,
  setForm,
  editing,
  onSubmit,
  onCancel
}: {
  form: { name: string; color: string; total_lessons: number; minimum_attendance: number };
  setForm: (form: { name: string; color: string; total_lessons: number; minimum_attendance: number }) => void;
  editing: boolean;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-stone-200 bg-stone-50 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-medium text-stone-700">
          科目名
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className="mt-2 h-10 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none ring-stone-300 focus:ring-2"
          />
        </label>
        <label className="text-sm font-medium text-stone-700">
          色
          <input
            type="color"
            value={form.color}
            onChange={(event) => setForm({ ...form, color: event.target.value })}
            className="mt-2 h-10 w-full rounded-md border border-stone-200 bg-white px-2"
          />
        </label>
        <label className="text-sm font-medium text-stone-700">
          総授業数
          <input
            type="number"
            min={1}
            value={form.total_lessons}
            onChange={(event) =>
              setForm({ ...form, total_lessons: Number(event.target.value) })
            }
            className="mt-2 h-10 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none ring-stone-300 focus:ring-2"
          />
        </label>
        <label className="text-sm font-medium text-stone-700">
          最低出席数
          <input
            type="number"
            min={1}
            value={form.minimum_attendance}
            onChange={(event) =>
              setForm({ ...form, minimum_attendance: Number(event.target.value) })
            }
            className="mt-2 h-10 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none ring-stone-300 focus:ring-2"
          />
        </label>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-md border border-stone-200 bg-white px-4 text-sm text-stone-700"
        >
          キャンセル
        </button>
        <button type="submit" className="h-10 rounded-md bg-stone-900 px-4 text-sm font-medium text-white">
          {editing ? "更新する" : "追加する"}
        </button>
      </div>
    </form>
  );
}

function SubjectRow({
  subject,
  attended,
  hiddenTab,
  onEdit,
  onHide,
  onRestore
}: {
  subject: Subject;
  attended: number;
  hiddenTab: boolean;
  onEdit: () => void;
  onHide: () => void;
  onRestore: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-stone-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="h-8 w-8 shrink-0 rounded-md border border-stone-200" style={{ backgroundColor: subject.color }} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-stone-900">{subject.name}</p>
          <p className="mt-1 text-xs text-stone-500">
            出席 {attended}/{subject.total_lessons}　最低 {attended}/{subject.minimum_attendance}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700"
        >
          <Pencil className="h-4 w-4" />
          編集
        </button>
        {hiddenTab ? (
          <button
            type="button"
            onClick={onRestore}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700"
          >
            <Eye className="h-4 w-4" />
            再表示
          </button>
        ) : (
          <button
            type="button"
            onClick={onHide}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700"
          >
            <EyeOff className="h-4 w-4" />
            非表示
          </button>
        )}
      </div>
    </div>
  );
}

function LessonDetail({
  day,
  slot,
  subject,
  onToggle,
  onChange,
  onClear
}: {
  day: SchoolDay;
  slot: LessonSlot;
  subject?: Subject;
  onToggle: () => void;
  onChange: () => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-stone-200 bg-stone-50 p-4">
        <p className="text-sm text-stone-500">{formatDateLabel(day.date)} / {slot.period}限</p>
        <p className="mt-2 text-lg font-semibold text-stone-900">{subject?.name ?? "空き"}</p>
        <p className="mt-2 text-sm text-stone-600">{slot.is_attended ? "済" : "未済"}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={!subject}
          onClick={onToggle}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-stone-900 px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          <CheckCircle2 className="h-4 w-4" />
          {slot.is_attended ? "未済に戻す" : "済にする"}
        </button>
        <button
          type="button"
          onClick={onChange}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-stone-200 bg-white px-4 text-sm font-medium text-stone-800"
        >
          <BookOpen className="h-4 w-4" />
          科目変更
        </button>
      </div>
      <button
        type="button"
        disabled={!subject}
        onClick={onClear}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
        空きコマに戻す
      </button>
    </div>
  );
}

function SubjectPicker({
  subjects,
  selectedSubjectId,
  onChoose
}: {
  subjects: Subject[];
  selectedSubjectId: string | null;
  onChoose: (subjectId: string | null) => void;
}) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => onChoose(null)}
        className="flex w-full items-center justify-between rounded-md border border-stone-200 bg-white p-3 text-left text-sm transition hover:bg-stone-50"
      >
        <span>空きコマにする</span>
        {!selectedSubjectId ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : null}
      </button>
      <div className="thin-scrollbar grid max-h-[54vh] gap-2 overflow-y-auto pr-1">
        {subjects.map((subject) => (
          <button
            key={subject.id}
            type="button"
            onClick={() => onChoose(subject.id)}
            className="flex w-full items-center justify-between rounded-md border border-stone-200 bg-white p-3 text-left text-sm transition hover:bg-stone-50"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="h-5 w-5 shrink-0 rounded border border-stone-200" style={{ backgroundColor: subject.color }} />
              <span className="truncate font-medium text-stone-900">{subject.name}</span>
            </span>
            {selectedSubjectId === subject.id ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function Modal({
  open,
  title,
  children,
  wide,
  onClose
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  wide?: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-stone-950/30 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className={cx(
          "max-h-[92vh] w-full overflow-hidden rounded-t-xl border border-stone-200 bg-white shadow-soft sm:rounded-xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        )}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <h2 className="text-base font-semibold text-stone-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="thin-scrollbar max-h-[calc(92vh-57px)] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
