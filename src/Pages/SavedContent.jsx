import React, { useMemo, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";
import {
  Search,
  Bookmark,
  Trash2,
  Eye,
  X,
  FolderKanban,
  FileText,
  BookOpen,
  HelpCircle,
  Sparkles,
  ClipboardCheck
} from "lucide-react";
import {
  RESOURCE_TYPES,
  removeSavedContent,
  subscribeContentStore,
  getContentSnapshot
} from "../Services/contentStore";

const TYPE_ICONS = {
  worksheet: FileText,
  lesson: BookOpen,
  quiz: HelpCircle,
  activity: Sparkles,
  exam: ClipboardCheck
};

const formatDate = (iso) => {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const SavedContent = () => {
  const { saved: items } = useSyncExternalStore(subscribeContentStore, getContentSnapshot);
  const [activeType, setActiveType] = useState("all");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState(null);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesType = activeType === "all" || item.type === activeType;
      const haystack = `${item.title} ${item.className} ${item.subject}`.toLowerCase();
      const matchesQuery = haystack.includes(query.trim().toLowerCase());
      return matchesType && matchesQuery;
    });
  }, [items, activeType, query]);

  const handleRemove = async (id) => {
    setPreview((current) => (current?.id === id ? null : current));
    await removeSavedContent(id);
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-panel">
        <Navbar title="Saved Content" />
        <div className="content-area">
          <section className="page-intro">
            <div className="page-intro-badge">Your library</div>
            <h3>Everything you've bookmarked</h3>
            <p>Quick access to the worksheets, lesson plans, quizzes, activities, and exam papers you chose to keep.</p>
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
            <div className="toolbar-search">
              <Search size={16} />
              <input placeholder="Search saved content" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="panel-card empty-state-card">
              <div className="empty-state-icon"><FolderKanban size={26} /></div>
              <h3>{items.length === 0 ? "Nothing saved yet" : "No matches"}</h3>
              <p>
                {items.length === 0
                  ? "Generate a resource and tap Save to build your library here."
                  : "Try a different search term or filter."}
              </p>
              {items.length === 0 ? (
                <Link to="/worksheet" className="primary-btn">Start creating</Link>
              ) : null}
            </div>
          ) : (
            <div className="content-list">
              {filtered.map((item) => {
                const Icon = TYPE_ICONS[item.type] || FileText;
                const meta = RESOURCE_TYPES[item.type];
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
                        Saved {formatDate(item.savedAt || item.createdAt)}
                      </p>
                      <p className="content-row-summary">{item.summary}</p>
                    </div>
                    <div className="content-row-actions">
                      <button type="button" className="row-icon-btn" aria-label="View" onClick={() => setPreview(item)}>
                        <Eye size={16} />
                      </button>
                      <button type="button" className="row-icon-btn danger" aria-label="Remove" onClick={() => handleRemove(item.id)}>
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
              <button
                type="button"
                className="secondary-btn full"
                onClick={() => handleRemove(preview.id)}
              >
                <Bookmark size={16} /> Remove from Saved
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SavedContent;
