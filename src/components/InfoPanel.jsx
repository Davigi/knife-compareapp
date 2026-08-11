import ShapeIcon from "./ShapeIcon.jsx";
import InfoThumb from "./InfoThumb.jsx";

export default function InfoPanel({ section, infoMap }) {
  const data = infoMap?.[section];

  if (!data) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "#d0d0ca", fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  return (
    <div>
      <div style={{
        fontSize: 22, fontWeight: 300, color: "#1a1a16", textAlign: "left",
        letterSpacing: "0.02em", marginBottom: 24,
      }}>
        {data.heading}
      </div>

      {data.groups.map((g, gi) => (
        <div key={gi} style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
            color: "#b0b0aa", marginBottom: 12, paddingBottom: 8, textAlign: "left",
            borderBottom: "1px solid #e8e8e3", fontWeight: 500,
          }}>
            {g.name}
          </div>

          {g.items.map((item, ii) => {
            const showSvg = item.shape && !item.img;
            return (
              <div key={ii} style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 16 }}>
                {showSvg && <ShapeIcon shape={item.shape} />}
                {item.img && (
                  <InfoThumb
                    src={item.img}
                    link={item.link}
                    fit={section === "Shape" ? "contain" : "cover"}
                  />
                )}
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a16", marginBottom: 3 }}>
                    {item.n}
                  </div>
                  <div style={{ fontSize: 13, color: "#6b6b66", lineHeight: 1.65 }}>
                    {item.d}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
