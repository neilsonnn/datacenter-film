export async function runFfmpeg(args: string[]): Promise<void> {
  const proc = Bun.spawn(["ffmpeg", ...args], { stdout: "pipe", stderr: "pipe" });
  const [exitCode, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
  if (exitCode !== 0) {
    throw new Error(`ffmpeg failed (exit ${exitCode}): ${stderr.slice(-2000)}`);
  }
}
