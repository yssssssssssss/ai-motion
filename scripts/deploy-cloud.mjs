import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const remote = process.env.CLOUD_REMOTE ?? "root@45.205.27.116";
const remoteDir = process.env.CLOUD_REMOTE_DIR ?? "/opt/ai-motion-web";
const healthUrl = process.env.CLOUD_HEALTH_URL ?? "http://45.205.27.116:4173/";
const port = Number(process.env.CLOUD_PORT ?? "4173");

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
  ssh(`
set -e
cd ${quotedRemoteDir}
pnpm install --frozen-lockfile
pnpm --filter @motion-tool/web build

for pid_dir in /proc/[0-9]*; do
  [ -d "$pid_dir" ] || continue
  pid=$(basename "$pid_dir")
  cwd=$(readlink "$pid_dir/cwd" 2>/dev/null || true)
  cmd=$(tr '\\0' ' ' < "$pid_dir/cmdline" 2>/dev/null || true)
  if [ "$cwd" = "${remoteDir}/apps/web" ] && echo "$cmd" | grep -q 'dist-server/startProductionServer.js'; then
    kill "$pid" 2>/dev/null || true
  fi
done

if ! command -v ss >/dev/null 2>&1 && ! command -v netstat >/dev/null 2>&1; then
  echo "Cannot inspect listening ports: neither ss nor netstat is available" >&2
  exit 1
fi

for target_port in ${port}; do
  for attempt in 1 2 3 4 5; do
    listeners=$(
      if command -v ss >/dev/null 2>&1; then
        ss -H -ltnp "sport = :$target_port"
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
      ss -H -ltnp "sport = :$target_port"
    else
      netstat -ltnp 2>/dev/null | grep ":$target_port " || true
    fi
  )
  if [ -n "$listeners" ]; then
    echo "$listeners" | while IFS= read -r listener; do
      if command -v ss >/dev/null 2>&1; then
        pids=$(echo "$listener" | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u)
      else
        pids=$(echo "$listener" | awk '{ split($7, process, "/"); if (process[1] ~ /^[0-9]+$/) print process[1] }' | sort -u)
      fi
      if [ -z "$pids" ]; then
        echo "Cannot identify listener pid on port $target_port; refusing to restart" >&2
        exit 1
      fi
      for pid in $pids; do
        cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null || true)
        if [ "$cwd" = "${remoteDir}/apps/web" ]; then
          kill -9 "$pid"
        else
          echo "Refusing to kill listener pid=$pid cwd=$cwd port=$target_port" >&2
          exit 1
        fi
      done
    done
    sleep 1
  fi
done

: > ${remoteSingleQuote(logPath)}
cd ${quotedRemoteDir}/apps/web
PORT=${port} nohup node dist-server/startProductionServer.js > ${remoteSingleQuote(logPath)} 2>&1 &
echo "pid=$!"
sleep 1

if command -v ss >/dev/null 2>&1; then
  ss -ltnp | grep ':${port} '
else
  netstat -ltnp | grep ':${port} '
fi
tail -n 40 ${remoteSingleQuote(logPath)}
`);
}

function verifyHealth() {
  run("curl", ["-I", "--fail", "--max-time", "10", healthUrl]);
}

requireFile(".gitignore");
requireFile("package.json");
requireFile("pnpm-lock.yaml");

console.log(`Deploying ai-motion-web to ${remote}:${remoteDir}`);
console.log(`Health check: ${healthUrl}`);

sh("pnpm --filter @motion-tool/core test -- motionSkillRecipeAdapter.test.ts");
sh("pnpm --filter @motion-tool/web build");
backupRemote();
syncFiles();
installBuildAndRestart();
verifyHealth();

console.log("\nDeploy finished.");
