const fs = require("fs");
const os = require("os");
const path = require("path");
const net = require("net");
const { spawn } = require("child_process");

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "pipe",
      ...options
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} failed with code ${code}\n${stderr || stdout}`
        )
      );
    });
  });
}

function commandExists(command) {
  const paths = (process.env.PATH || "").split(path.delimiter);

  return paths.some((candidatePath) => {
    const candidate = path.join(candidatePath, command);
    return fs.existsSync(candidate);
  });
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });

    server.on("error", reject);
  });
}

async function startTemporaryPostgres() {
  if (
    !commandExists("initdb") ||
    !commandExists("pg_ctl")
  ) {
    return null;
  }

  const rootDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "point-focal-pg-")
  );

  const dataDir = path.join(rootDir, "data");
  const socketDir = path.join(rootDir, "socket");
  const port = await findFreePort();

  await fs.promises.mkdir(dataDir, {
    recursive: true
  });
  await fs.promises.mkdir(socketDir, {
    recursive: true
  });

  await runCommand(
    "initdb",
    [
      "-A",
      "trust",
      "-U",
      "postgres",
      "--encoding=UTF8",
      "--no-locale",
      dataDir
    ]
  );

  await runCommand("pg_ctl", [
    "-D",
    dataDir,
    "-o",
    `-F -p ${port} -k ${socketDir}`,
    "-w",
    "start"
  ]);

  const connectionString =
    `postgresql://postgres@127.0.0.1:${port}/postgres`;

  return {
    connectionString,
    async stop() {
      await runCommand("pg_ctl", [
        "-D",
        dataDir,
        "-m",
        "immediate",
        "-w",
        "stop"
      ]).catch(() => undefined);

      await fs.promises.rm(rootDir, {
        recursive: true,
        force: true
      });
    }
  };
}

module.exports = {
  startTemporaryPostgres
};
