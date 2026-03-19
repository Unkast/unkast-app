export type ProfileStatus = "pending" | "approved" | "rejected";

export type ProjectCategory =
  | "court-metrage"
  | "publicite"
  | "clip"
  | "documentaire"
  | "bande-demo"
  | "scene-extrait";

export type ContactSubject =
  | "collaboration"
  | "project"
  | "question"
  | "other";

export type ContactStatus = "pending" | "accepted" | "declined";

export interface Profile {
  id: string;
  full_name: string;
  slug: string;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  is_available: boolean;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
}

export interface ProfileRole {
  id: string;
  profile_id: string;
  role_name: string;
}

export interface Project {
  id: string;
  profile_id: string;
  title: string;
  slug: string;
  description: string | null;
  category: ProjectCategory;
  year: number;
  video_url: string;
  created_at: string;
}

export interface ProjectCredit {
  id: string;
  project_id: string;
  profile_id: string | null;
  ghost_name: string | null;
  role_on_project: string;
}

export interface ContactRequest {
  id: string;
  from_name: string;
  from_email: string;
  to_profile_id: string;
  subject: ContactSubject;
  message: string;
  status: ContactStatus;
  created_at: string;
}

// Supabase Database type for typed client
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at" | "status" | "is_available"> & { status?: ProfileStatus; is_available?: boolean };
        Update: Partial<Omit<Profile, "id" | "created_at">>;
        Relationships: [];
      };
      profile_roles: {
        Row: ProfileRole;
        Insert: Omit<ProfileRole, "id">;
        Update: Partial<Omit<ProfileRole, "id">>;
        Relationships: [];
      };
      projects: {
        Row: Project;
        Insert: Omit<Project, "id" | "created_at">;
        Update: Partial<Omit<Project, "id" | "created_at">>;
        Relationships: [];
      };
      project_credits: {
        Row: ProjectCredit;
        Insert: Omit<ProjectCredit, "id">;
        Update: Partial<Omit<ProjectCredit, "id">>;
        Relationships: [];
      };
      contact_requests: {
        Row: ContactRequest;
        Insert: {
          from_name: string;
          from_email: string;
          to_profile_id: string;
          subject: ContactSubject;
          message: string;
          status?: ContactStatus;
        };
        Update: Partial<Omit<ContactRequest, "id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      profile_status: ProfileStatus;
      project_category: ProjectCategory;
      contact_subject: ContactSubject;
      contact_status: ContactStatus;
    };
  };
}
