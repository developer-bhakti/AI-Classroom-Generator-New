import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";
import {
  Search,
  Bookmark,
  BookmarkCheck,
  Eye,
  X,
  History as HistoryIcon,
  FileText,
  BookOpen,
  HelpCircle,
  Sparkles,
  ClipboardCheck,
  Trash2
} from "lucide-react";
import {
  RESOURCE_TYPES,
  getHistory,
  clearHistory,
  removeHistoryEntry,
  saveContent,
  removeSavedContent,
  isContentSaved
} from "../Services/contentStore";

const TYPE_ICONS = {
  worksheet: FileText,
  lesson: BookOpen,
  quiz: HelpCircle,
  activity: Sparkles,
  exam: ClipboardCheck
};

const formatDateTime = (iso) => {
  const date = new Date(iso);
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

const History = () => {
  const [items, setItems] = useState(() => getHistory());
  const [activeType, setActiveType] = useState("all");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState(null);
  const [savedIds, setSavedIds] = useState(() => new Set(items.filter((item) => isContentSaved(item.id)).map((item) => item.id)));

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesType = activeType === "all" || item.type === activeType;
      const haystack = `${item.title} ${item.className} ${item.subject}`.toLowerCase();
      const matchesQuery = haystack.includes(query.trim().toLowerCase());
      return matchesType && matchesQuery;
    });
  }, [items, activeType, query]);

  const toggleSave = (item) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        removeSavedContent(item.id);
        next.delete(item.id);
      } else {
        saveContent(item);
        next.add(item.id);
      }
      return next;
    });
  };

  const handleRemoveEntry = (id) => {
    setItems(removeHistoryEntry(id));
    setPreview((current) => (current?.id === id ? null : current));
  };

  const handleClearHistory = () => {
    if (items.length === 0) return;
    if (window.confirm("Clear your entire generation history? Saved content won't be affected.")) {
      clearHistory();
      setItems([]);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-panel">
        <Navbar title="History" />
        <div className="content-area">
          <section className="page-intro">
            <div className="page-intro-badge">Activity log</div>
            <h3>Everything you've generated recently</h3>
            <p>A running log of your last 50 generations, newest first. Save the ones worth keeping.</p>
          </section>

          <div className="toolbar-row">
            <div className="filter-chip-row">
              <button type="button" className={`filter-chip ${activeType === "all" ? "active" : ""}`} onClick={() => setActiveType("all")}>
                All ({items.length})
              </button>
              {Object.entries(RESOURCE_TYPES).map(([key, meta]) => (
                <button key={key} type="button" className={`filter-chip ${activeType === key ? "active" : ""}`} onClick={() => setActiveType(key)}>
                  {meta.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div className="toolbar-search">
                <Search size={16} />
                <input placeholder="Search history" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <button type="button" className="text-btn" onClick={handleClearHistory}>
                <Trash2 size={15} /> Clear history
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="panel-card empty-state-card">
              <div className="empty-state-icon"><HistoryIcon size={26} /></div>
              <h3>{items.length === 0 ? "No activity yet" : "No matches"}</h3>
              <p>
                {items.length === 0
                  ? "Every worksheet, lesson, quiz, activity, or exam paper you generate will show up here automatically."
                  : "Try a different search term or filter."}
              </p>
              {items.length === 0 ? (
                <Link to="/dashboard" className="primary-btn">Go to Dashboard</Link>
              ) : null}
            </div>
          ) : (
            <div className="content-list">
              {filtered.map((item) => {
                const Icon = TYPE_ICONS[item.type] || FileText;
                const meta = RESOURCE_TYPES[item.type];
                const saved = savedIds.has(item.id);
                return (
                  <div key={item.id} className="panel-card content-row">
                    <div className="resource-icon"><Icon size={20} /></div>
                    <div className="content-row-body">
                      <div className="content-row-top">
                        <h3>{item.title}</h3>
                        <span className="type-badge">{meta?.label || item.type}</span>
                      </div>
                      <p className="content-row-meta">
                        {[item.className, item.subject].filter(Boolean).join(" • ")}
                        {item.className || item.subject ? " • " : ""}
                        Generated {formatDateTime(item.createdAt)}
                      </p>
                      <p className="content-row-summary">{item.summary}</p>
                    </div>
                    <div className="content-row-actions">
                      <button
                        type="button"
                        className={`row-icon-btn ${saved ? "active" : ""}`}
                        aria-label={saved ? "Remove from saved" : "Save"}
                        onClick={() => toggleSave(item)}
                      >
                        {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                      </button>
                      <button type="button" className="row-icon-btn" aria-label="View" onClick={() => setPreview(item)}>
                        <Eye size={16} />
                      </button>
                      <button type="button" className="row-icon-btn danger" aria-label="Delete" onClick={() => handleRemoveEntry(item.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {preview ? (
        <div className="profile-modal-backdrop" onClick={() => setPreview(null)}>
          <div className="profile-modal content-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>{preview.title}</h3>
              <button type="button" className="modal-close-btn" onClick={() => setPreview(null)}><X size={18} /></button>
            </div>
            <div className="profile-modal-body">
              <p>{preview.summary}</p>
              {preview.sections?.map((section) => (
                <div key={section.heading} className="output-section">
                  <h4>{section.heading}</h4>
                  <ul>
                    {section.items.map((line) => <li key={line}>{line}</li>)}
                  </ul>
                </div>
              ))}
              {preview.note ? <p className="note">{preview.note}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default History;
