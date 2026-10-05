export function installShutdown(close: () => Promise<void>): void {
  let stopping = false;

  const stop = (signal: string) => {
    if (stopping) {
      return;
    }
    stopping = true;
    console.log(JSON.stringify({ signal, outcome: "shutdown" }));
    const timer = setTimeout(() => {
      process.exit(1);
    }, 15_000);
    timer.unref();
    close()
      .catch(() => undefined)
      .finally(() => {
        process.exit(0);
      });
  };

  process.once("SIGTERM", () => stop("SIGTERM"));
  process.once("SIGINT", () => stop("SIGINT"));
}
