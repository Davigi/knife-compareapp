import { useState } from "react";

export default function Collapsible({ title, children, open: defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderTop: "1px solid #e8e8e3" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "13px 0", cursor: "pointer", userSelect: "none",
        }}
      >
        <span style={{
          fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
          color: "#9a9a94", fontWeight: 400,
        }}>
          {title}
        </span>
        <span className={`rot-plus${open ? " open" : ""}`}
          style={{ color: "#c0c0ba", fontSize: 18, lineHeight: 1 }}>
          +
        </span>
      </div>
      <div className={`coll-body${open ? " open" : ""}`}>
        <div style={{ paddingBottom: 16 }}>{children}</div>
      </div>
    </div>
  );
}
