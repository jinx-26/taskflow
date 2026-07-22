-- ====================================================================
-- TASKFLOW SUPABASE DATABASE SCHEMA
-- Copy & Paste this entire file into your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/zabzwsdvbgzjlkfszxhn/sql/new
-- ====================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create User Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'Member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Trigger to automatically create a profile record when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    'Member'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 3. Create Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(10) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Planning', 'Completed', 'On Hold')),
  progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ
);

-- Enable RLS on Projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Projects Policies
CREATE POLICY "Projects viewable by authenticated users"
  ON public.projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete projects"
  ON public.projects FOR DELETE
  TO authenticated
  USING (true);


-- 4. Create Tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Urgent', 'High', 'Medium', 'Low')),
  status TEXT DEFAULT 'Todo' CHECK (status IN ('Backlog', 'Todo', 'In Progress', 'In Review', 'Done')),
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ
);

-- Enable RLS on Tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Tasks Policies
CREATE POLICY "Tasks viewable by authenticated users"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert tasks"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tasks"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete tasks"
  ON public.tasks FOR DELETE
  TO authenticated
  USING (true);


-- 5. Indexes for Query Performance
CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
