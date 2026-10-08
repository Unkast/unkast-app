"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUserStatus } from "@/hooks/useUserStatus";
import Avatar from "@/components/Avatar";
import { EnterItem, EnterList } from "@/components/motion";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import GlassCard from "@/components/ui/GlassCard";

interface Conversation {
  id: string;
  other_name: string;
  other_slug: string;
  other_avatar: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

const PAGE = "mx-auto max-w-[600px] px-4 pt-5 pb-8";

function BubbleIcon() {
  return (
    <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-pill border border-lime/25 bg-lime/10 text-lime shadow-[0_0_24px_rgba(200,255,0,0.18)]">
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    </div>
  );
}

/* ── Boîte vide (compte gratuit) ── */

// Remplace, le 2026-08-10, l'ancien « Pro lock screen » (cadenas, faux aperçus
// floutés, « Débloquer la messagerie », « Passe à Pro pour les lire »). Ce
// discours est devenu FAUX avec le nouveau modèle économique : un compte
// gratuit peut recevoir des messages ET en initier vers 2 personnes. L'écran
// n'a donc plus rien à verrouiller, il annonce une boîte vide et le quota
// disponible.
function EmptyInbox({ contactsLimit }: { contactsLimit: number }) {
  return (
    <div className="mx-auto max-w-[600px] px-4 pt-12 pb-8">
      <EnterList>
        <EnterItem>
          <GlassCard radius="panel" className="px-5 py-10 text-center">
            <BubbleIcon />
            <h1 className="text-sheen mb-2 text-[26px] font-semibold">Aucune conversation</h1>
            <p className="mx-auto mb-7 max-w-[320px] text-sm leading-normal text-text-secondary">
              Avec ton compte gratuit, tu peux contacter {contactsLimit} personnes et
              répondre sans limite à celles qui t&apos;écrivent. Trouve quelqu&apos;un
              et écris-lui depuis son profil.
            </p>
            <div className="mx-auto flex max-w-[320px] flex-col gap-2.5">
              <Button href="/recherche" size="lg" className="w-full">
                Explorer les profils
              </Button>
              <Button href="/pro" variant="glass" size="lg" className="w-full">
                Contacts illimités avec Pro
              </Button>
            </div>
          </GlassCard>
        </EnterItem>
      </EnterList>
    </div>
  );
}

/* ── Squelettes en verre ── */

function RowsSkeleton() {
  return (
    <div role="status" className="space-y-2">
      <span className="sr-only">Chargement...</span>
      {[1, 2, 3, 4, 5].map((i) => (
        <GlassCard key={i} aria-hidden="true" className="flex items-center gap-3 p-3">
          <div className="size-12 shrink-0 rounded-full bg-white/10 animate-pulse" />
          <div className="min-w-0 flex-1">
            <div className="h-3.5 w-32 rounded bg-white/10 animate-pulse" />
            <div className="mt-2 h-3 w-48 max-w-full rounded bg-white/5 animate-pulse" />
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

// Tant que le statut du compte n'est pas connu : même gabarit que la liste.
function PageSkeleton() {
  return (
    <div className={PAGE}>
      <div aria-hidden="true" className="mb-4 h-9 w-40 rounded-card bg-white/10 animate-pulse" />
      <div aria-hidden="true" className="glass mb-5 h-11 rounded-card" />
      <RowsSkeleton />
    </div>
  );
}

/* ── Pro conversations list ── */

function ProConversationsList({ userPlan }: { userPlan: "free" | "pro" }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dailyCount, setDailyCount] = useState(0);
  // Quota gratuit à vie (null = inconnu ou compte Pro) — voir /api/messages/daily-count.
  const [contactsUsed, setContactsUsed] = useState<number | null>(null);
  const [contactsLimit, setContactsLimit] = useState(2);

  useEffect(() => {
    fetch("/api/messages")
      .then((r) => r.json())
      .then((data) => {
        setConversations(data.conversations || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Fetch pour les deux plans depuis le 2026-08-10 : le compte gratuit a
  // désormais lui aussi un quota à afficher (personnes contactées).
  useEffect(() => {
    fetch("/api/messages/daily-count")
      .then((r) => r.json())
      .then((data) => {
        setDailyCount(data.count ?? 0);
        setContactsUsed(typeof data.contacts_used === "number" ? data.contacts_used : null);
        if (typeof data.contacts_limit === "number") setContactsLimit(data.contacts_limit);
      })
      .catch(() => {});
  }, []);

  const filtered = conversations
    .filter((c) => c.other_name.toLowerCase().includes(search.toLowerCase()))
    .sort(
      (a, b) =>
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    );

  // Compte gratuit sans aucune conversation : boîte vide, pas un mur payant.
  // Depuis le 2026-08-10 un compte gratuit PEUT contacter (2 personnes) et
  // recevoir : lui annoncer « passe à Pro pour lire » serait faux.
  if (!loading && userPlan === "free" && conversations.length === 0) {
    return <EmptyInbox contactsLimit={contactsLimit} />;
  }

  // Même emplacement, quota différent : nouveaux contacts du jour (Pro) ou
  // personnes contactées à vie (gratuit).
  const quotaReached = userPlan === "pro" ? dailyCount >= 5 : contactsUsed !== null && contactsUsed >= contactsLimit;

  return (
    <div className={PAGE}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <h1 className="text-sheen text-[30px] font-semibold lg:text-[40px]" style={{ letterSpacing: "-0.5px" }}>
          Messages
        </h1>
        {(userPlan === "pro" || contactsUsed !== null) && (
          <p className={`pb-1.5 font-mono text-[10px] ${quotaReached ? "text-orange-400" : "text-text-secondary"}`}>
            {userPlan === "pro" ? (
              <>{dailyCount} / 5 nouveaux contacts aujourd&apos;hui</>
            ) : (
              <>{contactsUsed} / {contactsLimit} contacts gratuits</>
            )}
            {quotaReached ? " · Limite atteinte" : ""}
          </p>
        )}
      </div>

      {/* Search bar */}
      <Field
        className="mb-5"
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onClear={() => setSearch("")}
        placeholder="Rechercher une conversation..."
        aria-label="Rechercher une conversation"
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        }
      />

      {loading && <RowsSkeleton />}

      {!loading && filtered.length === 0 && (
        <GlassCard radius="panel" className="px-5 py-10 text-center">
          <BubbleIcon />
          <p className="mb-1.5 text-[15px] font-medium text-text-primary">Aucune conversation</p>
          <p className="text-[13px] text-text-secondary">
            Contacte un talent depuis son profil pour démarrer une conversation.
          </p>
        </GlassCard>
      )}

      {!loading && filtered.length > 0 && (
        <EnterList className="space-y-2">
          {filtered.map((c) => {
            const timeAgo = formatTimeAgo(c.last_message_at);
            const isUnread = c.unread_count > 0;
            return (
              <EnterItem key={c.id}>
                <Link
                  href={`/messages/${c.id}`}
                  className="group block rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
                >
                  <GlassCard
                    className={`flex items-center gap-3 p-3 transition-[border-color] duration-fast ease-glass group-hover:border-white/20 ${isUnread ? "border-lime/25" : ""}`}
                  >
                    <Avatar
                      url={c.other_avatar}
                      name={c.other_name}
                      size={48}
                      style={{ background: "rgba(200,255,0,0.08)", border: "1.5px solid rgba(200,255,0,0.2)" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className={`truncate text-sm text-text-primary ${isUnread ? "font-bold" : "font-normal"}`}>
                          {c.other_name}
                        </p>
                        <span className={`shrink-0 font-mono text-[11px] ${isUnread ? "text-lime" : "text-text-secondary"}`}>
                          {timeAgo}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-3">
                        <p className={`truncate text-[13px] ${isUnread ? "text-text-primary" : "text-text-secondary"}`}>
                          {c.last_message.slice(0, 45)}
                          {c.last_message.length > 45 ? "..." : ""}
                        </p>
                        {isUnread && (
                          <span
                            aria-label={`${c.unread_count} non lus`}
                            className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-pill px-1.5 text-[11px] font-bold leading-none text-canvas shadow-[0_0_12px_rgba(200,255,0,0.45)]"
                            style={{ background: "var(--accent-gradient)" }}
                          >
                            {c.unread_count > 99 ? "99+" : c.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                </Link>
              </EnterItem>
            );
          })}
        </EnterList>
      )}
    </div>
  );
}

/* ── Main page ── */

export default function MessagesPage() {
  const router = useRouter();
  const userStatus = useUserStatus();

  useEffect(() => {
    if (userStatus === "anonymous") {
      router.replace("/connexion");
    }
  }, [userStatus, router]);

  if (userStatus === null) return <PageSkeleton />;
  if (userStatus === "anonymous") return null;
  return <ProConversationsList userPlan={userStatus} />;
}

/* ── Helpers ── */

function formatTimeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}j`;
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}
