// Categorical palette for the category-breakdown pie chart.
// Validated with the dataviz skill's six-checks validator (light mode, surface #fcfcfb):
// all PASS except a contrast WARN on the gold/sky-blue slots, which is why every
// chart that uses this palette ships a legend + tooltip (the required relief channel).
export const CATEGORY_PALETTE = [
  '#0D9488', // teal   (brand primary)
  '#F59E0B', // amber  (brand secondary)
  '#EF4444', // coral  (brand alert)
  '#6366F1', // indigo
  '#16A34A', // green
  '#0EA5E9', // sky blue
];
export const OTHER_SLICE_COLOR = '#A8A29E'; // stone-400, de-emphasis gray for the "Other" fold
export const CATEGORY_SLICE_CAP = 6;

// Diverging pair for income (in) vs expense (out) around a zero baseline —
// reuses the app's existing teal/coral accents so the semantic (teal = good,
// coral = watch it) stays consistent with the rest of the UI.
export const INCOME_COLOR = '#0D9488';
export const EXPENSE_COLOR = '#EF4444';

// Status ramp for budget meters: good -> warning -> critical.
export const STATUS_GOOD = '#0D9488';
export const STATUS_WARNING = '#F59E0B';
export const STATUS_CRITICAL = '#EF4444';

export const GRID_COLOR = '#E7E5E4'; // one step off the app's --bg-app surface
export const AXIS_TEXT_COLOR = '#78716C';

/**
 * Folds a sorted [{ categoryId, categoryName, total, color }] list down to at
 * most CATEGORY_SLICE_CAP entries + an "Other" bucket, and assigns a color to
 * any slice that doesn't already carry a user-picked Category.color.
 */
export function assignSliceColors(rows) {
  if (!rows || rows.length === 0) return [];

  const visible = rows.slice(0, CATEGORY_SLICE_CAP);
  const rest = rows.slice(CATEGORY_SLICE_CAP);

  const colored = visible.map((row, i) => ({
    ...row,
    color: row.color || CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
  }));

  if (rest.length > 0) {
    const otherTotal = rest.reduce((sum, r) => sum + r.total, 0);
    colored.push({
      categoryId: 'other',
      categoryName: 'Other',
      total: otherTotal,
      color: OTHER_SLICE_COLOR,
    });
  }

  return colored;
}
