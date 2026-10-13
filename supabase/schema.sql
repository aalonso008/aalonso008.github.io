-- Tu Rutina. Corré este archivo en el SQL editor de Supabase.
-- Los id son texto generados en el cliente.

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists profiles (
  user_id uuid primary key references auth.users on delete cascade,
  sex text check (sex in ('M', 'F')),
  birth_date date,
  height_cm numeric,
  activity_level text,
  goal text,
  target_body_fat numeric,
  settings jsonb default '{}'::jsonb,
  role text default 'athlete' check (role in ('athlete', 'trainer')),
  updated_at timestamptz default now()
);

create table if not exists routines (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  data jsonb not null,
  is_active boolean default true,
  updated_at timestamptz default now(),
  deleted boolean default false
);

create table if not exists exercises (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  muscle_group text,
  muscles text[],
  tip text,
  link_url text,
  link_label text,
  archived boolean default false,
  updated_at timestamptz default now(),
  deleted boolean default false
);

create table if not exists workout_sets (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  exercise_id text not null,
  session_id text,
  date date not null,
  set_number int,
  weight numeric,
  reps int,
  rpe numeric,
  note text,
  ts bigint,
  updated_at timestamptz default now(),
  deleted boolean default false
);
create index if not exists workout_sets_user_exercise_date on workout_sets (user_id, exercise_id, date);

create table if not exists body_metrics (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  date date not null,
  weight numeric,
  waist_cm numeric,
  neck_cm numeric,
  hip_cm numeric,
  body_fat_manual numeric,
  note text,
  updated_at timestamptz default now(),
  deleted boolean default false
);
create index if not exists body_metrics_user_date on body_metrics (user_id, date);

alter table profiles add column if not exists role text default 'athlete';
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('athlete', 'trainer'));

create table if not exists students (
  id text primary key,
  trainer_id uuid not null references auth.users on delete cascade,
  name text not null,
  email text not null,
  user_id uuid references auth.users on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists students_email_lower on students (lower(email));
create index if not exists students_trainer on students (trainer_id);

create table if not exists routine_templates (
  id text primary key,
  trainer_id uuid not null references auth.users on delete cascade,
  title text not null,
  subtitle text default '',
  data jsonb not null,
  updated_at timestamptz default now(),
  deleted boolean default false
);
create index if not exists routine_templates_trainer on routine_templates (trainer_id);

alter table routines add column if not exists student_id text references students (id) on delete cascade;
alter table exercises add column if not exists student_id text references students (id) on delete cascade;
alter table workout_sets add column if not exists student_id text references students (id) on delete cascade;
alter table body_metrics add column if not exists student_id text references students (id) on delete cascade;
create index if not exists routines_student on routines (student_id);
create index if not exists exercises_student on exercises (student_id);
create index if not exists workout_sets_student on workout_sets (student_id);
create index if not exists body_metrics_student on body_metrics (student_id);

alter table profiles enable row level security;
alter table routines enable row level security;
alter table exercises enable row level security;
alter table workout_sets enable row level security;
alter table body_metrics enable row level security;

create or replace function is_my_student(sid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from students
    where id = sid and trainer_id = auth.uid()
  );
$$;

create or replace function my_student_row()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id from students where user_id = auth.uid() limit 1;
$$;

create or replace function can_write_row(row_user uuid, sid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (sid is null and row_user = auth.uid())
    or (
      sid is not null
      and is_my_student(sid)
      and (
        row_user = auth.uid()
        or row_user = (select user_id from students where id = sid)
      )
    )
    or (
      row_user = auth.uid()
      and sid is not distinct from my_student_row()
    );
$$;

create or replace function attach_student_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sid text;
begin
  if new.student_id is null then
    sid := my_student_row();
    if sid is not null then
      new.student_id := sid;
    end if;
  end if;
  return new;
end;
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['routines', 'exercises', 'workout_sets', 'body_metrics']
  loop
    execute format('drop policy if exists %I_select on %I', tbl, tbl);
    execute format('drop policy if exists %I_insert on %I', tbl, tbl);
    execute format('drop policy if exists %I_update on %I', tbl, tbl);
    execute format('drop policy if exists %I_delete on %I', tbl, tbl);
    execute format(
      'create policy %I_select on %I for select using (auth.uid() = user_id or (student_id is not null and is_my_student(student_id)))',
      tbl, tbl
    );
    execute format(
      'create policy %I_insert on %I for insert with check (can_write_row(user_id, student_id))',
      tbl, tbl
    );
    execute format(
      'create policy %I_update on %I for update using (auth.uid() = user_id or (student_id is not null and is_my_student(student_id))) with check (can_write_row(user_id, student_id))',
      tbl, tbl
    );
    execute format(
      'create policy %I_delete on %I for delete using (auth.uid() = user_id or (student_id is not null and is_my_student(student_id)))',
      tbl, tbl
    );
    execute format('drop trigger if exists %I_touch on %I', tbl, tbl);
    execute format('create trigger %I_touch before update on %I for each row execute function set_updated_at()', tbl, tbl);
    execute format('drop trigger if exists %I_student on %I', tbl, tbl);
    execute format('create trigger %I_student before insert on %I for each row execute function attach_student_id()', tbl, tbl);
  end loop;
end $$;

drop policy if exists profiles_select on profiles;
drop policy if exists profiles_insert on profiles;
drop policy if exists profiles_update on profiles;
drop policy if exists profiles_delete on profiles;
create policy profiles_select on profiles for select using (auth.uid() = user_id);
create policy profiles_insert on profiles for insert with check (auth.uid() = user_id);
create policy profiles_update on profiles for update using (auth.uid() = user_id);
create policy profiles_delete on profiles for delete using (auth.uid() = user_id);
drop trigger if exists profiles_touch on profiles;
create trigger profiles_touch before update on profiles for each row execute function set_updated_at();

alter table students enable row level security;
alter table routine_templates enable row level security;

drop policy if exists students_select on students;
drop policy if exists students_insert on students;
drop policy if exists students_update on students;
drop policy if exists students_delete on students;
create policy students_select on students for select using (trainer_id = auth.uid() or user_id = auth.uid());
create policy students_insert on students for insert with check (trainer_id = auth.uid());
create policy students_update on students for update using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());
create policy students_delete on students for delete using (trainer_id = auth.uid());

drop policy if exists routine_templates_select on routine_templates;
drop policy if exists routine_templates_insert on routine_templates;
drop policy if exists routine_templates_update on routine_templates;
drop policy if exists routine_templates_delete on routine_templates;
create policy routine_templates_select on routine_templates for select using (trainer_id = auth.uid());
create policy routine_templates_insert on routine_templates for insert with check (trainer_id = auth.uid());
create policy routine_templates_update on routine_templates for update using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());
create policy routine_templates_delete on routine_templates for delete using (trainer_id = auth.uid());

