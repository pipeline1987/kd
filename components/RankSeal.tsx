import type { Rank } from "@/lib/types";

export function RankSeal({
  rank,
  size = "md",
}: {
  rank: Rank;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span className={`seal seal-${rank} seal-${size}`} aria-label={`${rank}-rank`}>
      {rank}
      <small>RANK</small>
    </span>
  );
}
