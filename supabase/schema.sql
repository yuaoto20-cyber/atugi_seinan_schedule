create extension if not exists "pgcrypto";

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  color text not null check (length(trim(color)) > 0),
  total_lessons integer not null check (total_lessons >= 1),
  minimum_attendance integer not null check (minimum_attendance >= 1),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subjects_minimum_lte_total check (minimum_attendance <= total_lessons)
);

create table if not exists public.school_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.lesson_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  school_day_id uuid not null references public.school_days(id) on delete cascade,
  period integer not null check (period between 1 and 6),
  subject_id uuid references public.subjects(id) on delete set null,
  is_attended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_day_id, period)
);

create index if not exists subjects_user_id_idx on public.subjects(user_id);
create index if not exists school_days_user_id_date_idx on public.school_days(user_id, date);
create index if not exists lesson_slots_user_id_idx on public.lesson_slots(user_id);
create index if not exists lesson_slots_school_day_id_idx on public.lesson_slots(school_day_id);
create index if not exists lesson_slots_subject_id_idx on public.lesson_slots(subject_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_subjects_updated_at on public.subjects;
create trigger set_subjects_updated_at
before update on public.subjects
for each row execute function public.set_updated_at();

drop trigger if exists set_school_days_updated_at on public.school_days;
create trigger set_school_days_updated_at
before update on public.school_days
for each row execute function public.set_updated_at();

drop trigger if exists set_lesson_slots_updated_at on public.lesson_slots;
create trigger set_lesson_slots_updated_at
before update on public.lesson_slots
for each row execute function public.set_updated_at();

create or replace function public.create_default_lesson_slots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.lesson_slots (user_id, school_day_id, period)
  select new.user_id, new.id, period
  from generate_series(1, 6) as period
  on conflict (school_day_id, period) do nothing;

  return new;
end;
$$;

drop trigger if exists create_default_lesson_slots on public.school_days;
create trigger create_default_lesson_slots
after insert on public.school_days
for each row execute function public.create_default_lesson_slots();

create or replace function public.ensure_slot_subject_owner()
returns trigger
language plpgsql
as $$
begin
  if new.subject_id is not null and not exists (
    select 1
    from public.subjects
    where id = new.subject_id
      and user_id = new.user_id
  ) then
    raise exception 'subject_id must belong to the same user';
  end if;

  if not exists (
    select 1
    from public.school_days
    where id = new.school_day_id
      and user_id = new.user_id
  ) then
    raise exception 'school_day_id must belong to the same user';
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_slot_subject_owner on public.lesson_slots;
create trigger ensure_slot_subject_owner
before insert or update on public.lesson_slots
for each row execute function public.ensure_slot_subject_owner();

alter table public.subjects enable row level security;
alter table public.school_days enable row level security;
alter table public.lesson_slots enable row level security;

drop policy if exists "Users can read own subjects" on public.subjects;
create policy "Users can read own subjects"
on public.subjects for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own subjects" on public.subjects;
create policy "Users can insert own subjects"
on public.subjects for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own subjects" on public.subjects;
create policy "Users can update own subjects"
on public.subjects for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own subjects" on public.subjects;
create policy "Users can delete own subjects"
on public.subjects for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read own school days" on public.school_days;
create policy "Users can read own school days"
on public.school_days for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own school days" on public.school_days;
create policy "Users can insert own school days"
on public.school_days for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own school days" on public.school_days;
create policy "Users can update own school days"
on public.school_days for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own school days" on public.school_days;
create policy "Users can delete own school days"
on public.school_days for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read own lesson slots" on public.lesson_slots;
create policy "Users can read own lesson slots"
on public.lesson_slots for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own lesson slots" on public.lesson_slots;
create policy "Users can insert own lesson slots"
on public.lesson_slots for insert
with check (
  auth.uid() = user_id
  and (
    subject_id is null
    or exists (
      select 1 from public.subjects
      where subjects.id = lesson_slots.subject_id
        and subjects.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can update own lesson slots" on public.lesson_slots;
create policy "Users can update own lesson slots"
on public.lesson_slots for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    subject_id is null
    or exists (
      select 1 from public.subjects
      where subjects.id = lesson_slots.subject_id
        and subjects.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can delete own lesson slots" on public.lesson_slots;
create policy "Users can delete own lesson slots"
on public.lesson_slots for delete
using (auth.uid() = user_id);
