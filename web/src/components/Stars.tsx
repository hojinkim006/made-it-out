import { costLabel, costOf, type Priced } from "../lib/budget";

export function Stars({
  value,
  onRate,
  small,
  readOnly,
}: {
  value: number;
  onRate?: (n: number) => void;
  small?: boolean;
  readOnly?: boolean;
}) {
  const locked = readOnly || !onRate;
  return (
    <span className={`stars${small ? " sm" : ""}${locked ? " ro" : ""}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={n <= value ? "on" : ""}
          disabled={locked}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onClick={(e) => {
            e.stopPropagation();
            onRate?.(n);
          }}
        >
          ★
        </button>
      ))}
    </span>
  );
}

export function CostTag({ item }: { item: Priced }) {
  if (!costOf(item)) return null;
  return <span className="tag money">{costLabel(item)}</span>;
}
