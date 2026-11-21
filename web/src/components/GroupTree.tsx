import type { ActivityLog, Group } from "../lib/types";
import { groupAgeDays, TREE_EMOJI, treeFruit, treeStage } from "../lib/scoring";

export function GroupTree({ group, logs, size = 96 }: { group: Group; logs: ActivityLog[]; size?: number }) {
  const age = groupAgeDays(group);
  const stage = treeStage(age);
  const fruit = treeFruit(group, logs);
  return (
    <div className="tree" style={{ fontSize: size }} title={`${stage}, ${age} days old`}>
      <span className="tree-emoji">{TREE_EMOJI[stage]}</span>
      {fruit.length > 0 && (
        <div className="tree-fruit" style={{ fontSize: size / 5 }}>
          {fruit.map((f, i) => (
            <span key={i}>{f}</span>
          ))}
        </div>
      )}
    </div>
  );
}
