export function FilmPicker({
  films,
  selected,
  onSelect,
}: {
  films: string[];
  selected: string | null;
  onSelect: (film: string) => void;
}) {
  return (
    <select value={selected ?? ""} onChange={(e) => onSelect(e.target.value)}>
      <option value="" disabled>
        select a film
      </option>
      {films.map((f) => (
        <option key={f} value={f}>
          {f}
        </option>
      ))}
    </select>
  );
}
