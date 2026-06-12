/** A small ⓘ icon with a hover/focus tooltip explaining a field, with an optional example. */
export function InfoTip({ title, lines, example }: { title: string; lines: string[]; example?: string }) {
  return (
    <span className="info-tip" tabIndex={0} aria-label="Help">
      <span className="info-tip-icon">ⓘ</span>
      <span className="info-tip-pop" role="tooltip">
        <strong>{title}</strong>
        {lines.map((l) => (
          <span key={l}>{l}</span>
        ))}
        {example && <code className="info-tip-example">{example}</code>}
      </span>
    </span>
  );
}
