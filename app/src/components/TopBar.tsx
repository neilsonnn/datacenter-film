export const TOP_BAR_HEIGHT = 56;

export function TopBar() {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        height: TOP_BAR_HEIGHT,
        boxSizing: "border-box",
        padding: "0 1.5rem",
        borderBottom: "1px solid #000",
        position: "sticky",
        top: 0,
        background: "#fff",
        zIndex: 1000,
      }}
    >
      <span style={{ fontWeight: "bold" }}>datacenter-film</span>
      <nav style={{ display: "flex", gap: "1rem" }}>
        <a href="https://github.com/neilsonnn/datacenter-film" target="_blank" rel="noopener noreferrer">
          github
        </a>
        <a href="https://x.com/neilsonks" target="_blank" rel="noopener noreferrer">
          x
        </a>
      </nav>
    </header>
  );
}
