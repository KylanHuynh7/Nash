import { balanceTeams, type BalancePlayer } from "../lib/balance";

const names = ["Kylan","Marcus","Dre","Tyler","Jalen","Chris","Andre","Mike","Sam","Nate","Josh","Rob"];
const positions = ["guard","wing","big"];
const players: BalancePlayer[] = names.map((name, i) => ({
  id: `p${i}`,
  name,
  overall: [92,88,84,81,79,77,74,71,68,65,61,55][i],
  position: positions[i % 3],
}));

function report(label: string, players: BalancePlayer[], opts: Parameters<typeof balanceTeams>[1]) {
  const r = balanceTeams(players, opts);
  console.log(`\n=== ${label} (spread ${r.spread}, unmet ${r.unmet.length}) ===`);
  r.teams.forEach((t, i) => {
    const pos = t.players.map(p => p.position[0].toUpperCase()).sort().join("");
    console.log(`  T${i+1} avg ${t.average} n=${t.players.length} [${pos}] :: ${t.players.map(p => `${p.name}(${p.overall})`).join(", ")}`);
  });
  return r;
}

report("12 players, 2 teams", players, { teamCount: 2, seed: 1 });
report("12 players, 3 teams", players, { teamCount: 3, seed: 1 });
report("11 players, 2 teams (odd)", players.slice(0,11), { teamCount: 2, seed: 7 });
report("together: Kylan+Rob (best+worst)", players, { teamCount: 2, seed: 3, together: [{a:"p0",b:"p11"}] });
report("apart: Kylan|Marcus (top two)", players, { teamCount: 2, seed: 3, apart: [{a:"p0",b:"p1"}] });

console.log("\n=== reshuffle variety (seeds 1-5, 2 teams) ===");
const seen = new Set<string>();
for (let s = 1; s <= 5; s++) {
  const r = balanceTeams(players, { teamCount: 2, seed: s });
  const key = r.teams[0].players.map(p=>p.id).sort().join(",");
  seen.add(key);
  console.log(`  seed ${s}: spread ${r.spread} | ${r.teams[0].players.map(p=>p.name).join(",")}`);
}
console.log(`  distinct splits: ${seen.size}/5`);

console.time("perf 12p");
for (let i=0;i<20;i++) balanceTeams(players, { teamCount: 2, seed: i });
console.timeEnd("perf 12p");
