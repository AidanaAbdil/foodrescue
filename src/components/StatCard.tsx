// A number card whose label is a sentence template, e.g. "Бүгін {n} берілді"
// (Kazakh puts the number inside the sentence) or "Collected today {n}". The
// text before {n} shows above the big number, any text after it below, so the
// card reads top to bottom in the right word order for each language.

const VARIANTS = {
  light: {
    box: "rounded-2xl bg-white p-4 ring-1 ring-stone-200 sm:p-5",
    text: "text-xs font-medium text-stone-500 sm:text-sm",
    value: "text-2xl font-bold sm:text-3xl",
  },
  onBrand: {
    box: "rounded-xl bg-black/15 px-5 py-3",
    text: "text-sm text-white",
    value: "text-2xl font-bold",
  },
};

type Props = { template: string; value: string | number; variant?: keyof typeof VARIANTS };

export function StatCard({ template, value, variant = "light" }: Props) {
  const [before, after = ""] = template.split("{n}").map((part) => part.trim());
  const style = VARIANTS[variant];

  return (
    <div className={style.box}>
      {/* One paragraph, so screen readers hear the whole sentence in order. */}
      <p>
        {before && <span className={`block ${style.text}`}>{before} </span>}
        <span className={`block ${style.value} ${before ? "mt-1" : ""}`}>{value}</span>
        {after && <span className={`block ${style.text}`}> {after}</span>}
      </p>
    </div>
  );
}
