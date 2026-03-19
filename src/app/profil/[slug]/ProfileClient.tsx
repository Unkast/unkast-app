"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FadeInView, cardHover, staggerContainer, fadeUp } from "@/components/motion";
import type { Profile, ProfileRole, Project, ProjectCredit, ProjectCategory } from "@/types/database";
import VideoEmbed from "@/components/VideoEmbed";
import ContactModal from "@/components/ContactModal";

type CreditWithProfile = ProjectCredit & {
  profile: Pick<Profile, "full_name" | "slug" | "avatar_url"> | null;
};

type ProjectWithCredits = Project & {
  credits: CreditWithProfile[];
};

type ProfileData = Profile & {
  roles: ProfileRole[];
  projects: ProjectWithCredits[];
};

interface Props {
  profile: ProfileData;
  categories: ProjectCategory[];
  categoryLabels: Record<ProjectCategory, string>;
  categoryColors: Record<ProjectCategory, string>;
}

export default function ProfileClient({
  profile,
  categories,
  categoryLabels,
  categoryColors,
}: Props) {
  const [activeFilter, setActiveFilter] = useState<ProjectCategory | "all">("all");
  const [expandedCredits, setExpandedCredits] = useState<Set<string>>(new Set());
  const [contactOpen, setContactOpen] = useState(false);
  const [shareTooltip, setShareTooltip] = useState(false);

  const filteredProjects =
    activeFilter === "all"
      ? profile.projects
      : profile.projects.filter((p) => p.category === activeFilter);

  function toggleCredits(projectId: string) {
    setExpandedCredits((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href);
    setShareTooltip(true);
    setTimeout(() => setShareTooltip(false), 2000);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="pb-16 lg:pb-0">
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-6">
        {/* Profile header */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
          {/* Avatar */}
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-white/[0.03] border border-white/5 overflow-hidden flex-shrink-0 ring-1 ring-white/10">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl sm:text-4xl font-bold text-text-tertiary">
                {profile.full_name.charAt(0)}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary">
                {profile.full_name}
              </h1>
              {profile.is_available && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal/10 border border-teal/30 text-teal text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
                  Disponible
                </span>
              )}
            </div>

            {/* Roles */}
            <div className="flex flex-wrap gap-2 mb-4">
              {profile.roles.map((role) => (
                <span
                  key={role.id}
                  className="px-3 py-1 rounded-full bg-lime/10 border border-lime/30 text-lime text-xs font-semibold"
                >
                  {role.role_name}
                </span>
              ))}
            </div>

            {/* Location */}
            {profile.location && (
              <p className="text-sm text-text-secondary mb-3">
                <svg className="inline-block w-4 h-4 mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {profile.location}
              </p>
            )}

            {/* Bio */}
            {profile.bio && (
              <p className="text-text-secondary text-sm leading-relaxed max-w-2xl">
                {profile.bio}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 mt-6">
              <button
                onClick={() => setContactOpen(true)}
                className="px-6 py-2.5 bg-lime text-[#0d0d0d] font-bold text-sm rounded-lg hover:brightness-110 transition"
              >
                Demander le contact
              </button>
              <div className="relative">
                <button
                  onClick={handleShare}
                  className="px-6 py-2.5 border border-border-active text-text-secondary text-sm rounded-lg hover:border-white/10 hover:text-text-primary transition"
                >
                  Partager le profil
                </button>
                {shareTooltip && (
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-white/[0.03] border border-white/5 rounded text-xs text-lime whitespace-nowrap">
                    Lien copie !
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Projects section */}
        <FadeInView>
          <section className="mt-8">
            <h2 className="text-xl font-bold text-text-primary mb-4">
              Projets
              <span className="text-text-tertiary font-normal ml-2 text-base">
                ({profile.projects.length})
              </span>
            </h2>

            {/* Category filters */}
            {categories.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-5">
                <button
                  onClick={() => setActiveFilter("all")}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                    activeFilter === "all"
                      ? "bg-white/10 text-text-primary border border-white/20"
                      : "border border-white/5 text-text-secondary hover:border-white/10"
                  }`}
                >
                  Tous
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveFilter(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                      activeFilter === cat
                        ? "border text-text-primary"
                        : "border border-white/5 text-text-secondary hover:border-white/10"
                    }`}
                    style={
                      activeFilter === cat
                        ? {
                            borderColor: categoryColors[cat] + "60",
                            backgroundColor: categoryColors[cat] + "15",
                            color: categoryColors[cat],
                          }
                        : undefined
                    }
                  >
                    {categoryLabels[cat]}
                  </button>
                ))}
              </div>
            )}

            {/* Project cards */}
            {filteredProjects.length === 0 ? (
              <p className="text-text-tertiary text-sm">Aucun projet pour le moment.</p>
            ) : (
              <div className="space-y-8">
                {filteredProjects.map((project) => {
                  const ownerCredit = project.credits.find(
                    (c) => c.profile_id === profile.id
                  );
                  const isExpanded = expandedCredits.has(project.id);

                  return (
                    <motion.article
                      key={project.id}
                      {...cardHover}
                      className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition"
                    >
                      {/* Video embed */}
                      <VideoEmbed url={project.video_url} title={project.title} />

                      {/* Project info */}
                      <div className="p-5 sm:p-6">
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                          <Link
                            href={`/projet/${project.slug}`}
                            className="text-lg font-bold text-text-primary hover:text-lime transition"
                          >
                            {project.title}
                          </Link>
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                            style={{
                              backgroundColor: categoryColors[project.category] + "15",
                              color: categoryColors[project.category],
                              border: `1px solid ${categoryColors[project.category]}30`,
                            }}
                          >
                            {categoryLabels[project.category]}
                          </span>
                          <span className="text-text-tertiary text-xs font-mono">
                            {project.year}
                          </span>
                        </div>

                        {/* Role on project */}
                        {ownerCredit && (
                          <p className="text-sm text-text-secondary mb-2">
                            <span className="text-text-tertiary">Role :</span>{" "}
                            {ownerCredit.role_on_project}
                          </p>
                        )}

                        {/* Description */}
                        {project.description && (
                          <p className="text-sm text-text-secondary leading-relaxed mb-4">
                            {project.description}
                          </p>
                        )}

                        {/* Credits toggle */}
                        {project.credits.length > 0 && (
                          <div>
                            <button
                              onClick={() => toggleCredits(project.id)}
                              className="flex items-center gap-2 text-xs text-text-tertiary hover:text-text-secondary transition"
                            >
                              <svg
                                className={`w-3.5 h-3.5 transition-transform ${
                                  isExpanded ? "rotate-90" : ""
                                }`}
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
                              Equipe ({project.credits.length})
                            </button>

                            {isExpanded && (
                              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {project.credits.map((credit) => (
                                  <div
                                    key={credit.id}
                                    className="flex items-center gap-3 p-2.5 rounded-lg bg-background border border-white/5"
                                  >
                                    {/* Avatar */}
                                    <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/5 overflow-hidden flex-shrink-0 ring-1 ring-white/10">
                                      {credit.profile?.avatar_url ? (
                                        <img
                                          src={credit.profile.avatar_url}
                                          alt=""
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-text-tertiary">
                                          {(
                                            credit.profile?.full_name ??
                                            credit.ghost_name ??
                                            "?"
                                          ).charAt(0)}
                                        </div>
                                      )}
                                    </div>

                                    <div className="min-w-0">
                                      {credit.profile ? (
                                        <Link
                                          href={`/profil/${credit.profile.slug}`}
                                          className="text-sm font-semibold text-text-primary hover:text-lime transition truncate block"
                                        >
                                          {credit.profile.full_name}
                                        </Link>
                                      ) : (
                                        <span className="text-sm font-semibold text-text-secondary truncate block">
                                          {credit.ghost_name}
                                        </span>
                                      )}
                                      <span className="text-xs text-text-tertiary">
                                        {credit.role_on_project}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            )}
          </section>
        </FadeInView>
      </main>

      {/* Contact Modal */}
      <ContactModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        profileId={profile.id}
        profileName={profile.full_name}
      />
    </motion.div>
  );
}
