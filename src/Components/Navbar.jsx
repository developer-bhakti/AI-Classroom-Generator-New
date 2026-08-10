import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Search, Bell, Sun, Moon, Sparkles, UserCircle2, FileText, BookOpen, HelpCircle, ClipboardCheck, X, Menu } from "lucide-react";
import { RESOURCE_TYPES, subscribeContentStore, getContentSnapshot } from "../Services/contentStore";
import { sidebarStore } from "../Services/sidebarStore";
import { useAuth } from "../context/useAuth";

const TYPE_ICONS = {
  worksheet: FileText,
  lesson: BookOpen,
  quiz: HelpCircle,
  activity: Sparkles,
  exam: ClipboardCheck
};

const Navbar = ({ title }) => {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  const [showProfile, setShowProfile] = useState(false);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [preview, setPreview] = useState(null);
  const searchInputRef = useRef(null);
  const { user, profile, isAdmin } = useAuth();
  const { history } = useSyncExternalStore(subscribeContentStore, getContentSnapshot);

  const userEmail = profile?.email || user?.email || "";
  const displayName = profile?.full_name || userEmail.split("@")[0] || "Teacher";

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set();
    const matches = [];
    for (const item of history) {
      if (seen.has(item.id)) continue;
      const haystack = `${item.title} ${item.className} ${item.subject} ${RESOURCE_TYPES[item.type]?.label || item.type}`.toLowerCase();
      if (haystack.includes(q)) {
        seen.add(item.id);
        matches.push(item);
      }
    }
    return matches.slice(0, 8);
  }, [query, history]);

  useEffect(() => {
    const currentTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    setTheme(currentTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    document.documentElement.style.colorScheme = nextTheme;
    localStorage.setItem("adiuvaret-theme", nextTheme);
    setTheme(nextTheme);
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button type="button" className="hamburger-btn" aria-label="Toggle menu" onClick={() => sidebarStore.toggle()}>
          <Menu size={20} />
        </button>
        <div>
          <p className="eyebrow">Adiuvaret AI Classroom Generator</p>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="topbar-right">
        <div className="search-wrap">
          <div className="search-pill">
            <Search size={16} />
            <input
              ref={searchInputRef}
              placeholder="Search resources"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => {
                setTimeout(() => {
                  if (document.activeElement !== searchInputRef.current) {
                    setSearchFocused(false);
                  }
                }, 150);
              }}
            />
          </div>

          {searchFocused && query.trim() ? (
            <div className="search-dropdown">
              {results.length > 0 ? (
                results.map((item) => {
                  const Icon = TYPE_ICONS[item.type] || FileText;
                  const meta = RESOURCE_TYPES[item.type];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="search-result-item"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setPreview(item);
                        setQuery("");
                        setSearchFocused(false);
                      }}
                    >
                      <span className="search-result-icon"><Icon size={16} /></span>
                      <span className="search-result-body">
                        <span className="search-result-title">{item.title}</span>
                        <span className="search-result-meta">
                          {meta?.label || item.type}
                          {item.className ? ` • ${item.className}` : ""}
                          {item.subject ? ` • ${item.subject}` : ""}
                        </span>
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="search-empty">
                  <p>Result not found</p>
                  <span>No resource matches “{query.trim()}”. Try a different title, class, or subject.</span>
                </div>
              )}
            </div>
          ) : null}
        </div>
        <div className="chip">
          <Sparkles size={16} />
          <span className="chip-label">AI ready</span>
        </div>
        <button className="icon-btn" aria-label="Notifications">
          <Bell size={16} />
        </button>
        <button className="icon-btn" aria-label="Theme toggle" onClick={toggleTheme}>
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button type="button" className="profile-pill" onClick={() => setShowProfile((prev) => !prev)}>
          <UserCircle2 size={22} />
          <span>{displayName}</span>
        </button>
      </div>

      {showProfile ? createPortal(
        <div className="profile-modal-backdrop" onClick={() => setShowProfile(false)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>Profile Details</h3>
              <button type="button" className="modal-close-btn" onClick={() => setShowProfile(false)}>×</button>
            </div>
            <div className="profile-modal-body">
              <p><strong>Name:</strong> {displayName}</p>
              <p><strong>Email:</strong> {userEmail}</p>
              <p><strong>Role:</strong> {isAdmin ? "Administrator" : "Educator"}</p>
              <Link to="/subscription" className="secondary-btn full" onClick={() => setShowProfile(false)}>
                Manage subscription
              </Link>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {preview ? createPortal(
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
        </div>,
        document.body
      ) : null}
    </header>
  );
};

export default Navbar;