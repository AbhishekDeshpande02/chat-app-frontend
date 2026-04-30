import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

const WS_URL = "wss://chat-app-backend-production-d8af.up.railway.app";

/* ─── Chat Popup ─────────────────────────────────────────────── */
function ChatWindow({ onClose }) {
  /**
   * status values:
   *   connecting       – WebSocket not yet open
   *   waiting          – in the queue, no proposal yet
   *   confirming       – got a match_request, showing the popup
   *   confirming_sent  – accepted, waiting for the other side
   *   chatting         – both accepted, live chat
   *   disconnected
   */
  const [status, setStatus]       = useState("connecting");
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState("");
  const [statusMsg, setStatusMsg] = useState("Connecting to server...");
  const wsRef     = useRef(null);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  const addMsg = useCallback((msg) => {
    setMessages((prev) => [...prev, { ...msg, id: Date.now() + Math.random() }]);
  }, []);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("waiting");
      setStatusMsg("Searching for a stranger…");
    };

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);

      switch (data.type) {
        case "connected":
          setStatus("waiting");
          setStatusMsg("Finding you a partner…");
          break;

        case "match_request":
          setStatus("confirming");
          setStatusMsg("Someone is available!");
          break;

        case "paired":
          setStatus("chatting");
          setStatusMsg("Connected!");
          addMsg({ type: "system", text: "🎉 You're connected! Say hello." });
          setTimeout(() => inputRef.current?.focus(), 100);
          break;

        case "message":
          addMsg({ type: "stranger", text: data.text });
          break;

        case "skipped":
          setStatus("waiting");
          setStatusMsg(data.message || "Looking for someone else…");
          break;

        case "partner_left":
        case "system":
          setStatus("disconnected");
          setStatusMsg(data.message);
          addMsg({ type: "system", text: "👋 " + data.message });
          break;

        default:
          break;
      }
    };

    ws.onclose = () => {
      setStatus("disconnected");
      setStatusMsg("Disconnected from server.");
    };
    ws.onerror = () => {
      setStatus("disconnected");
      setStatusMsg("Connection error — is the server running?");
    };

    return () => ws.close();
  }, [addMsg]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || status !== "chatting") return;
    wsRef.current?.send(JSON.stringify({ type: "message", text }));
    addMsg({ type: "me", text });
    setInput("");
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const acceptMatch = () => {
    wsRef.current?.send(JSON.stringify({ type: "accept_chat" }));
    setStatus("confirming_sent");
    setStatusMsg("Waiting for the other person…");
  };

  const skipMatch = () => {
    wsRef.current?.send(JSON.stringify({ type: "skip_chat" }));
    setStatus("waiting");
    setStatusMsg("Skipped — searching again…");
  };

  const dotColor = {
    connecting:      "#f59e0b",
    waiting:         "#f59e0b",
    confirming:      "#a78bfa",
    confirming_sent: "#a78bfa",
    chatting:        "#10b981",
    disconnected:    "#ef4444",
  }[status] ?? "#64748b";

  const badgeLabel = {
    connecting:      "Connecting",
    waiting:         "Waiting…",
    confirming:      "Match found!",
    confirming_sent: "Confirming…",
    chatting:        "Live",
    disconnected:    "Disconnected",
  }[status] ?? status;

  return (
    <div className="overlay">
      <div className="chat-window">

        {/* ── Header ── */}
        <div className="chat-header">
          <div className="header-left">
            <div className="status-dot" style={{ background: dotColor }} />
            <span className="header-title">Anonymous Chat</span>
          </div>
          <div className="header-right">
            <span
              className="status-badge"
              style={{ background: dotColor + "22", color: dotColor }}
            >
              {badgeLabel}
            </span>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* ── Status bar (shown while not actively chatting) ── */}
        {status !== "chatting" && (
          <div className="status-bar">
            {(status === "waiting" || status === "confirming_sent") && (
              <div className="pulse-ring" />
            )}
            <span className="status-text">{statusMsg}</span>
          </div>
        )}

        {/* ── Match confirmation card ── */}
        {status === "confirming" && (
          <div className="match-card">
            <div className="match-icon">👀</div>
            <p className="match-title">Someone wants to chat!</p>
            <p className="match-sub">Start talking or find someone else?</p>
            <div className="match-btns">
              <button className="accept-btn" onClick={acceptMatch}>💬 Let's Talk</button>
              <button className="skip-btn"   onClick={skipMatch}>⏭ Skip</button>
            </div>
          </div>
        )}

        {/* ── Message area ── */}
        <div className="message-area">
          {messages.length === 0 && status === "waiting" && (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <p className="empty-text">Matching you with a stranger…</p>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`message-row message-row--${msg.type}`}
            >
              {msg.type === "system" ? (
                <div className="system-msg">{msg.text}</div>
              ) : (
                <div className={`bubble bubble--${msg.type}`}>
                  {msg.type === "stranger" && (
                    <span className="sender-label">Stranger</span>
                  )}
                  <span className="bubble-text">{msg.text}</span>
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* ── Input ── */}
        <div className="input-area">
          <input
            ref={inputRef}
            className="text-input"
            placeholder={status === "chatting" ? "Type a message…" : "Waiting…"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={status !== "chatting"}
          />
          <button
            className="send-btn"
            onClick={sendMessage}
            disabled={status !== "chatting" || !input.trim()}
          >
            ↑
          </button>
        </div>

      </div>
    </div>
  );
}

/* ─── Landing page ───────────────────────────────────────────── */
export default function App() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="page">
      <div className="bg-grid" />
      <div className="bg-glow" />

      <div className="hero">
        <h1 className="title">
          Talk to a<br />
          <span className="title-accent">Stranger.</span>
        </h1>

        <button className="cta-btn" onClick={() => setChatOpen(true)}>
          <span className="cta-btn-inner">
            <span>Get Started</span>
            <span className="cta-arrow">→</span>
          </span>
        </button>

        <div className="features">
          {["⚡ Instant pairing", "🔒 100% anonymous", "💬 Real-time chat"].map((f) => (
            <div key={f} className="feature-pill">{f}</div>
          ))}
        </div>
      </div>

      {chatOpen && <ChatWindow onClose={() => setChatOpen(false)} />}
    </div>
  );
}