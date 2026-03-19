-- Unkast Database Schema
-- Run this in Supabase SQL Editor

-- Enums
CREATE TYPE profile_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE project_category AS ENUM ('court-metrage', 'publicite', 'clip', 'documentaire', 'bande-demo', 'scene-extrait');
CREATE TYPE contact_subject AS ENUM ('collaboration', 'project', 'question', 'other');
CREATE TYPE contact_status AS ENUM ('pending', 'accepted', 'declined');

-- Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  location TEXT,
  is_available BOOLEAN DEFAULT FALSE,
  status profile_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profile roles (many-to-one)
CREATE TABLE profile_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category project_category NOT NULL,
  year INTEGER NOT NULL,
  video_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project credits (cross-referencing)
CREATE TABLE project_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ghost_name TEXT,
  role_on_project TEXT NOT NULL,
  CONSTRAINT credit_has_person CHECK (profile_id IS NOT NULL OR ghost_name IS NOT NULL)
);

-- Contact requests
CREATE TABLE contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  to_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject contact_subject NOT NULL,
  message TEXT NOT NULL,
  status contact_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_slug ON profiles(slug);
CREATE INDEX idx_profiles_status ON profiles(status);
CREATE INDEX idx_projects_slug ON projects(slug);
CREATE INDEX idx_projects_profile_id ON projects(profile_id);
CREATE INDEX idx_project_credits_project_id ON project_credits(project_id);
CREATE INDEX idx_project_credits_profile_id ON project_credits(profile_id);
CREATE INDEX idx_contact_requests_to_profile ON contact_requests(to_profile_id);
CREATE INDEX idx_profile_roles_profile_id ON profile_roles(profile_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;

-- Profiles: approved visible by all, pending only by owner
CREATE POLICY "Approved profiles are public"
  ON profiles FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Profile roles: follow profile visibility
CREATE POLICY "Public profile roles"
  ON profile_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = profile_roles.profile_id
      AND (profiles.status = 'approved' OR profiles.id = auth.uid())
    )
  );

CREATE POLICY "Users can manage own roles"
  ON profile_roles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = profile_roles.profile_id AND profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own roles"
  ON profile_roles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = profile_roles.profile_id AND profiles.id = auth.uid()
    )
  );

-- Projects: follow profile visibility
CREATE POLICY "Public projects"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = projects.profile_id
      AND (profiles.status = 'approved' OR profiles.id = auth.uid())
    )
  );

CREATE POLICY "Users can insert own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  USING (auth.uid() = profile_id);

-- Project credits: visible if project is visible
CREATE POLICY "Public project credits"
  ON project_credits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      JOIN profiles ON profiles.id = projects.profile_id
      WHERE projects.id = project_credits.project_id
      AND (profiles.status = 'approved' OR profiles.id = auth.uid())
    )
  );

CREATE POLICY "Project owners can manage credits"
  ON project_credits FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = project_credits.project_id AND projects.profile_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can update credits"
  ON project_credits FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = project_credits.project_id AND projects.profile_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can delete credits"
  ON project_credits FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = project_credits.project_id AND projects.profile_id = auth.uid()
    )
  );

-- Contact requests: sender can insert, recipient can view/update
CREATE POLICY "Anyone can send contact request"
  ON contact_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Recipients can view their requests"
  ON contact_requests FOR SELECT
  USING (auth.uid() = to_profile_id);

CREATE POLICY "Recipients can update request status"
  ON contact_requests FOR UPDATE
  USING (auth.uid() = to_profile_id);
