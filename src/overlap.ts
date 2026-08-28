import type { Overlap, RiskLevel } from "./types.js";

function directoryOf(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

export function computeOverlaps(touchedByAgent: Map<string, string[]>): Overlap[] {
  const names = [...touchedByAgent.keys()];
  const overlaps: Overlap[] = [];

  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const agentA = names[i];
      const agentB = names[j];
      const filesA = new Set(touchedByAgent.get(agentA) ?? []);
      const filesB = new Set(touchedByAgent.get(agentB) ?? []);

      const sharedFiles = [...filesA].filter((file) => filesB.has(file)).sort();

      const dirsA = new Set([...filesA].map(directoryOf));
      const dirsB = new Set([...filesB].map(directoryOf));
      const sharedDirectories = [...dirsA].filter((dir) => dir !== "" && dirsB.has(dir)).sort();

      let risk: RiskLevel = "none";
      if (sharedFiles.length > 0) risk = "high";
      else if (sharedDirectories.length > 0) risk = "medium";

      if (risk !== "none") {
        overlaps.push({ agentA, agentB, sharedFiles, sharedDirectories, risk });
      }
    }
  }

  return overlaps;
}
