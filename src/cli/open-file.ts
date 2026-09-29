import { spawn } from "node:child_process";

function openCommand(target: string): [string, string[]] {
  if (process.platform === "darwin") return ["open", [target]];
  if (process.platform === "win32") return ["cmd", ["/c", "start", "", target]];
  return ["xdg-open", [target]];
}

/** Opens a file in the default app. Returns false if the OS has no opener, so the caller can print the path instead. */
export async function openFile(target: string): Promise<boolean> {
  const [command, args] = openCommand(target);
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, { stdio: "ignore", detached: true });
    child.once("error", () => resolvePromise(false));
    child.once("spawn", () => {
      child.unref();
      resolvePromise(true);
    });
  });
}
