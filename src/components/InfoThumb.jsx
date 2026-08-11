export default function InfoThumb({ src, link, fit = "contain" }) {
  const img = (
    <img
      src={src}
      alt=""
      style={{
        width: 72, height: 54, objectFit: fit,
        borderRadius: 2, border: "1px solid #e8e8e3",
        background: "#ffffff", display: "block", flexShrink: 0,
      }}
    />
  );
  if (link) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }}>
        {img}
      </a>
    );
  }
  return img;
}
