import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const remote = process.env.CLOUD_REMOTE ?? "root@45.205.27.116";
const remoteDir = process.env.CLOUD_REMOTE_DIR ?? "/opt/ai-motion";
const healthUrl = process.env.CLOUD_HEALTH_URL ?? "http://45.205.27.116:4173/";
const port = Number(process.env.CLOUD_PORT ?? "4173");
const motionLensHealthUrl = process.env.CLOUD_MOTION_LENS_HEALTH_URL ?? "http://45.205.27.116:5176/";
const motionLensPort = Number(process.env.CLOUD_MOTION_LENS_PORT ?? "5176");

function run(command, args, options = {}) {
  const printable = [command, ...args].join(" ");
  console.log(`\n> ${printable}`);
  execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    stdio: "inherit"
  });
}

function sh(command) {
  run("sh", ["-c", command]);
}

function ssh(command) {
  run("ssh", [remote, command]);
}

function requireFile(path) {
  const absolutePath = resolve(repoRoot, path);
  if (!existsSync(absolutePath)) {
    console.error(`Missing required file: ${path}`);
    process.exit(1);
  }
}

function remoteSingleQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function backupRemote() {
  const quotedRemoteDir = remoteSingleQuote(remoteDir);
  ssh(`
set -e
if [ -d ${quotedRemoteDir} ]; then
  parent=$(dirname ${quotedRemoteDir})
  name=$(basename ${quotedRemoteDir})
  backup="$parent/$name.backup.$(date +%Y%m%d%H%M%S)"
  cp -a ${quotedRemoteDir} "$backup"
  echo "backup=$backup"
fi
`);
}

function syncFiles() {
  const args = [
    "-az",
    "--delete",
    "--exclude-from=.gitignore",
    "--exclude=.git/",
    "--exclude=.DS_Store",
    "./",
    `${remote}:${remoteDir}/`
  ];
  run("rsync", args);
}

function installBuildAndRestart() {
  const quotedRemoteDir = remoteSingleQuote(remoteDir);
  const logPath = `${remoteDir}/apps-web.log`;
  const motionLensLogPath = `${remoteDir}/apps-motion-lens.log`;
  ssh(`
set -e
cd ${quotedRemoteDir}
pnpm install --frozen-lockfile
pnpm --filter web build
pnpm --filter @motion-lens/app build

for pid_dir in /proc/[0-9]*; do
  [ -d "$pid_dir" ] || continue
  pid=$(basename "$pid_dir")
  cwd=$(readlink "$pid_dir/cwd" 2>/dev/null || true)
  cmd=$(tr '\\0' ' ' < "$pid_dir/cmdline" 2>/dev/null || true)
  if [ "$cwd" = "${remoteDir}/apps/web" ] && echo "$cmd" | grep -q 'dist-server/startProductionServer.js'; then
    kill "$pid" 2>/dev/null || true
  fi
  if [ "$cwd" = "${remoteDir}/apps/motion-lens" ] && echo "$cmd" | grep -Eq 'dist-server/startProductionServer.js|serve.mjs'; then
    kill "$pid" 2>/dev/null || true
  fi
done

for target_port in ${port} ${motionLensPort}; do
  for attempt in 1 2 3 4 5; do
    listeners=$(
      if command -v ss >/dev/null 2>&1; then
        ss -ltnp "sport = :$target_port" 2>/dev/null || true
      else
        netstat -ltnp 2>/dev/null | grep ":$target_port " || true
      fi
    )
    [ -z "$listeners" ] && break
    echo "waiting for port $target_port to release (attempt $attempt)"
    sleep 1
  done

  listeners=$(
    if command -v ss >/dev/null 2>&1; then
      ss -ltnp "sport = :$target_port" 2>/dev/null || true
    else
      netstat -ltnp 2>/dev/null | grep ":$target_port " || true
    fi
  )
  if [ -n "$listeners" ]; then
    echo "$listeners" | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u | xargs -r kill -9
    sleep 1
  fi
done

: > ${remoteSingleQuote(logPath)}
: > ${remoteSingleQuote(motionLensLogPath)}
cd ${quotedRemoteDir}/apps/web
nohup node dist-server/startProductionServer.js > ${remoteSingleQuote(logPath)} 2>&1 &
echo "pid=$!"
cd ${quotedRemoteDir}/apps/motion-lens
PORT=${motionLensPort} nohup node dist-server/startProductionServer.js > ${remoteSingleQuote(motionLensLogPath)} 2>&1 &
echo "motion_lens_pid=$!"
sleep 1

if command -v ss >/dev/null 2>&1; then
  ss -ltnp | grep ':${port} '
  ss -ltnp | grep ':${motionLensPort} '
else
  netstat -ltnp | grep ':${port} '
  netstat -ltnp | grep ':${motionLensPort} '
fi
tail -n 40 ${remoteSingleQuote(logPath)}
tail -n 40 ${remoteSingleQuote(motionLensLogPath)}
`);
}

function verifyHealth() {
  run("curl", ["-I", "--fail", "--max-time", "10", healthUrl]);
  run("curl", ["-I", "--fail", "--max-time", "10", motionLensHealthUrl]);
}

requireFile(".gitignore");
requireFile("package.json");
requireFile("pnpm-lock.yaml");

console.log(`Deploying ai-motion to ${remote}:${remoteDir}`);
console.log(`Health check: ${healthUrl}`);

sh("pnpm --filter @motion-tool/core test -- motionSkillRecipeAdapter.test.ts");
sh("pnpm --filter web build");
backupRemote();
syncFiles();
installBuildAndRestart();
verifyHealth();

console.log("\nDeploy finished.");
