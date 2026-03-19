"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  Profile,
  ProfileRole,
  Project,
  ProjectCredit,
  ProjectCategory,
} from "@/types/database";
import VideoEmbed from "@/components/VideoEmbed";

type CreditWithProfile = ProjectCredit & {
  profile:
    | (Pick<Profile, "id" | "full_name" | "slug" | "avatar_url" | "location"> & {
        roles: ProfileRole[];
        project_count: number;
      })
    | null;
};

type ProjectFull = Project & {
  credits: CreditWithProfile[];
  owner: Pick<
    Profile,
    "id" | "full_name" | "slug" | "avatar_url" | "location" | "is_available"
  > & {
    roles: ProfileRole[];
  };
};

type RelatedProject = Project & {
  owner_name: string;
  owner_slug: string;
  common_collaborators: number;
};

interface Props {
  project: ProjectFull;
  relatedProjects: RelatedProject[];
  categoryLabels: Record<ProjectCategory, string>;
  categoryColors: Record<ProjectCategory, string>;
}

type Tab = "equipe" | "projets-lies";

export default function ProjetClient({
  project,
  relatedProjects,
  categoryLabels,
  categoryColors,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("equipe");

  const catColor = categoryColors[project.category];

  return (
    <div className="pb-16 lg:pb-0">
      <main>
        {/* Video player — full width cinematic */}
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-6">
          <div className="rounded-xl overflow-hidden border border-border">
            <VideoEmbed url={project.video_url} title={project.title} />
          </div>
        </div>

        {/* Content area: main + sidebar */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
            {/* Main content */}
            <div className="flex-1 min-w-0">
              {/* Title + meta */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary">
                  {project.title}
                </h1>
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: catColor + "15",
                    color: catColor,
                    border: `1px solid ${catColor}30`,
                  }}
                >
                  {categoryLabels[project.category]}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary mb-4">
                <span className="font-mono text-text-tertiary">
                  {project.year}
                </span>
              </div>

              {/* Description */}
              {project.description && (
                <div className="mb-10">
                  <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                    Description
                  </h2>
                  <p className="text-text-secondary leading-relaxed whitespace-pre-line">
                    {project.description}
                  </p>
                </div>
              )}

              {/* Tabs */}
              <div className="border-b border-border mb-4">
                <div className="flex gap-6">
                  <button
                    onClick={() => setActiveTab("equipe")}
                    className={`pb-3 text-sm font-semibold transition border-b-2 ${
                      activeTab === "equipe"
                        ? "border-lime text-lime"
                        : "border-transparent text-text-tertiary hover:text-text-secondary"
                    }`}
                  >
                    Equipe
                    <span className="ml-1.5 text-xs opacity-60">
                      ({project.credits.length})
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab("projets-lies")}
                    className={`pb-3 text-sm font-semibold transition border-b-2 ${
                      activeTab === "projets-lies"
                        ? "border-lime text-lime"
                        : "border-transparent text-text-tertiary hover:text-text-secondary"
                    }`}
                  >
                    Projets lies
                    {relatedProjects.length > 0 && (
                      <span className="ml-1.5 text-xs opacity-60">
                        ({relatedProjects.length})
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Tab content: Equipe */}
              {activeTab === "equipe" && (
                <div className="space-y-3">
                  {project.credits.map((credit) => {
                    const isOwner =
                      credit.profile_id === project.owner.id;
                    const displayName =
                      credit.profile?.full_name ?? credit.ghost_name ?? "Inconnu";

                    return (
                      <div
                        key={credit.id}
                        className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-border-hover transition"
                      >
                        {/* Avatar */}
                        <div className="w-11 h-11 rounded-xl bg-background border border-border overflow-hidden flex-shrink-0">
                          {credit.profile?.avatar_url ? (
                            <img
                              src={credit.profile.avatar_url}
                              alt={displayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm font-bold text-text-tertiary">
                              {displayName.charAt(0)}
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            {credit.profile ? (
                              <Link
                                href={`/profil/${credit.profile.slug}`}
                                className="text-sm font-semibold text-text-primary hover:text-lime transition truncate"
                              >
                                {displayName}
                              </Link>
                            ) : (
                              <span className="text-sm font-semibold text-text-secondary truncate">
                                {displayName}
                              </span>
                            )}
                            {isOwner && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-lime/10 text-lime border border-lime/30">
                                Createur
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-text-tertiary">
                            {credit.role_on_project}
                          </p>

                          {credit.profile && (
                            <div className="flex items-center gap-3 mt-1 text-xs text-text-tertiary">
                              {credit.profile.roles.length > 0 && (
                                <span>
                                  {credit.profile.roles
                                    .map((r) => r.role_name)
                                    .join(", ")}
                                </span>
                              )}
                              {credit.profile.location && (
                                <span className="flex items-center gap-0.5">
                                  <svg
                                    className="w-3 h-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                    />
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                  </svg>
                                  {credit.profile.location}
                                </span>
                              )}
                              <span>
                                {credit.profile.project_count} projet
                                {credit.profile.project_count > 1 ? "s" : ""}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Arrow link */}
                        {credit.profile && (
                          <Link
                            href={`/profil/${credit.profile.slug}`}
                            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-text-tertiary hover:text-text-primary transition"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </Link>
                        )}
                      </div>
                    );
                  })}

                  {project.credits.length === 0 && (
                    <p className="text-text-tertiary text-sm">
                      Aucun credit renseigne pour ce projet.
                    </p>
                  )}
                </div>
              )}

              {/* Tab content: Projets lies */}
              {activeTab === "projets-lies" && (
                <div>
                  {relatedProjects.length === 0 ? (
                    <p className="text-text-tertiary text-sm">
                      Aucun projet lie pour le moment.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {relatedProjects.map((rp) => {
                        const rpColor = categoryColors[rp.category];
                        return (
                          <Link
                            key={rp.id}
                            href={`/projet/${rp.slug}`}
                            className="bg-card border border-border rounded-xl p-4 hover:border-border-hover transition group"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                style={{
                                  backgroundColor: rpColor + "15",
                                  color: rpColor,
                                  border: `1px solid ${rpColor}30`,
                                }}
                              >
                                {categoryLabels[rp.category]}
                              </span>
                              <span className="text-xs font-mono text-text-tertiary">
                                {rp.year}
                              </span>
                            </div>

                            <h3 className="text-sm font-bold text-text-primary group-hover:text-lime transition mb-1 truncate">
                              {rp.title}
                            </h3>

                            <p className="text-xs text-text-secondary mb-2">
                              par{" "}
                              <span className="text-text-primary">
                                {rp.owner_name}
                              </span>
                            </p>

                            <div className="flex items-center gap-1.5 text-xs text-teal">
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                />
                              </svg>
                              {rp.common_collaborators} collaborateur
                              {rp.common_collaborators > 1 ? "s" : ""} en
                              commun
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar (desktop) */}
            <aside className="w-full lg:w-80 flex-shrink-0 space-y-6">
              {/* Fiche technique */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-4">
                  Fiche technique
                </h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-xs text-text-tertiary">Categorie</dt>
                    <dd className="text-sm text-text-primary mt-0.5">
                      {categoryLabels[project.category]}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-tertiary">Annee</dt>
                    <dd className="text-sm text-text-primary mt-0.5 font-mono">
                      {project.year}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-tertiary">Equipe</dt>
                    <dd className="text-sm text-text-primary mt-0.5">
                      {project.credits.length} personne
                      {project.credits.length > 1 ? "s" : ""}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Creator card */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-4">
                  Createur
                </h3>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-background border border-border overflow-hidden flex-shrink-0">
                    {project.owner.avatar_url ? (
                      <img
                        src={project.owner.avatar_url}
                        alt={project.owner.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg font-bold text-text-tertiary">
                        {project.owner.full_name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      {project.owner.full_name}
                    </p>
                    {project.owner.roles.length > 0 && (
                      <p className="text-xs text-text-tertiary">
                        {project.owner.roles
                          .map((r) => r.role_name)
                          .join(", ")}
                      </p>
                    )}
                    {project.owner.location && (
                      <p className="text-xs text-text-tertiary flex items-center gap-1 mt-0.5">
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        {project.owner.location}
                      </p>
                    )}
                  </div>
                </div>

                {project.owner.is_available && (
                  <div className="flex items-center gap-1.5 mb-4 text-xs text-teal">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
                    Disponible
                  </div>
                )}

                <Link
                  href={`/profil/${project.owner.slug}`}
                  className="block w-full py-2.5 text-center bg-lime text-[#0d0d0d] font-bold text-sm rounded-lg hover:brightness-110 transition"
                >
                  Voir le profil complet
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
