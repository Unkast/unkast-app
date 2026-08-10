"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUserStatus } from "@/hooks/useUserStatus";
import Avatar from "@/components/Avatar";

interface Conversation {
  id: string;
  other_name: string;
  other_slug: string;
  other_avatar: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
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
    <div style={{ padding: "48px 16px 120px", maxWidth: 600, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#C8FF00"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ margin: "0 auto", opacity: 0.5 }}
        >
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      </div>

      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "#f0f0f0",
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        Aucune conversation
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "#666",
          textAlign: "center",
          maxWidth: 320,
          margin: "0 auto 28px",
          lineHeight: 1.5,
        }}
      >
        Avec ton compte gratuit, tu peux contacter {contactsLimit} personnes et
        répondre sans limite à celles qui t&apos;écrivent. Trouve quelqu&apos;un
        et écris-lui depuis son profil.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
        <Link
          href="/recherche"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            maxWidth: 320,
            padding: "14px 24px",
            background: "#C8FF00",
            color: "#0d0d0d",
            fontWeight: 600,
            fontSize: 15,
            borderRadius: 12,
            textDecoration: "none",
          }}
        >
          Explorer les profils
        </Link>
        <Link
          href="/pro"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            maxWidth: 320,
            padding: "14px 24px",
            background: "transparent",
            color: "#f0f0f0",
            fontWeight: 500,
            fontSize: 14,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.1)",
            textDecoration: "none",
          }}
        >
          Contacts illimités avec Pro
        </Link>
      </div>
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

  return (
    <div style={{ padding: "20px 16px 120px", maxWidth: 600, margin: "0 auto" }}>
      {userPlan === "pro" && (
        <p
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 10,
            color: dailyCount >= 5 ? "#f97316" : "#555",
            textAlign: "right",
            padding: "8px 20px",
          }}
        >
          {dailyCount} / 5 nouveaux contacts aujourd&apos;hui
          {dailyCount >= 5 ? " · Limite atteinte" : ""}
        </p>
      )}
      {/* Même emplacement, quota différent : personnes contactées à vie. */}
      {userPlan === "free" && contactsUsed !== null && (
        <p
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 10,
            color: contactsUsed >= contactsLimit ? "#f97316" : "#555",
            textAlign: "right",
            padding: "8px 20px",
          }}
        >
          {contactsUsed} / {contactsLimit} contacts gratuits
          {contactsUsed >= contactsLimit ? " · Limite atteinte" : ""}
        </p>
      )}
      <h1
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: "#f0f0f0",
          letterSpacing: "-0.5px",
          marginBottom: 16,
        }}
      >
        Messages
      </h1>

      {/* Search bar */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une conversation..."
          style={{
            width: "100%",
            padding: "12px 14px",
            background: "#1a1a1a",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            fontSize: 14,
            color: "#f0f0f0",
            outline: "none",
          }}
        />
      </div>

      {loading && <p style={{ color: "#555", fontSize: 13 }}>Chargement...</p>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <svg
            style={{ margin: "0 auto 16px", opacity: 0.3 }}
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#C8FF00"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
            />
          </svg>
          <p style={{ fontSize: 15, fontWeight: 500, color: "#f0f0f0", marginBottom: 6 }}>
            Aucune conversation
          </p>
          <p style={{ fontSize: 13, color: "#555" }}>
            Contacte un talent depuis son profil pour démarrer une conversation.
          </p>
        </div>
      )}

      {!loading &&
        filtered.map((c) => {
          const timeAgo = formatTimeAgo(c.last_message_at);
          const isUnread = c.unread_count > 0;
          return (
            <Link
              key={c.id}
              href={`/messages/${c.id}`}
              style={{
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 0",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <Avatar
                url={c.other_avatar}
                name={c.other_name}
                size={48}
                style={{ background: "rgba(200,255,0,0.08)", border: "1.5px solid rgba(200,255,0,0.2)" }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: isUnread ? 700 : 400,
                      color: "#f0f0f0",
                    }}
                  >
                    {c.other_name}
                  </p>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#444",
                      fontFamily: "JetBrains Mono, monospace",
                      flexShrink: 0,
                    }}
                  >
                    {timeAgo}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <p
                    style={{
                      fontSize: 13,
                      color: isUnread ? "#999" : "#555",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.last_message.slice(0, 45)}
                    {c.last_message.length > 45 ? "..." : ""}
                  </p>
                  {isUnread && (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#C8FF00",
                        flexShrink: 0,
                      }}
                    />
                  )}
                </div>
              </div>
            </Link>
          );
        })}
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

  if (userStatus === null) return null;
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
