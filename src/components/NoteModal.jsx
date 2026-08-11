import { useState } from "react";
import { ISSUE_TYPES } from "../lib/constants.js";
import { postNote } from "../lib/utils.js";

const labelStyle = {
  fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
  color: "#9a9a94", marginBottom: 6, display: "block", fontWeight: 400,
};
const inputStyle = {
  width: "100%", background: "#fafaf8", border: "1px solid #e0e0da",
  color: "#1a1a16", fontSize: 13, padding: "10px 12px", borderRadius: 2,
  fontFamily: "inherit", marginBottom: 16,
};

export default function NoteModal({ knife, onClose }) {
  const [issueType, setIssueType] = useState("Steel mismatch");
  const [comment,   setComment]   = useState("");
  const [reporter,  setReporter]  = useState("");
  const [status,    setStatus]    = useState("idle"); // idle | sending | done | error
  const [errMsg,    setErrMsg]    = useState("");

  const send = async () => {
    if (!comment.trim()) return;
    setStatus("sending");
    try {
      await postNote({
        product:  knife.title,
        handle:   knife.handle,
        issueType,
        comment:  comment.trim(),
        reporter: reporter.trim() || "Anonymous",
      });
      setStatus("done");
    } catch (e) {
      setErrMsg(e.message);
      setStatus("error");
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#ffffff", width: "100%", maxWidth: 480, padding: 28, borderRadius: 2,
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        }}
      >
        {status === "done" ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#1a1a16", marginBottom: 6 }}>Note sent</div>
            <div style={{ fontSize: 13, color: "#9a9a94", marginBottom: 24 }}>
              The team will review it in Airtable.
            </div>
            <button
              onClick={onClose}
              style={{
                background: "#111111", border: "none", color: "#ffffff",
                fontSize: 11, fontWeight: 500, letterSpacing: "0.1em",
                padding: "11px 24px", cursor: "pointer", textTransform: "uppercase", borderRadius: 2,
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 500, color: "#1a1a16", marginBottom: 4 }}>Add a note</div>
                <div style={{ fontSize: 12, color: "#9a9a94" }}>{knife.title}</div>
              </div>
              <button
                onClick={onClose}
                style={{ background: "none", border: "none", color: "#c0c0ba", cursor: "pointer", fontSize: 22, lineHeight: 1, padding: 0 }}
              >
                ×
              </button>
            </div>

            <label style={labelStyle}>Issue type</label>
            <select value={issueType} onChange={(e) => setIssueType(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}>
              {ISSUE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <label style={labelStyle}>
              Comment <span style={{ color: "#e05050" }}>*</span>
            </label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder="Describe the issue…" rows={4}
              style={{ ...inputStyle, resize: "vertical" }} />

            <label style={labelStyle}>
              Your name / store <span style={{ color: "#c0c0ba" }}>(optional)</span>
            </label>
            <input value={reporter} onChange={(e) => setReporter(e.target.value)}
              placeholder="e.g. David — Tokyo store" style={inputStyle} />

            {status === "error" && (
              <div style={{ fontSize: 12, color: "#c03030", marginBottom: 12 }}>⚠ {errMsg}</div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={onClose}
                style={{
                  background: "none", border: "1px solid #e0e0da", color: "#9a9a94",
                  fontSize: 11, letterSpacing: "0.1em", padding: "10px 20px",
                  cursor: "pointer", textTransform: "uppercase", borderRadius: 2,
                }}
              >
                Cancel
              </button>
              <button
                onClick={send}
                disabled={!comment.trim() || status === "sending"}
                style={{
                  background: !comment.trim() ? "#f0f0ea" : "#111111",
                  border: "none",
                  color: !comment.trim() ? "#c0c0ba" : "#ffffff",
                  fontSize: 11, fontWeight: 500, letterSpacing: "0.1em",
                  padding: "10px 24px",
                  cursor: !comment.trim() ? "not-allowed" : "pointer",
                  textTransform: "uppercase", borderRadius: 2,
                }}
              >
                {status === "sending" ? "Sending…" : "Send note"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
