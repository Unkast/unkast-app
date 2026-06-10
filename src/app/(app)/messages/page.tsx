"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUserStatus } from "@/hooks/useUserStatus";

interface Conversation {
  id: string;
  other_name: string;
  other_slug: string;
  other_avatar: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

/* ── Pro lock screen ── */

function ProLockScreen() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch("/api/messages/unread-count")
      .then((r) => r.json())
      .then((data) => setUnreadCount(data.count ?? 0))
      .catch(() => {});
  }, []);

  const features = [
    "Messages illimités avec les pros",
    "Notifications en temps réel",
    "Historique complet des échanges",
  ];

  return (
    <div style={{ padding: "20px 16px 120px", maxWidth: 600, margin: "0 auto" }}>
      {/* Unread banner */}
      {unreadCount > 0 && (
        <div
          style={{
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 12,
            padding: "12px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#ef4444",
              flexShrink: 0,
            }}
          />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#ef4444" }}>
              Tu as {unreadCount} message{unreadCount > 1 ? "s" : ""} non lu
              {unreadCount > 1 ? "s" : ""}
            </p>
            <p style={{ fontSize: 12, color: "#ef4444", opacity: 0.8, marginTop: 2 }}>
              Passe à Pro pour les lire
            </p>
          </div>
        </div>
      )}

      {/* Fake conversation previews */}
      <div style={{ position: "relative", marginBottom: 32 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "#222",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ width: "40%", height: 12, background: "#222", borderRadius: 6 }} />
                <div style={{ width: "70%", height: 10, background: "#1a1a1a", borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
        {/* Blur gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(13,13,13,0.3) 0%, rgba(13,13,13,0.95) 100%)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            borderRadius: 12,
          }}
        />
      </div>

      {/* Lock icon */}
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
          style={{ margin: "0 auto" }}
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      </div>

      {/* Title & description */}
      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: "#f0f0f0",
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        Messagerie directe
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
        Contacte directement les talents du cinéma et de l&apos;audiovisuel.
        Envoie des propositions, discute de projets.
      </p>

      {/* Features */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginBottom: 28,
          maxWidth: 320,
          margin: "0 auto 28px",
        }}
      >
        {features.map((feat) => (
          <div key={feat} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#C8FF00"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span style={{ fontSize: 14, color: "#ccc" }}>{feat}</span>
          </div>
        ))}
      </div>

      {/* CTA buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
        <Link
          href="/pro"
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
          Débloquer la messagerie
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
          Rejoindre la liste d&apos;attente
        </Link>
      </div>

      {/* Price tag */}
      <p
        style={{
          textAlign: "center",
          fontSize: 10,
          color: "#333",
          fontFamily: "JetBrains Mono, monospace",
          marginTop: 16,
        }}
      >
        Bientôt disponible · 9,99€/mois
      </p>
    </div>
  );
}

/* ── Pro conversations list ── */

function ProConversationsList({ userPlan }: { userPlan: "free" | "pro" }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dailyCount, setDailyCount] = useState(0);

  useEffect(() => {
    fetch("/api/messages")
      .then((r) => r.json())
      .then((data) => {
        setConversations(data.conversations || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (userPlan === "pro") {
      fetch("/api/messages/daily-count")
        .then((r) => r.json())
        .then((data) => setDailyCount(data.count ?? 0))
        .catch(() => {});
    }
  }, [userPlan]);

  const filtered = conversations
    .filter((c) => c.other_name.toLowerCase().includes(search.toLowerCase()))
    .sort(
      (a, b) =>
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    );

  // Free user with no conversations → show lock screen
  if (!loading && userPlan === "free" && conversations.length === 0) {
    return <ProLockScreen />;
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
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "rgba(200,255,0,0.08)",
                  border: "1.5px solid rgba(200,255,0,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                {c.other_avatar ? (
                  <img
                    src={c.other_avatar}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: "50%",
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#C8FF00" }}>
                    {c.other_name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                )}
              </div>
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
