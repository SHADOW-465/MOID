// Which defect tiles the entry form shows, and when that set may change.
//
// The form renders `activeDefects`, a frozen copy of the station's defect list
// from the live schema. It is frozen because /api/entry-template can answer (or
// re-answer, after a Data Schema edit) at any moment, and swapping the columns
// under someone mid-entry loses their work.
//
// Getting the freeze wrong is how defect counts "disappeared" on the floor, so
// the decision lives here as one pure function instead of inline in a 2,900-line
// component where nothing could reach it.

export interface DefectColumn {
  key: string;
  name?: string;
}

export interface DefectColumnInput<T extends DefectColumn = DefectColumn> {
  /** What the form is showing now. */
  prev: T[];
  /** What the live schema says this station has. */
  incoming: T[];
  /** The operator moved to a different station. */
  stageChanged: boolean;
  /** They have typed a quantity, restored a draft, or been prefilled. */
  touched: boolean;
  /** Defect key → count currently entered. */
  values: Record<string, number>;
}

const sameColumns = (a: DefectColumn[], b: DefectColumn[]): boolean =>
  a.length === b.length && a.every((d, i) => d.key === b[i]?.key && d.name === b[i]?.name);

/**
 * The column set to render next.
 *
 * The freeze does the work, and it turns on for a typed DEFECT as well as a
 * typed quantity — so any tile holding a count is protected wholesale, and no
 * count can be left keyed to a column that stopped rendering.
 *
 * The one rule that is easy to get wrong: never freeze an EMPTY set. Restoring
 * a draft marks the form touched while the schema request is still in flight,
 * so `incoming` is still empty at that moment. A guard that only asked "touched
 * and same station?" pinned the form to that empty list permanently — the
 * restored counts stayed in state, still submitted, and rendered nowhere. There
 * is nothing to protect until real columns exist.
 */
export function nextDefectColumns<T extends DefectColumn>(input: DefectColumnInput<T>): T[] {
  const { prev, incoming, stageChanged, touched, values } = input;

  const hasTypedDefect = Object.values(values).some((v) => v > 0);
  const haveColumns = prev.length > 0;
  if (haveColumns && !stageChanged && (touched || hasTypedDefect)) return prev;

  // Same reference when nothing moved — a new array re-renders the whole grid
  // on every schema poll.
  return sameColumns(prev, incoming) ? prev : incoming;
}
