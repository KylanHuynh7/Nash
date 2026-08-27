export type BalancePlayer = {
  id: string;
  name: string;
  overall: number;
  position: string;
  /** Only used to keep spillover placements sane; balancing ignores it. */
  heightInches?: number | null;
};

export type Constraint = { a: string; b: string };

export type BalanceOptions = {
  teamCount: number;
  /** Pairs that must end up on the same team. */
  together?: Constraint[];
  /** Pairs that must end up on opposite teams. */
  apart?: Constraint[];
  /** Changing the seed produces a different valid split. */
  seed?: number;
};

export type BalancedTeam = {
  players: BalancePlayer[];
  total: number;
  average: number;
};

export type BalanceResult = {
  teams: BalancedTeam[];
  /** Difference between the strongest and weakest team average. */
  spread: number;
  /** Unsatisfiable constraints, if any. Empty on a clean solve. */
  unmet: Constraint[];
};

/** Small deterministic PRNG so a given seed always yields the same teams. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Players locked together move as a single unit through the draft, which makes
 * "together" constraints structurally impossible to violate.
 */
type Unit = { members: BalancePlayer[]; total: number; size: number };

function buildUnits(players: BalancePlayer[], together: Constraint[]): Unit[] {
  const parent = new Map(players.map((p) => [p.id, p.id]));
  const find = (id: string): string => {
    const up = parent.get(id);
    if (up === undefined || up === id) return id;
    const root = find(up);
    parent.set(id, root);
    return root;
  };
  for (const { a, b } of together) {
    if (!parent.has(a) || !parent.has(b)) continue;
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  const groups = new Map<string, BalancePlayer[]>();
  for (const p of players) {
    const root = find(p.id);
    const bucket = groups.get(root);
    if (bucket) bucket.push(p);
    else groups.set(root, [p]);
  }

  return [...groups.values()].map((members) => ({
    members,
    total: members.reduce((sum, m) => sum + m.overall, 0),
    size: members.length,
  }));
}

/** Target roster size for each team, distributing the remainder to the first teams. */
function targetSizes(playerCount: number, teamCount: number): number[] {
  const base = Math.floor(playerCount / teamCount);
  const extra = playerCount % teamCount;
  return Array.from(
    { length: teamCount },
    (_, i) => base + (i < extra ? 1 : 0),
  );
}

function cost(
  assignment: Unit[][],
  sizes: number[],
  positions: string[],
  positionTotals: Map<string, number>,
  playerCount: number,
  apart: Constraint[],
): number {
  const teamCount = assignment.length;
  const totals = assignment.map((units) =>
    units.reduce((s, u) => s + u.total, 0),
  );
  const counts = assignment.map((units) =>
    units.reduce((s, u) => s + u.size, 0),
  );

  // Strength: penalise deviation of each team's average from the overall average.
  const grandTotal = totals.reduce((s, t) => s + t, 0);
  const globalAvg = playerCount > 0 ? grandTotal / playerCount : 0;
  let strength = 0;
  for (let t = 0; t < teamCount; t++) {
    if (counts[t] === 0) continue;
    const diff = totals[t] / counts[t] - globalAvg;
    strength += diff * diff;
  }

  // Size: teams should hit their target roster size.
  let size = 0;
  for (let t = 0; t < teamCount; t++) {
    const diff = counts[t] - sizes[t];
    size += diff * diff;
  }

  // Positions: spread each position evenly rather than stacking five guards.
  let shape = 0;
  for (const pos of positions) {
    const totalAtPos = positionTotals.get(pos) ?? 0;
    for (let t = 0; t < teamCount; t++) {
      const have = assignment[t].reduce(
        (s, u) => s + u.members.filter((m) => m.position === pos).length,
        0,
      );
      const ideal =
        playerCount > 0 ? (totalAtPos * counts[t]) / playerCount : 0;
      const diff = have - ideal;
      shape += diff * diff;
    }
  }

  // Keep-apart pairs that landed together.
  let violations = 0;
  const teamOf = new Map<string, number>();
  assignment.forEach((units, t) => {
    for (const u of units) for (const m of u.members) teamOf.set(m.id, t);
  });
  for (const { a, b } of apart) {
    const ta = teamOf.get(a);
    const tb = teamOf.get(b);
    if (ta !== undefined && ta === tb) violations++;
  }

  return strength * 3 + size * 120 + shape * 1.6 + violations * 5000;
}

export function balanceTeams(
  players: BalancePlayer[],
  options: BalanceOptions,
): BalanceResult {
  const teamCount = Math.max(
    2,
    Math.min(options.teamCount, Math.max(2, players.length)),
  );
  const together = options.together ?? [];
  const apart = options.apart ?? [];
  const rand = mulberry32(options.seed ?? 1);

  if (players.length === 0) {
    return {
      teams: Array.from({ length: teamCount }, () => emptyTeam()),
      spread: 0,
      unmet: [],
    };
  }

  const units = buildUnits(players, together);
  const sizes = targetSizes(players.length, teamCount);
  const positions = [...new Set(players.map((p) => p.position))];
  const positionTotals = new Map<string, number>();
  for (const p of players)
    positionTotals.set(p.position, (positionTotals.get(p.position) ?? 0) + 1);

  const evaluate = (assignment: Unit[][]) =>
    cost(assignment, sizes, positions, positionTotals, players.length, apart);

  let best: Unit[][] | null = null;
  let bestCost = Infinity;

  const restarts = 240;
  for (let attempt = 0; attempt < restarts; attempt++) {
    // Greedy seed: strongest units first, each to whichever team currently
    // looks weakest. A little jitter keeps restarts from all converging.
    const order = [...units].sort(
      (x, y) => y.total / y.size - x.total / x.size + (rand() - 0.5) * 14,
    );
    const assignment: Unit[][] = Array.from({ length: teamCount }, () => []);
    const totals = new Array(teamCount).fill(0);
    const counts = new Array(teamCount).fill(0);

    for (const unit of order) {
      let target = 0;
      let targetScore = Infinity;
      for (let t = 0; t < teamCount; t++) {
        const overflow = Math.max(0, counts[t] + unit.size - sizes[t]);
        const score = totals[t] + overflow * 900 + rand() * 3;
        if (score < targetScore) {
          targetScore = score;
          target = t;
        }
      }
      assignment[target].push(unit);
      totals[target] += unit.total;
      counts[target] += unit.size;
    }

    // Hill climb: swap or move units while it keeps improving.
    let current = evaluate(assignment);
    let improved = true;
    let guard = 0;
    while (improved && guard++ < 60) {
      improved = false;
      for (let a = 0; a < teamCount && !improved; a++) {
        for (let b = a + 1; b < teamCount && !improved; b++) {
          for (let i = 0; i < assignment[a].length && !improved; i++) {
            // Move a unit across.
            const moved = assignment[a].splice(i, 1)[0];
            assignment[b].push(moved);
            const movedCost = evaluate(assignment);
            if (movedCost < current - 1e-9) {
              current = movedCost;
              improved = true;
              break;
            }
            assignment[b].pop();
            assignment[a].splice(i, 0, moved);

            // Swap it with each unit on the other team.
            for (let j = 0; j < assignment[b].length; j++) {
              const ua = assignment[a][i];
              const ub = assignment[b][j];
              assignment[a][i] = ub;
              assignment[b][j] = ua;
              const swapCost = evaluate(assignment);
              if (swapCost < current - 1e-9) {
                current = swapCost;
                improved = true;
                break;
              }
              assignment[a][i] = ua;
              assignment[b][j] = ub;
            }
          }
        }
      }
    }

    if (current < bestCost) {
      bestCost = current;
      best = assignment.map((team) => [...team]);
    }
  }

  const solution =
    best ?? Array.from({ length: teamCount }, () => [] as Unit[]);
  const teams: BalancedTeam[] = solution.map((unitList) => {
    const roster = unitList
      .flatMap((u) => u.members)
      .sort((x, y) => y.overall - x.overall);
    const total = roster.reduce((s, p) => s + p.overall, 0);
    return {
      players: roster,
      total,
      average: roster.length
        ? Math.round((total / roster.length) * 10) / 10
        : 0,
    };
  });

  const averages = teams
    .filter((t) => t.players.length > 0)
    .map((t) => t.average);
  const spread = averages.length
    ? Math.round((Math.max(...averages) - Math.min(...averages)) * 10) / 10
    : 0;

  const teamOf = new Map<string, number>();
  teams.forEach((team, t) => team.players.forEach((p) => teamOf.set(p.id, t)));
  const unmet = apart.filter(({ a, b }) => {
    const ta = teamOf.get(a);
    const tb = teamOf.get(b);
    return ta !== undefined && ta === tb;
  });

  return { teams, spread, unmet };
}

function emptyTeam(): BalancedTeam {
  return { players: [], total: 0, average: 0 };
}
