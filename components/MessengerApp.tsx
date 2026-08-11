"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, Search, Image as ImageIcon, Send, Users, X, Plus, Trash2 } from "lucide-react";

const EVERYONE_KEY = "everyone";
const POLL_MS = 2500;
const DIRECTORY_POLL_MS = 5000;

// ---------- helpers ----------
function hueFromName(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % 360;
}
function avatarStyle(name) {
  const hue = hueFromName(name || "?");
  return { background: `linear-gradient(135deg, hsl(${hue} 70% 58%), hsl(${(hue + 45) % 360} 70% 42%))` };
}
function initials(name) {
  return (name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
function formatTime(t) {
  return new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function pairKey(a, b) {
  return [a, b].sort((x, y) => x.localeCompare(y)).join("::");
}
async function compressImage(file: File, maxDim = 720, quality = 0.6): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new window.Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

// ---------- server API helpers (the passcode gate already ran in middleware) ----------
async function getDirectory() {
  try {
    const res = await fetch("/api/directory");
    const data = await res.json();
    return data.names || [];
  } catch {
    return [];
  }
}
async function joinDirectory(name) {
  try {
    const res = await fetch("/api/directory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    return data.names || [];
  } catch {
    return [];
  }
}
async function getThread(key) {
  try {
    const res = await fetch(`/api/thread/${encodeURIComponent(key)}`);
    const data = await res.json();
    return data.messages || [];
  } catch {
    return [];
  }
}
async function appendToThread(key, msg) {
  await fetch(`/api/thread/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: msg }),
  });
}
async function deleteFromThread(key, messageId, requesterName) {
  const res = await fetch(`/api/thread/${encodeURIComponent(key)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageId, requesterName }),
  });
  return res.ok;
}
async function getGroups() {
  try {
    const res = await fetch("/api/groups");
    const data = await res.json();
    return data.groups || [];
  } catch {
    return [];
  }
}
async function createGroup(name, members) {
  try {
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, members }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.group || null;
  } catch {
    return null;
  }
}

export default function App() {
  const [phase, setPhase] = useState("loading"); // loading -> name -> app (passcode is checked server-side, before this ever loads)
  const [nameInput, setNameInput] = useState("");
  const [myName, setMyName] = useState("");

  const [screen, setScreen] = useState("list");
  const [activeKey, setActiveKey] = useState<string | null>(null); // thread storage key
  const [activeLabel, setActiveLabel] = useState(""); // display name for header
  const [activeIsGroup, setActiveIsGroup] = useState(false);
  const [directory, setDirectory] = useState<string[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [threadMsgs, setThreadMsgs] = useState<any[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const fileRef = useRef(null);
  const scrollRef = useRef(null);

  // on load, skip the name screen entirely if this browser already has one saved
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("iuo_name") : null;
    if (saved) {
      setMyName(saved);
      setPhase("app");
      joinDirectory(saved).then(setDirectory); // make sure they still show up even after a data reset
    } else {
      setPhase("name");
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [threadMsgs]);

  // refresh directory + groups while on the list screen
  useEffect(() => {
    if (phase !== "app" || screen !== "list") return;
    let cancelled = false;
    const tick = async () => {
      const [d, g] = await Promise.all([getDirectory(), getGroups()]);
      if (!cancelled) { setDirectory(d); setGroups(g); }
    };
    tick();
    const id = setInterval(tick, DIRECTORY_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [phase, screen]);

  // poll the open thread
  useEffect(() => {
    if (phase !== "app" || screen !== "chat" || !activeKey) return;
    let cancelled = false;
    const tick = async () => {
      const m = await getThread(activeKey);
      if (!cancelled) setThreadMsgs(m);
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [phase, screen, activeKey]);

  const handleName = async () => {
    const n = nameInput.trim();
    if (!n) return;
    window.localStorage.setItem("iuo_name", n);
    setMyName(n);
    const d = await joinDirectory(n);
    setDirectory(d);
    setPhase("app");
  };

  const switchUser = () => {
    if (!window.confirm("Switch to a different name on this device?")) return;
    window.localStorage.removeItem("iuo_name");
    setMyName("");
    setNameInput("");
    setScreen("list");
    setPhase("name");
  };

  const openChat = (key, label, isGroup) => {
    setActiveKey(key);
    setActiveLabel(label);
    setActiveIsGroup(isGroup);
    setScreen("chat");
  };

  const openNewGroup = () => {
    setNewGroupName("");
    setNewGroupMembers([]);
    setScreen("newGroup");
  };

  const toggleGroupMember = (name) => {
    setNewGroupMembers((cur) => (cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name]));
  };

  const submitNewGroup = async () => {
    const name = newGroupName.trim();
    if (!name || newGroupMembers.length === 0 || creatingGroup) return;
    setCreatingGroup(true);
    const group = await createGroup(name, [myName, ...newGroupMembers]);
    setCreatingGroup(false);
    if (!group) {
      window.alert("Couldn't create the group — try again.");
      return;
    }
    const fresh = await getGroups();
    setGroups(fresh);
    openChat(`group:${group.id}`, group.name, true);
  };

  const sendText = async () => {
    const text = draft.trim();
    if (!text || !activeKey || sending) return;
    setDraft("");
    const msg = { id: `${Date.now()}-${Math.random()}`, from: myName, type: "text", text, t: Date.now() };
    setThreadMsgs((m) => [...m, msg]);
    setSending(true);
    await appendToThread(activeKey, msg);
    setSending(false);
  };

  const sendImages = async (fileList: FileList) => {
    if (!activeKey) return;
    for (const file of Array.from(fileList).slice(0, 3)) {
      try {
        const url = await compressImage(file);
        const msg = { id: `${Date.now()}-${Math.random()}`, from: myName, type: "image", url, t: Date.now() };
        setThreadMsgs((m) => [...m, msg]);
        await appendToThread(activeKey, msg);
      } catch {
        // skip files that fail to read/compress
      }
    }
  };

  const deleteMessage = async (messageId) => {
    if (!activeKey) return;
    if (!window.confirm("Delete this message for everyone?")) return;
    // optimistic: swap it to a tombstone locally right away
    setThreadMsgs((m) => m.map((msg) => (msg.id === messageId ? { id: msg.id, from: msg.from, t: msg.t, type: "deleted" } : msg)));
    const ok = await deleteFromThread(activeKey, messageId, myName);
    if (!ok) {
      // failed server-side — resync with the real state
      const fresh = await getThread(activeKey);
      setThreadMsgs(fresh);
    }
  };

  if (phase === "loading") {
    return <GatePhone><div /></GatePhone>;
  }

  if (phase === "name") {
    return (
      <GatePhone>
        <div style={styles.gateWrap}>
          <div style={styles.gateIcon}><Users size={22} color={ACCENT} /></div>
          <span style={styles.gateTitle}>What's your name?</span>
          <span style={styles.gateSub}>This is how your circle will see you.</span>
          <input
            style={styles.gateInput}
            placeholder="Your name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleName()}
            autoFocus
          />
          <button style={{ ...styles.gateBtn, opacity: nameInput.trim() ? 1 : 0.5 }} onClick={handleName} disabled={!nameInput.trim()}>
            Join
          </button>
        </div>
      </GatePhone>
    );
  }

  const others = directory.filter((n) => n !== myName);
  const filteredOthers = others.filter((n) => n.toLowerCase().includes(query.toLowerCase()));

  return (
    <div style={styles.page}>
      <style>{fontImport}</style>
      <div style={styles.phone}>
        <div style={styles.notch} />
        <div style={styles.statusBar}>
          <span style={styles.statusTime}>{formatTime(Date.now())}</span>
          <div style={styles.statusIcons}>
            <span style={styles.statusDot} /><span style={styles.statusDot} /><span style={{ ...styles.statusDot, opacity: 0.4 }} />
          </div>
        </div>

        {screen === "list" ? (
          <div style={styles.screen}>
            <div style={styles.listHeader}>
              <span style={styles.appTitle}>Internal Use Only</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button style={styles.newGroupBtn} onClick={openNewGroup} aria-label="New group" title="New group">
                  <Plus size={16} color="#08201B" />
                </button>
                <button style={{ ...styles.avatarSm, ...avatarStyle(myName), border: "none", cursor: "pointer", padding: 0 }} onClick={switchUser} aria-label="Switch user" title="Not you? Switch user">
                  <span style={styles.avatarInitialsSm}>{initials(myName)}</span>
                </button>
              </div>
            </div>

            <div style={styles.searchWrap}>
              <Search size={16} color={TEXT_SECONDARY} style={{ flexShrink: 0 }} />
              <input style={styles.searchInput} placeholder="Search your circle" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>

            <div style={styles.chatScroll}>
              <button style={styles.chatRow} onClick={() => openChat(EVERYONE_KEY, "Everyone", true)}>
                <div style={{ ...styles.avatar, background: `linear-gradient(135deg, ${GOLD}, #C77E1B)` }}>
                  <Users size={20} color="#3A2405" />
                </div>
                <div style={styles.chatRowBody}>
                  <div style={styles.chatRowTop}><span style={styles.chatName}>Everyone</span></div>
                  <div style={styles.chatRowBottom}><span style={styles.chatPreview}>Group chat for your whole circle</span></div>
                </div>
              </button>

              {groups
                .filter((g) => Array.isArray(g.members) && g.members.includes(myName))
                .map((g) => (
                  <button key={g.id} style={styles.chatRow} onClick={() => openChat(`group:${g.id}`, g.name, true)}>
                    <div style={{ ...styles.avatar, ...avatarStyle(g.name) }}>
                      <Users size={18} color="rgba(255,255,255,0.92)" />
                    </div>
                    <div style={styles.chatRowBody}>
                      <div style={styles.chatRowTop}><span style={styles.chatName}>{g.name}</span></div>
                      <div style={styles.chatRowBottom}><span style={styles.chatPreview}>{g.members.length} members</span></div>
                    </div>
                  </button>
                ))}

              {filteredOthers.map((name) => (
                <button key={name} style={styles.chatRow} onClick={() => openChat(pairKey(myName, name), name, false)}>
                  <div style={{ ...styles.avatar, ...avatarStyle(name) }}>
                    <span style={styles.avatarInitials}>{initials(name)}</span>
                  </div>
                  <div style={styles.chatRowBody}>
                    <div style={styles.chatRowTop}><span style={styles.chatName}>{name}</span></div>
                    <div style={styles.chatRowBottom}><span style={styles.chatPreview}>Tap to open conversation</span></div>
                  </div>
                </button>
              ))}

              {others.length === 0 && (
                <div style={styles.emptyState}>No one else has joined with this link yet. Share it (and the passcode) with your circle.</div>
              )}
            </div>
          </div>
        ) : screen === "newGroup" ? (
          <div style={styles.screen}>
            <div style={styles.chatHeader}>
              <button style={styles.iconBtn} onClick={() => setScreen("list")} aria-label="Back"><ArrowLeft size={20} color={TEXT} /></button>
              <span style={styles.chatHeaderName}>New group</span>
            </div>

            <div style={{ padding: "14px 16px 6px" }}>
              <input
                style={styles.searchInput2}
                placeholder="Group name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ padding: "4px 16px 8px" }}>
              <span style={styles.sectionLabel}>Add people from your circle</span>
            </div>

            <div style={styles.chatScroll}>
              {others.map((name) => {
                const selected = newGroupMembers.includes(name);
                return (
                  <button key={name} style={styles.chatRow} onClick={() => toggleGroupMember(name)}>
                    <div style={{ ...styles.avatar, ...avatarStyle(name) }}>
                      <span style={styles.avatarInitials}>{initials(name)}</span>
                    </div>
                    <div style={styles.chatRowBody}>
                      <div style={styles.chatRowTop}><span style={styles.chatName}>{name}</span></div>
                    </div>
                    <div style={{ ...styles.checkbox, ...(selected ? styles.checkboxOn : {}) }} />
                  </button>
                );
              })}
              {others.length === 0 && (
                <div style={styles.emptyState}>No one else has joined with this link yet, so there's no one to add.</div>
              )}
            </div>

            <div style={{ padding: "10px 16px 20px" }}>
              <button
                style={{ ...styles.gateBtn, marginTop: 0, opacity: newGroupName.trim() && newGroupMembers.length > 0 && !creatingGroup ? 1 : 0.5 }}
                onClick={submitNewGroup}
                disabled={!newGroupName.trim() || newGroupMembers.length === 0 || creatingGroup}
              >
                {creatingGroup ? "Creating…" : `Create group${newGroupMembers.length ? ` (${newGroupMembers.length + 1})` : ""}`}
              </button>
            </div>
          </div>
        ) : (
          <div style={styles.screen}>
            <div style={styles.chatHeader}>
              <button style={styles.iconBtn} onClick={() => setScreen("list")} aria-label="Back"><ArrowLeft size={20} color={TEXT} /></button>
              {activeIsGroup ? (
                <div style={{ ...styles.avatarSm, background: `linear-gradient(135deg, ${GOLD}, #C77E1B)` }}>
                  <Users size={16} color="#3A2405" />
                </div>
              ) : (
                <div style={{ ...styles.avatarSm, ...avatarStyle(activeLabel) }}>
                  <span style={styles.avatarInitialsSm}>{initials(activeLabel)}</span>
                </div>
              )}
              <div style={styles.chatHeaderText}>
                <span style={styles.chatHeaderName}>{activeLabel}</span>
                <span style={styles.chatHeaderStatus}>
                  {activeIsGroup
                    ? `${activeKey === EVERYONE_KEY ? directory.length : (groups.find((g) => `group:${g.id}` === activeKey)?.members?.length ?? "?")} in this group`
                    : "syncing…"}
                </span>
              </div>
            </div>

            <div style={styles.messageScroll} ref={scrollRef}>
              {threadMsgs.length === 0 && <div style={styles.emptyState}>No messages yet — say hi.</div>}
              {threadMsgs.map((m) => (
                <Bubble key={m.id} msg={m} mine={m.from === myName} showAuthor={activeIsGroup && m.from !== myName} onImageTap={setLightbox} onDelete={deleteMessage} />
              ))}
            </div>

            <div style={styles.composer}>
              <button style={styles.iconBtn} onClick={() => fileRef.current?.click()} aria-label="Send image"><ImageIcon size={20} color={TEXT_SECONDARY} /></button>
              <input
                style={styles.composerInput}
                placeholder="Message"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendText()}
              />
              <button style={{ ...styles.sendBtn, opacity: draft.trim() ? 1 : 0.5 }} onClick={sendText} disabled={!draft.trim()} aria-label="Send">
                <Send size={16} color="#0C1116" />
              </button>
            </div>
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }}
          onChange={(e) => { if (e.target.files?.length) sendImages(e.target.files); e.target.value = ""; }} />
      </div>

      {lightbox && (
        <div style={styles.lightboxOverlay} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Full size" style={styles.lightboxImg} />
          <button style={styles.lightboxClose} onClick={() => setLightbox(null)}><X size={20} color={TEXT} /></button>
        </div>
      )}
    </div>
  );
}

function GatePhone({ children }) {
  return (
    <div style={styles.page}>
      <style>{fontImport}</style>
      <div style={styles.phone}>
        <div style={styles.notch} />
        <div style={styles.statusBar}>
          <span style={styles.statusTime}>{formatTime(Date.now())}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Bubble({ msg, mine, showAuthor, onImageTap, onDelete }) {
  const canDelete = mine && msg.type !== "deleted";
  return (
    <div style={{ ...styles.bubbleRow, justifyContent: mine ? "flex-end" : "flex-start" }}>
      {canDelete && (
        <button style={styles.deleteBtn} onClick={() => onDelete(msg.id)} aria-label="Delete for everyone" title="Delete for everyone">
          <Trash2 size={13} color={TEXT_SECONDARY} />
        </button>
      )}
      <div style={{ ...styles.bubble, ...(mine ? styles.bubbleMe : styles.bubbleThem) }}>
        {showAuthor && <span style={styles.bubbleAuthor}>{msg.from}</span>}
        {msg.type === "deleted" ? (
          <span style={styles.bubbleDeleted}>{mine ? "You deleted this message" : "This message was deleted"}</span>
        ) : msg.type === "image" ? (
          <img src={msg.url} alt="Sent" style={styles.bubbleImage} onClick={() => onImageTap(msg.url)} />
        ) : (
          <span style={styles.bubbleText}>{msg.text}</span>
        )}
        <div style={styles.bubbleMeta}><span style={styles.bubbleTime}>{formatTime(msg.t)}</span></div>
      </div>
    </div>
  );
}

// ---------- styles ----------
const fontImport = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');`;
const ACCENT = "#2DD4BF";
const ACCENT_DARK = "#14B8A6";
const GOLD = "#F2B84B";
const BG = "#0C1116";
const SURFACE = "#141B22";
const SURFACE_2 = "#1E2731";
const TEXT = "#ECF2F5";
const TEXT_SECONDARY = "#7C8A99";
const BORDER = "#232D38";

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 30% 20%, #10161D 0%, #05070A 75%)", fontFamily: "'Inter', sans-serif", padding: "32px 16px" },
  phone: { width: 375, height: 780, background: BG, borderRadius: 44, border: `1px solid ${BORDER}`, boxShadow: "0 30px 80px rgba(0,0,0,0.55)", overflow: "hidden", position: "relative", display: "flex", flexDirection: "column" },
  notch: { position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 150, height: 24, background: BG, borderRadius: "0 0 16px 16px", zIndex: 5 },
  statusBar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 26px 4px", color: TEXT, flexShrink: 0 },
  statusTime: { fontSize: 13, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" },
  statusIcons: { display: "flex", gap: 4 },
  statusDot: { width: 4, height: 4, borderRadius: 2, background: TEXT },

  gateWrap: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", gap: 6, textAlign: "center" },
  gateIcon: { width: 48, height: 48, borderRadius: 24, background: SURFACE_2, border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 },
  gateTitle: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 19, color: TEXT },
  gateSub: { fontSize: 13, color: TEXT_SECONDARY, marginBottom: 16, lineHeight: 1.4 },
  gateInput: { width: "100%", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px", color: TEXT, fontSize: 15, outline: "none", textAlign: "center", fontFamily: "'Inter', sans-serif" },
  gateError: { color: "#F2897E", fontSize: 12, marginTop: 8 },
  gateBtn: { marginTop: 16, width: "100%", background: ACCENT, border: "none", borderRadius: 12, padding: "12px 0", color: "#08201B", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Inter', sans-serif" },

  screen: { flex: 1, display: "flex", flexDirection: "column", minHeight: 0 },
  listHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px 6px" },
  appTitle: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 24, color: TEXT, letterSpacing: -0.5 },

  searchWrap: { display: "flex", alignItems: "center", gap: 8, background: SURFACE, margin: "6px 16px 4px", padding: "9px 12px", borderRadius: 12, border: `1px solid ${BORDER}` },
  searchInput: { flex: 1, background: "transparent", border: "none", outline: "none", color: TEXT, fontSize: 14, fontFamily: "'Inter', sans-serif" },
  searchInput2: { width: "100%", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "10px 14px", color: TEXT, fontSize: 15, outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box" },
  sectionLabel: { fontSize: 12, color: TEXT_SECONDARY, textTransform: "uppercase", letterSpacing: 0.4 },
  newGroupBtn: { width: 30, height: 30, borderRadius: 15, background: ACCENT, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  checkbox: { width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${BORDER}`, flexShrink: 0 },
  checkboxOn: { background: ACCENT, borderColor: ACCENT },

  chatScroll: { flex: 1, overflowY: "auto", padding: "4px 8px 8px" },
  chatRow: { width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 10px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", borderRadius: 14 },
  avatar: { width: 50, height: 50, borderRadius: 25, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarInitials: { color: "rgba(255,255,255,0.92)", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 16 },
  chatRowBody: { flex: 1, minWidth: 0 },
  chatRowTop: { display: "flex", justifyContent: "space-between", marginBottom: 3 },
  chatName: { fontSize: 15, fontWeight: 600, color: TEXT, fontFamily: "'Inter', sans-serif" },
  chatRowBottom: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 },
  chatPreview: { fontSize: 13, color: TEXT_SECONDARY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 },
  emptyState: { textAlign: "center", color: TEXT_SECONDARY, fontSize: 13, padding: "40px 24px", lineHeight: 1.5 },

  chatHeader: { display: "flex", alignItems: "center", gap: 10, padding: "8px 12px 12px", borderBottom: `1px solid ${BORDER}` },
  iconBtn: { width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", borderRadius: 17, flexShrink: 0 },
  avatarSm: { width: 34, height: 34, borderRadius: 17, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarInitialsSm: { color: "rgba(255,255,255,0.92)", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 12 },
  chatHeaderText: { display: "flex", flexDirection: "column", minWidth: 0 },
  chatHeaderName: { fontSize: 15, fontWeight: 600, color: TEXT, fontFamily: "'Inter', sans-serif" },
  chatHeaderStatus: { fontSize: 12, color: ACCENT },

  messageScroll: { flex: 1, overflowY: "auto", padding: "14px 12px", display: "flex", flexDirection: "column" },
  bubbleRow: { display: "flex", marginBottom: 8 },
  bubble: { maxWidth: "76%", padding: "8px 11px 6px", borderRadius: 16, position: "relative" },
  bubbleMe: { background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`, borderBottomRightRadius: 4 },
  bubbleThem: { background: SURFACE_2, borderBottomLeftRadius: 4, border: `1px solid ${BORDER}` },
  bubbleAuthor: { display: "block", fontSize: 12, fontWeight: 700, color: GOLD, marginBottom: 2 },
  bubbleText: { fontSize: 14.5, lineHeight: 1.4, color: TEXT, whiteSpace: "pre-wrap", wordBreak: "break-word" },
  bubbleImage: { width: 190, height: 190, objectFit: "cover", borderRadius: 12, display: "block", cursor: "zoom-in", marginBottom: 2 },
  bubbleMeta: { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 3, marginTop: 2 },
  bubbleTime: { fontSize: 10.5, color: "rgba(255,255,255,0.55)" },
  bubbleDeleted: { fontSize: 13.5, fontStyle: "italic", color: "rgba(255,255,255,0.5)" },
  deleteBtn: {
    alignSelf: "center", width: 24, height: 24, borderRadius: 12, border: "none",
    background: SURFACE, display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", margin: "0 6px", opacity: 0.55, flexShrink: 0,
  },

  composer: { display: "flex", alignItems: "center", gap: 6, padding: "8px 10px 18px", borderTop: `1px solid ${BORDER}` },
  composerInput: { flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 20, padding: "9px 14px", color: TEXT, fontSize: 14, outline: "none", fontFamily: "'Inter', sans-serif" },
  sendBtn: { width: 34, height: 34, borderRadius: 17, background: ACCENT, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 },

  lightboxOverlay: { position: "fixed", inset: 0, background: "rgba(4,6,9,0.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 24 },
  lightboxImg: { maxWidth: "100%", maxHeight: "100%", borderRadius: 12 },
  lightboxClose: { position: "absolute", top: 24, right: 24, width: 38, height: 38, borderRadius: 19, background: "rgba(255,255,255,0.12)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
};
