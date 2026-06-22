const { spawn, spawnSync } = require("node:child_process");

const host = "127.0.0.1";
const port = "4173";
const baseUrl = `http://${host}:${port}`;
const playwrightArgs = ["./node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)];

function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    async function poll() {
      try {
        const response = await fetch(url);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // Keep polling until Vite preview is ready or the timeout is reached.
      }

      if (Date.now() > deadline) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }

      setTimeout(poll, 250);
    }

    poll();
  });
}

async function run() {
  const preview = spawn(
    process.execPath,
    ["./node_modules/vite/bin/vite.js", "preview", "--host", host, "--port", port, "--strictPort"],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );

  preview.stdout.on("data", (chunk) => process.stdout.write(`[preview] ${chunk}`));
  preview.stderr.on("data", (chunk) => process.stderr.write(`[preview] ${chunk}`));

  try {
    await waitForServer(baseUrl);
    const result = spawnSync(process.execPath, playwrightArgs, {
      cwd: process.cwd(),
      env: { ...process.env, E2E_BASE_URL: baseUrl },
      stdio: "inherit",
      windowsHide: true,
    });

    process.exitCode = result.status ?? 1;
  } finally {
    preview.kill();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
