import { SHAPE_BLADES } from "../lib/constants.js";

export default function ShapeIcon({ shape }) {
  const points = SHAPE_BLADES[shape];
  if (!points) return null;
  return (
    <svg viewBox="0 0 102 42" style={{ width: 72, height: 30, flexShrink: 0, display: "block" }}>
      <rect x="2" y="15" width="17" height="12" rx="2" fill="#3a3a36" />
      <polygon points={points} fill="#d8d8d2" stroke="#9a9a94" strokeWidth="1" />
    </svg>
  );
}
