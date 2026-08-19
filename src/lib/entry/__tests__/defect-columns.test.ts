// The defect grid coming up blank, and counts vanishing mid-entry.
//
// Reported as "sometimes the defects disappear while making an entry".

import { nextDefectColumns, type DefectColumn } from "../defect-columns";

const cols = (...keys: string[]): DefectColumn[] => keys.map((key) => ({ key, name: key }));
const NONE: Record<string, number> = {};

describe("the pre-schema empty set is never frozen", () => {
  it("accepts the real columns even though the form is already 'touched'", () => {
    // The exact sequence that broke it: a draft is restored on mount, which
    // marks the form touched, while /api/entry-template is still in flight.
    // The freeze used to latch here and the grid stayed empty for good.
    const next = nextDefectColumns({
      prev: [],
      incoming: cols("PS", "BM", "SD"),
      stageChanged: false,
      touched: true,
      values: { PS: 4 }, // restored from the draft, and rendering nowhere
    });
    expect(next.map((d) => d.key)).toEqual(["PS", "BM", "SD"]);
  });

  it("so a restored count becomes visible again", () => {
    const next = nextDefectColumns({
      prev: [],
      incoming: cols("PS", "BM"),
      stageChanged: false,
      touched: true,
      values: { PS: 4 },
    });
    expect(next.some((d) => d.key === "PS")).toBe(true);
  });
});

describe("a live schema swap cannot disturb work in progress", () => {
  it("keeps the current columns once the operator has typed a quantity", () => {
    const prev = cols("PS", "BM");
    const next = nextDefectColumns({
      prev,
      incoming: cols("TOTALLY", "DIFFERENT"),
      stageChanged: false,
      touched: true,
      values: NONE,
    });
    expect(next).toBe(prev);
  });

  it("keeps them when only a defect has been typed, with no quantity yet", () => {
    // Itemising reasons before filling the counts left `touched` false under
    // the old test, so a late template response could swap the grid.
    const prev = cols("PS", "BM");
    const next = nextDefectColumns({
      prev,
      incoming: cols("X", "Y"),
      stageChanged: false,
      touched: false,
      values: { PS: 2 },
    });
    expect(next).toBe(prev);
  });

  it("adopts a new set on an untouched form", () => {
    const next = nextDefectColumns({
      prev: cols("PS"),
      incoming: cols("A", "B"),
      stageChanged: false,
      touched: false,
      values: NONE,
    });
    expect(next.map((d) => d.key)).toEqual(["A", "B"]);
  });

  it("is a no-op when the schema re-sends an identical set", () => {
    const prev = cols("PS", "BM");
    const next = nextDefectColumns({
      prev,
      incoming: cols("PS", "BM"),
      stageChanged: false,
      touched: false,
      values: NONE,
    });
    // Same reference — a new array here would re-render the whole grid on
    // every schema poll.
    expect(next).toBe(prev);
  });
});

describe("a column holding a count is never dropped", () => {
  it("freezes the whole set when a tile holds a count, retired column included", () => {
    // A count you cannot see is one you cannot correct, and it still saves.
    // The freeze covers this: any typed defect pins the current columns, so a
    // schema that stops listing RETIRED cannot take the tile away.
    const prev = cols("PS", "RETIRED");
    const next = nextDefectColumns({
      prev,
      incoming: cols("PS", "NEW"),
      stageChanged: false,
      touched: false,
      values: { RETIRED: 3 },
    });
    expect(next).toBe(prev);
    expect(next.map((d) => d.key)).toContain("RETIRED");
  });

  it("drops a retired column that holds nothing", () => {
    const next = nextDefectColumns({
      prev: cols("PS", "RETIRED"),
      incoming: cols("PS", "NEW"),
      stageChanged: false,
      touched: false,
      values: NONE,
    });
    expect(next.map((d) => d.key)).toEqual(["PS", "NEW"]);
  });
});

describe("changing station", () => {
  it("takes the new station's columns outright", () => {
    // The caller clears the counts in the same step, so there is nothing to
    // carry — Visual's reasons must not appear on Balloon.
    const next = nextDefectColumns({
      prev: cols("PS", "BM"),
      incoming: cols("VALVE-LEAK"),
      stageChanged: true,
      touched: true,
      values: { PS: 9 },
    });
    expect(next.map((d) => d.key)).toEqual(["VALVE-LEAK"]);
  });
});
