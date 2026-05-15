import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Briefcase,
  User2,
  Settings,
  LogOut,
  ChevronDown,
  Bell,
  Plus,
  Search,
  ChevronRight,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  slug: string | null;
  display_name: string | null;
};

type NavItem = {
  label: string;
  icon: React.ReactNode;
  path?: string;
  children?: { label: string; path: string }[];
};

const navItems: NavItem[] = [
  { label: "Overview", icon: <LayoutDashboard size={16} /> },
  {
    label: "Dashboards",
    icon: <Briefcase size={16} />,
    children: [
      { label: "Fall 2026 SWE", path: "/dashboard/fall-2026" },
      { label: "Summer 2027", path: "/dashboard/summer-2027" },
    ],
  },
  { label: "Career Twin", icon: <User2 size={16} /> },
  { label: "Settings", icon: <Settings size={16} /> },
];

function NavMenu({ item, active, onClick }: { item: NavItem; active: string; onClick: (label: string) => void }) {
  const [open, setOpen] = useState(false);
  const isActive = active === item.label;

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen((v) => !v)}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
            isActive ? "bg-zinc-100 text-zinc-900 font-medium" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-zinc-400">{item.icon}</span>
            {item.label}
          </div>
          <ChevronDown size={14} className={`text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <ul className="ml-4 pl-3 border-l border-zinc-100 mt-1 flex flex-col gap-0.5">
            {item.children.map((child) => (
              <li key={child.label}>
                <button
                  onClick={() => onClick(child.label)}
                  className="w-full text-left text-sm text-zinc-500 hover:text-zinc-900 px-2 py-1.5 rounded-md hover:bg-zinc-50 transition-colors"
                >
                  {child.label}
                </button>
              </li>
            ))}
            <li>
              <button className="w-full text-left text-xs text-zinc-400 hover:text-zinc-600 px-2 py-1.5 flex items-center gap-1 transition-colors">
                <Plus size={12} /> New dashboard
              </button>
            </li>
          </ul>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onClick(item.label)}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
        isActive ? "bg-zinc-100 text-zinc-900 font-medium" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
      }`}
    >
      <span className="text-zinc-400">{item.icon}</span>
      {item.label}
    </button>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState("Overview");
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    fetch(`${API}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 401) {
          localStorage.removeItem("token");
          navigate("/login");
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) setUser(data);
      })
      .catch(() => navigate("/login"))
      .finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
      </div>
    );
  }

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div className="min-h-screen bg-zinc-50 font-['DM_Sans',sans-serif] flex">

      {/* ── SIDEBAR ── */}
      <aside className="fixed top-0 left-0 w-64 h-full bg-white border-r border-zinc-100 flex flex-col z-40">

        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-zinc-100">
          <span className="text-sm font-black tracking-widest uppercase text-zinc-900">JobScout</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
          {navItems.map((item) => (
            <NavMenu
              key={item.label}
              item={item}
              active={activePage}
              onClick={setActivePage}
            />
          ))}
        </nav>

        {/* Profile footer */}
        <div className="px-3 py-3 border-t border-zinc-100">
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-50 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                {initials}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-xs font-semibold text-zinc-900 truncate">{user?.full_name || "User"}</p>
                <p className="text-[10px] text-zinc-400 truncate">{user?.email}</p>
              </div>
              <ChevronDown size={14} className={`text-zinc-400 transition-transform shrink-0 ${profileOpen ? "rotate-180" : ""}`} />
            </button>

            {profileOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-md border border-zinc-100 shadow-lg py-1">
                <div className="px-3 py-2 border-b border-zinc-50">
                  <p className="text-[10px] text-zinc-400">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-red-600 transition-colors"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="ml-64 flex-1 flex flex-col min-h-screen">

        {/* Top bar */}
        <header className="h-14 bg-white border-b border-zinc-100 flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span>JobScout</span>
            <ChevronRight size={14} />
            <span className="text-zinc-900 font-medium">{activePage}</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors">
              <Search size={16} />
            </button>
            <button className="p-2 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors">
              <Bell size={16} />
            </button>
            <button className="flex items-center gap-2 bg-zinc-900 text-white text-xs font-semibold px-3 py-2 rounded-md hover:bg-zinc-700 transition-colors">
              <Plus size={14} />
              New dashboard
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">

          {activePage === "Overview" && (
            <div>
              <div className="mb-6">
                <h1 className="text-xl font-bold text-zinc-900">
                  Good morning, {user?.full_name?.split(" ")[0] || "there"} 👋
                </h1>
                <p className="text-zinc-500 text-sm mt-0.5">Here's what's happening with your job search.</p>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Jobs matched", value: "—", sub: "this week" },
                  { label: "Applications sent", value: "—", sub: "total" },
                  { label: "CVs generated", value: "—", sub: "total" },
                  { label: "Dashboards", value: "0", sub: "active" },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="bg-white rounded-lg border border-zinc-100 px-5 py-4">
                    <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">{label}</p>
                    <p className="text-2xl font-bold text-zinc-900">{value}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>

              {/* Empty state for dashboards */}
              <div className="bg-white rounded-lg border border-zinc-100 p-12 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
                  <Briefcase size={18} className="text-zinc-400" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-1">No dashboards yet</h3>
                <p className="text-zinc-400 text-sm max-w-[30ch] mb-4">
                  Create your first job search dashboard to start matching with roles.
                </p>
                <button className="flex items-center gap-2 bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-md hover:bg-zinc-700 transition-colors">
                  <Plus size={14} />
                  Create dashboard
                </button>
              </div>
            </div>
          )}

          {activePage !== "Overview" && (
            <div className="flex items-center justify-center h-64 text-zinc-400 text-sm">
              <p>{activePage} — coming soon</p>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
