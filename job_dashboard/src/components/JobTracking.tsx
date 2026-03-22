// src/components/JobTracking.tsx
import { useState, useRef, useEffect } from "react";

const OUTCOMES = [
  "No update",
  "OA to do",
  "OA done (waiting)",
  "Interview to do (scheduled)",
  "Interview done (waiting response)",
  "Rejected",
  "Ghosted",
  "Offer",
];

function getOutcomeStyle(outcome: string | null) {
  switch (outcome) {
    case "OA to do":
    case "OA done (waiting)":
      return "bg-amber-900 text-amber-300 border-amber-600";
    case "Interview to do (scheduled)":
    case "Interview done (waiting response)":
      return "bg-blue-900 text-blue-300 border-blue-600";
    case "Rejected":
    case "Ghosted":
      return "bg-red-950 text-red-400 border-red-700";
    case "Offer":
      return "bg-green-900 text-green-300 border-green-600";
    default:
      return "bg-gray-800 text-gray-400 border-gray-600";
  }
}

function getDeadlineStyle(dateStr: string | null) {
  if (!dateStr) return { pill: "bg-gray-800 text-gray-500 border-gray-700", label: null };
  const today = new Date(); today.setHours(0,0,0,0);
  const deadline = new Date(dateStr); deadline.setHours(0,0,0,0);
  const days = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0)  return { pill: "bg-red-950 text-red-400 border-red-800",       label: `${Math.abs(days)}d overdue` };
  if (days <= 3) return { pill: "bg-red-900 text-red-300 border-red-600",        label: `${days}d left` };
  if (days <= 7) return { pill: "bg-orange-900 text-orange-300 border-orange-600", label: `${days}d left` };
  if (days <= 14) return { pill: "bg-yellow-900 text-yellow-300 border-yellow-600", label: `${days}d left` };
  return { pill: "bg-green-900 text-green-300 border-green-700", label: `${days}d left` };
}

interface JobTrackingProps {
  feedbackStatus: string | null;
  deadline: string | null;
  notes: string | null;
  onFeedbackChange: (val: string) => void;
  onDeadlineChange: (val: string | null) => void;
  onNotesChange: (val: string) => void;
}

function JobTracking({ feedbackStatus, deadline, notes, onFeedbackChange, onDeadlineChange, onNotesChange }: JobTrackingProps) {
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState(notes ?? "");
  const [notesOpen, setNotesOpen] = useState(false);
  const outcomeRef = useRef<HTMLDivElement>(null);
  const deadlineRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const [pendingDeadline, setPendingDeadline] = useState(deadline ?? "");
    
  const outcome = feedbackStatus || "No update";
  const { pill, label } = getDeadlineStyle(deadline);


  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (outcomeRef.current && !outcomeRef.current.contains(e.target as Node)) setOutcomeOpen(false);
      if (deadlineRef.current && !deadlineRef.current.contains(e.target as Node)) setDeadlineOpen(false);
      if (notesRef.current && !notesRef.current.contains(e.target as Node)) {
        if (notesDraft !== (notes ?? "")) onNotesChange(notesDraft);
        setNotesOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notesDraft, notes, onNotesChange]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-100">Tracking</h3>

      {/* Outcome */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Outcome</label>
        <div className="relative" ref={outcomeRef}>
          <button
            onClick={() => setOutcomeOpen(o => !o)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded text-xs font-medium border-2 w-full justify-between ${getOutcomeStyle(outcome)}`}
          >
            {outcome}
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {outcomeOpen && (
            <div className="absolute z-50 mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
              {OUTCOMES.map(o => (
                <button
                  key={o}
                  onClick={() => { onFeedbackChange(o); setOutcomeOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-800 transition-colors ${o === outcome ? "font-medium text-blue-400" : "text-gray-300"}`}
                >
                  {o}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Deadline */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Deadline</label>
        <div className="relative" ref={deadlineRef}>
          <button
            onClick={() => setDeadlineOpen(o => !o)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded text-xs font-medium border-2 w-full justify-between ${pill}`}
          >
            <span>
              {deadline
                ? new Date(deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "Set deadline"}
            </span>
            {label && <span className="opacity-70">{label}</span>}
          </button>
        {deadlineOpen && (
        <div className="absolute z-50 mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3">
            <p className="text-xs text-gray-400 mb-2">Pick a deadline</p>
            <input
            type="date"
            value={pendingDeadline}
            onChange={e => setPendingDeadline(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2 mt-2">
            <button
                onClick={() => { onDeadlineChange(pendingDeadline || null); setDeadlineOpen(false); }}
                className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors font-medium"
            >
                Confirm
            </button>
            {deadline && (
                <button
                onClick={() => { onDeadlineChange(null); setPendingDeadline(""); setDeadlineOpen(false); }}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-red-400 text-xs rounded transition-colors border border-gray-700"
                >
                Clear
                </button>
            )}
            </div>
        </div>
        )}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Notes</label>
        <div className="relative" ref={notesRef}>
          <button
            onClick={() => setNotesOpen(o => !o)}
            className={`w-full text-left px-3 py-2 rounded text-xs font-medium border-2 truncate ${
              notes ? "bg-gray-800 text-gray-200 border-gray-600" : "bg-gray-900 text-gray-500 border-gray-700"
            }`}
            title={notes ?? ""}
          >
            {notes ? notes.slice(0, 40) + (notes.length > 40 ? "…" : "") : "Add a note..."}
          </button>
          {notesOpen && (
            <div className="absolute z-50 mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3">
              <textarea
                autoFocus
                value={notesDraft}
                onChange={e => setNotesDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && e.metaKey) { onNotesChange(notesDraft); setNotesOpen(false); }
                  if (e.key === "Escape") setNotesOpen(false);
                }}
                placeholder="Add notes about this job..."
                rows={4}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-500">⌘↵ to save</span>
                <button
                  onClick={() => { onNotesChange(notesDraft); setNotesOpen(false); }}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default JobTracking;