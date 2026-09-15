import {
  Activity,
  BookOpen,
  Braces,
  Brain,
  FileSearch,
  Highlighter,
  Image,
  ListChecks,
  MessageSquare,
  Moon,
  MoreHorizontal,
  PanelLeft,
  PencilLine,
  Pin,
  Plus,
  Search,
  SpellCheck,
  StickyNote,
  Sun,
  Trash2,
  Copy,
  Home,
} from "lucide-react";

const SIZE = 18;
const STROKE = 1.75;

export function NavIcon({ name }) {
  const props = { size: SIZE, strokeWidth: STROKE, "aria-hidden": true };
  switch (name) {
    case "chat":
      return <MessageSquare {...props} />;
    case "page":
      return <FileSearch {...props} />;
    case "explain":
      return <Highlighter {...props} />;
    case "image":
      return <Image {...props} />;
    case "summarize":
      return <ListChecks {...props} />;
    case "rewrite":
      return <PencilLine {...props} />;
    case "proofread":
      return <SpellCheck {...props} />;
    case "extract":
      return <Braces {...props} />;
    case "study":
      return <BookOpen {...props} />;
    case "notes":
      return <StickyNote {...props} />;
    case "memory":
      return <Brain {...props} />;
    case "status":
      return <Activity {...props} />;
    case "home":
      return <Home {...props} />;
    default:
      return <MessageSquare {...props} />;
  }
}

export function PlusIconLucide() {
  return <Plus size={16} strokeWidth={2} aria-hidden />;
}

export function SearchIcon() {
  return <Search size={16} strokeWidth={1.75} aria-hidden />;
}

export function PanelIcon() {
  return <PanelLeft size={16} strokeWidth={1.75} aria-hidden />;
}

export function PinIcon() {
  return <Pin size={14} strokeWidth={1.75} aria-hidden />;
}

export function MoreIcon() {
  return <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden />;
}

export function SunIcon() {
  return <Sun size={16} strokeWidth={1.75} aria-hidden />;
}

export function MoonIcon() {
  return <Moon size={16} strokeWidth={1.75} aria-hidden />;
}

export function CopyIcon() {
  return <Copy size={14} strokeWidth={1.75} aria-hidden />;
}

export function TrashIcon() {
  return <Trash2 size={14} strokeWidth={1.75} aria-hidden />;
}