drop trigger if exists students_touch on students;
create trigger students_touch before update on students for each row execute function set_updated_at();
drop trigger if exists routine_templates_touch on routine_templates;
create trigger routine_templates_touch before update on routine_templates for each row execute function set_updated_at();

create or replace function claim_student()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  sid text;
  mail text;
begin
  mail := lower(coalesce(auth.jwt() ->> 'email', ''));
  if mail = '' then
    return false;
  end if;
  select id into sid from students
  where lower(email) = mail and user_id is null
  order by created_at
  limit 1;
  if sid is null then
    return false;
  end if;
  update students set user_id = auth.uid(), updated_at = now() where id = sid;
  update routines set user_id = auth.uid() where student_id = sid;
  update exercises set user_id = auth.uid() where student_id = sid;
  update workout_sets set user_id = auth.uid() where student_id = sid;
  update body_metrics set user_id = auth.uid() where student_id = sid;
  return true;
end;
$$;

create or replace function delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from workout_sets where user_id = auth.uid() or student_id in (select id from students where trainer_id = auth.uid());
  delete from body_metrics where user_id = auth.uid() or student_id in (select id from students where trainer_id = auth.uid());
  delete from exercises where user_id = auth.uid() or student_id in (select id from students where trainer_id = auth.uid());
  delete from routines where user_id = auth.uid() or student_id in (select id from students where trainer_id = auth.uid());
  delete from routine_templates where trainer_id = auth.uid();
  delete from students where trainer_id = auth.uid() or user_id = auth.uid();
  delete from profiles where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function delete_own_account() from public, anon;
revoke all on function claim_student() from public, anon;
revoke all on function is_my_student(text) from public, anon;
revoke all on function my_student_row() from public, anon;
revoke all on function can_write_row(uuid, text) from public, anon;
revoke all on function attach_student_id() from public, anon;
grant execute on function delete_own_account() to authenticated;
grant execute on function claim_student() to authenticated;
grant execute on function is_my_student(text) to authenticated;
grant execute on function my_student_row() to authenticated;
grant execute on function can_write_row(uuid, text) to authenticated;
