import { useState } from "react";
import { NAV_GROUPS } from "../features/navigation.js";
import {
  MoreIcon,
  NavIcon,
  PanelIcon,
  PinIcon,
  PlusIconLucide,
  SearchIcon,
} from "./Icons.jsx";

export function Sidebar({
  view,
  onView,
  conversations,
  conversationId,
  onSelectConversation,
  onNewChat,
  onPin,
  onRename,
  onDelete,
  onDuplicate,
  search,
  onSearch,
  searchResults,
  collapsed,
  onToggle,
}) {
  const [menuId, setMenuId] = useState(null);

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-top">
        <button type="button" className="brand-btn" onClick={() => onView("home")} title="Home">
          <img className="brand-mark" src="./favicon.svg" alt="" width="28" height="28" />
          {collapsed ? null : (
            <span className="brand-copy">
              <strong>Local AI</strong>
              <small>On this device</small>
            </span>
          )}
        </button>
        {collapsed ? null : (
          <button type="button" className="icon-btn ghost" onClick={onToggle} aria-label="Collapse sidebar">
            <PanelIcon />
          </button>
        )}
      </div>

      <button type="button" className="new-chat-btn" onClick={onNewChat} title="New chat">
        <PlusIconLucide />
        {collapsed ? null : <span>New chat</span>}
      </button>

      {collapsed ? (
        <nav className="sidebar-nav rail" aria-label="Local AI">
          {NAV_GROUPS.flatMap((group) => group.items).map((item) => (
            <button
              key={item.id}
              type="button"
              className={view === item.id ? "active" : ""}
              title={item.label}
              onClick={() => onView(item.id)}
            >
              <NavIcon name={item.icon} />
            </button>
          ))}
        </nav>
      ) : (
        <>
          <div className="sidebar-tools">
            <p className="nav-label">Tools</p>
            <nav className="sidebar-nav" aria-label="Local AI tools">
              {NAV_GROUPS.map((group) => (
                <div className="nav-group" key={group.id}>
                  <p className="nav-label">{group.label}</p>
                  <div className="nav-group-items">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={view === item.id ? "active" : ""}
                        onClick={() => onView(item.id)}
                      >
                        <NavIcon name={item.icon} />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>

          <div className="sidebar-chats">
            <div className="sidebar-search">
              <SearchIcon />
              <input
                type="search"
                placeholder="Search"
                value={search}
                onChange={(event) => onSearch(event.target.value)}
                aria-label="Search locally"
              />
            </div>

            <div className="sidebar-list">
              {search.trim() ? (
                <>
                  {(searchResults || []).slice(0, 20).map((hit) => (
                    <button
                      key={`${hit.type}-${hit.id}`}
                      type="button"
                      className="conv-open"
                      onClick={() => {
                        if (hit.type === "conversation") onSelectConversation(hit.id);
                        else if (hit.type === "note") onView("notes");
                        else onView("memory");
                      }}
                    >
                      <small>{hit.type}</small>
                      <span>{hit.title}</span>
                    </button>
                  ))}
                  {searchResults?.length === 0 ? <p className="sidebar-empty">No local matches.</p> : null}
                </>
              ) : (
                <>
                  <p className="nav-label">Chats</p>
                  {conversations.length === 0 ? (
                    <p className="sidebar-empty">Your conversations will show up here.</p>
                  ) : null}
                  {conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`conv-row ${conversation.id === conversationId ? "active" : ""}`}
                    >
                      <button
                        type="button"
                        className="conv-open"
                        onClick={() => onSelectConversation(conversation.id)}
                      >
                        {conversation.pinned ? <PinIcon /> : null}
                        <span>{conversation.title}</span>
                      </button>
                      <div className="conv-menu">
                        <button
                          type="button"
                          className="icon-btn ghost tiny"
                          aria-label="Chat actions"
                          onClick={() => setMenuId(menuId === conversation.id ? null : conversation.id)}
                        >
                          <MoreIcon />
                        </button>
                        {menuId === conversation.id ? (
                          <div className="menu-pop" role="menu">
                            <button type="button" onClick={() => { onPin(conversation); setMenuId(null); }}>
                              {conversation.pinned ? "Unpin" : "Pin"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const title = window.prompt("Rename conversation", conversation.title);
                                if (title) onRename(conversation.id, title);
                                setMenuId(null);
                              }}
                            >
                              Rename
                            </button>
                            <button type="button" onClick={() => { onDuplicate(conversation.id); setMenuId(null); }}>
                              Duplicate
                            </button>
                            <button type="button" className="danger" onClick={() => { onDelete(conversation.id); setMenuId(null); }}>
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {collapsed ? (
        <div className="sidebar-foot">
          <button
            type="button"
            className="icon-btn ghost"
            onClick={onToggle}
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelIcon />
          </button>
        </div>
      ) : null}
    </aside>
  );
}
