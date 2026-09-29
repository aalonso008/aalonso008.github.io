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

alter table profiles enable row level security;
alter table routines enable row level security;
alter table exercises enable row level security;
alter table workout_sets enable row level security;
alter table body_metrics enable row level security;

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
    execute format('create policy %I_select on %I for select using (auth.uid() = user_id)', tbl, tbl);
    execute format('create policy %I_insert on %I for insert with check (auth.uid() = user_id)', tbl, tbl);
    execute format('create policy %I_update on %I for update using (auth.uid() = user_id)', tbl, tbl);
    execute format('create policy %I_delete on %I for delete using (auth.uid() = user_id)', tbl, tbl);
    execute format('drop trigger if exists %I_touch on %I', tbl, tbl);
    execute format('create trigger %I_touch before update on %I for each row execute function set_updated_at()', tbl, tbl);
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

create or replace function delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from workout_sets where user_id = auth.uid();
  delete from body_metrics where user_id = auth.uid();
  delete from exercises where user_id = auth.uid();
  delete from routines where user_id = auth.uid();
  delete from profiles where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function delete_own_account() from public;
grant execute on function delete_own_account() to authenticated;
