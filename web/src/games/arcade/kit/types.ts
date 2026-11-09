/** Games own simulation and report once, including on endRequested (reason/death 'quit').
 * The host owns pause, sound, score chrome and run persistence; seeds never come from the game.
 * Pausing must stop simulation time, not merely hide the canvas. */
export interface ArcadeRunResult<S> {
  score: number;
  stats: S;
  title: string;
  detail: string;
}
export interface ArcadePlayProps<S> {
  seed: number;
  paused: boolean;
  sound: boolean;
  reducedMotion: boolean;
  setScore(n: number): void;
  onGameOver(result: ArcadeRunResult<S>): void;
  endRequested: boolean;
}
