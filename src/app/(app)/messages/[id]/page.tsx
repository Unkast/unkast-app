"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { use } from "react";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface OtherUser {
  id: string;
  full_name: string;
  slug: string;
  avatar_url: string | null;
}

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: conversationId } = use(params);
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [other, setOther] = useState<OtherUser | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ── Fetch messages ── */
  useEffect(() => {
    fetch(`/api/messages/${conversationId}`)
      .then((r) => {
        if (r.status === 401) {
          router.replace("/connexion");
          return null;
        }
        if (r.status === 403) {
          router.replace("/pro");
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setMessages(data.messages || []);
        setOther(data.other || null);
        setCurrentUserId(data.current_user_id || "");
        setLoading(false);
      });
  }, [conversationId, router]);

  /* ── Mark as read ── */
  useEffect(() => {
    if (!loading && conversationId) {
      fetch("/api/messages/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId }),
      }).catch(() => {});
    }
  }, [loading, conversationId]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── Realtime subscription ── */
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    import("@supabase/ssr").then(({ createBrowserClient }) => {
      const sb = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const channel = sb
        .channel(`conv-${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            setMessages((prev) => {
              const newMsg = payload.new as Message;
              // Avoid duplicates
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        )
        .subscribe();

      cleanup = () => {
        sb.removeChannel(channel);
      };
    });

    return () => {
      cleanup?.();
    };
  }, [conversationId]);

  /* ── Auto-clear coordinates error ── */
  useEffect(() => {
    if (error === "coordinates") {
      const t = setTimeout(() => setError(""), 4000);
      return () => clearTimeout(t);
    }
  }, [error]);

  /* ── Derived: is input blocked ── */
  const inputBlocked =
    error === "pro_required" ||
    error === "daily_limit" ||
    error.startsWith("wait_reply:");

  /* ── Auto-resize textarea ── */
  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "40px";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);

  /* ── Send message ── */
  async function handleSend() {
    if (!input.trim() || sending) return;
    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          content: input.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setInput("");
        if (textareaRef.current) textareaRef.current.style.height = "40px";
        if (data.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
      } else {
        // Handle specific error codes
        if (data.error === "pro_required") {
          setError("pro_required");
        } else if (data.error === "daily_limit_reached") {
          setError("daily_limit");
        } else if (data.error === "wait_for_reply") {
          setError(`wait_reply:${data.hours_remaining || 0}`);
        } else if (data.error === "coordinates_blocked") {
          setError("coordinates");
        } else {
          setError(data.message || data.error || "Erreur");
        }
      }
    } catch {
      setError("Erreur réseau");
    }
    setSending(false);
  }

  if (loading) {
    return <div style={{ padding: 20, color: "#555" }}>Chargement...</div>;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 120px)",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#f0f0f0"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {other && (
          <>
            <Link
              href={`/profil/${other.slug}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                textDecoration: "none",
                flex: 1,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "rgba(200,255,0,0.08)",
                  border: "1.5px solid rgba(200,255,0,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                {other.avatar_url ? (
                  <img
                    src={other.avatar_url}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: "50%",
                    }}
                  />
                ) : (
                  <span
                    style={{ fontSize: 12, fontWeight: 600, color: "#C8FF00" }}
                  >
                    {other.full_name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 15, fontWeight: 500, color: "#f0f0f0" }}>
                {other.full_name}
              </p>
            </Link>
            <Link
              href={`/profil/${other.slug}`}
              style={{ padding: 4, flexShrink: 0 }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#666"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </Link>
          </>
        )}
      </div>

      {/* ── Messages ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 16px 8px",
        }}
      >
        {messages.map((m) => {
          const isMine = m.sender_id === currentUserId;
          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                justifyContent: isMine ? "flex-end" : "flex-start",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  maxWidth: "75%",
                  padding: "10px 14px",
                  background: isMine ? "#C8FF00" : "#1a1a1a",
                  color: isMine ? "#0d0d0d" : "#f0f0f0",
                  borderRadius: isMine
                    ? "18px 18px 4px 18px"
                    : "18px 18px 18px 4px",
                }}
              >
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.5,
                    wordBreak: "break-word",
                  }}
                >
                  {m.content}
                </p>
                <p
                  style={{
                    fontSize: 9,
                    fontFamily: "JetBrains Mono, monospace",
                    color: isMine ? "rgba(13,13,13,0.5)" : "rgba(240,240,240,0.35)",
                    marginTop: 4,
                    textAlign: isMine ? "right" : "left",
                  }}
                >
                  {new Date(m.created_at).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── Error display ── */}
      {error === "pro_required" && (
        <div
          style={{
            margin: "0 16px 12px",
            padding: 16,
            background: "rgba(200,255,0,0.06)",
            border: "1px solid rgba(200,255,0,0.2)",
            borderRadius: 12,
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#f0f0f0",
              marginBottom: 8,
            }}
          >
            Passe à Pro pour initier une conversation
          </p>
          <Link
            href="/pro"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              background: "#C8FF00",
              color: "#0d0d0d",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 10,
              textDecoration: "none",
            }}
          >
            Découvrir Pro →
          </Link>
        </div>
      )}
      {error === "daily_limit" && (
        <div style={{ padding: "8px 16px" }}>
          <p style={{ fontSize: 13, color: "#f97316" }}>
            Limite de 5 nouveaux contacts atteinte aujourd&apos;hui. Réessaie demain.
          </p>
        </div>
      )}
      {error.startsWith("wait_reply:") && (
        <div style={{ padding: "8px 16px" }}>
          <p style={{ fontSize: 13, color: "#f97316" }}>
            Attends une réponse avant de relancer. Tu pourras écrire dans{" "}
            {error.split(":")[1]}h.
          </p>
        </div>
      )}
      {error === "coordinates" && (
        <div style={{ padding: "8px 16px" }}>
          <p
            style={{
              fontSize: 12,
              color: "#f97316",
              background: "rgba(249,115,22,0.08)",
              padding: "8px 12px",
              borderRadius: 8,
            }}
          >
            Coordonnées non autorisées dans les premiers échanges.
          </p>
        </div>
      )}
      {error &&
        error !== "pro_required" &&
        error !== "daily_limit" &&
        error !== "coordinates" &&
        !error.startsWith("wait_reply:") && (
          <div style={{ padding: "8px 16px" }}>
            <p
              style={{
                fontSize: 12,
                color: "#ef4444",
                background: "rgba(239,68,68,0.08)",
                padding: "8px 12px",
                borderRadius: 8,
              }}
            >
              {error}
            </p>
          </div>
        )}

      {/* ── Input — hidden for pro_required, disabled for other blocks ── */}
      {error !== "pro_required" && (
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            gap: 10,
            alignItems: "flex-end",
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              adjustTextarea();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Écris un message..."
            rows={1}
            disabled={inputBlocked}
            style={{
              flex: 1,
              padding: "10px 14px",
              background: "#1a1a1a",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              fontSize: 14,
              color: inputBlocked ? "#555" : "#f0f0f0",
              outline: "none",
              resize: "none",
              minHeight: 40,
              maxHeight: 120,
              lineHeight: 1.4,
              fontFamily: "inherit",
              cursor: inputBlocked ? "not-allowed" : "text",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending || inputBlocked}
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: input.trim() && !inputBlocked ? "#C8FF00" : "#1a1a1a",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: input.trim() && !inputBlocked ? "pointer" : "not-allowed",
              flexShrink: 0,
              transition: "background 0.2s",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill={input.trim() && !inputBlocked ? "#0d0d0d" : "#555"}
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
