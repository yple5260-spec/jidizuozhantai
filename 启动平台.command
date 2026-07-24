#!/bin/bash
set -e

cd "$(dirname "$0")"

printf '\033]0;河北基地运营管理平台\007'
echo "========================================"
echo " 河北基地运营管理平台 · 班组长作战台"
echo "========================================"

pause_and_exit() {
  echo
  read -n 1 -s -r -p "按任意键退出..."
  echo
  exit "${1:-1}"
}

if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node.js，请先安装 Node.js 18 或更高版本："
  echo "https://nodejs.org/"
  pause_and_exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "当前 Node.js 版本过低：$(node --version)"
  echo "请安装 Node.js 18 或更高版本。"
  pause_and_exit 1
fi

PLATFORM=$(node -p "process.platform")
ARCH=$(node -p "process.arch")
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "运行平台: ${PLATFORM}-${ARCH}"

# node_modules 包含平台相关的 Rollup/esbuild 二进制，不能从 Linux 复制到 Mac 使用。
# 用标记文件记录上一次安装依赖的平台，平台变化时自动重装。
INSTALL_MARKER="node_modules/.installed-platform"
CURRENT_PLATFORM="${PLATFORM}-${ARCH}"
NEED_INSTALL=0

if [ ! -d "node_modules" ]; then
  NEED_INSTALL=1
elif [ ! -f "$INSTALL_MARKER" ]; then
  NEED_INSTALL=1
elif [ "$(cat "$INSTALL_MARKER" 2>/dev/null || true)" != "$CURRENT_PLATFORM" ]; then
  NEED_INSTALL=1
elif ! node -e "require('rollup')" >/dev/null 2>&1; then
  NEED_INSTALL=1
fi

if [ "$NEED_INSTALL" -eq 1 ]; then
  echo
  echo "检测到依赖缺失或平台不匹配，正在安装本机依赖..."
  echo "这一步只在首次运行或更换电脑后执行。"
  rm -rf node_modules package-lock.json
  npm install
  mkdir -p node_modules
  echo "$CURRENT_PLATFORM" > "$INSTALL_MARKER"
fi

# 最后做一次依赖自检；针对 npm optionalDependencies 偶发缺失给出自动修复。
if ! node -e "require('rollup')" >/dev/null 2>&1; then
  echo "Rollup平台依赖仍未正确安装，正在进行二次修复..."
  if [ "$PLATFORM" = "darwin" ] && [ "$ARCH" = "arm64" ]; then
    npm install --save-dev @rollup/rollup-darwin-arm64
  elif [ "$PLATFORM" = "darwin" ] && [ "$ARCH" = "x64" ]; then
    npm install --save-dev @rollup/rollup-darwin-x64
  else
    npm install
  fi
fi

echo
echo "正在检查并启动本地业务API：http://localhost:4174"

EXPECTED_API_VERSION="2026.07.24-deepseek-ai-v1"
RUNNING_API_VERSION=$(curl -fsS "http://127.0.0.1:4174/api/health" 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{console.log(JSON.parse(s).version||'')}catch{console.log('')}})" 2>/dev/null || true)

if [ "$RUNNING_API_VERSION" = "$EXPECTED_API_VERSION" ]; then
  echo "检测到同版本业务API已运行，将复用现有服务（$EXPECTED_API_VERSION）。"
  API_PID=""
else
  if [ -n "$RUNNING_API_VERSION" ]; then
    echo "检测到旧版业务API：$RUNNING_API_VERSION，正在升级到 $EXPECTED_API_VERSION..."
  fi
  if command -v lsof >/dev/null 2>&1; then
    OLD_API_PID=$(lsof -ti tcp:4174 2>/dev/null || true)
    if [ -n "$OLD_API_PID" ]; then
      echo "发现4174端口残留进程，正在清理..."
      kill $OLD_API_PID 2>/dev/null || true
      sleep 1
    fi
  fi
  # 直接启动 Node 服务，使 API_PID 指向真实服务进程。
  # 这样窗口退出或启动失败时可以完整清理，不留下占用4174端口的子进程。
  node server/server.js > "${TMPDIR:-/tmp}/hebei-operations-api.log" 2>&1 &
  API_PID=$!
fi

cleanup() {
  if [ -n "$API_PID" ]; then
    kill "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

sleep 1
if [ "$(curl -fsS "http://127.0.0.1:4174/api/health" 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{console.log(JSON.parse(s).version||'')}catch{console.log('')}})" 2>/dev/null || true)" != "$EXPECTED_API_VERSION" ]; then
  echo "业务API启动失败，日志如下："
  cat "${TMPDIR:-/tmp}/hebei-operations-api.log" 2>/dev/null || true
  echo "请确认4174端口未被其他程序占用，然后重新双击启动脚本。"
  pause_and_exit 1
fi

echo "业务API已启动，状态与任务将保存到 server/data/state.json"
echo "正在启动前端：http://localhost:4173"
echo "服务运行期间请保持本窗口打开；关闭窗口会同时停止前端与API。"
(sleep 2 && open "http://localhost:4173") &

npm run dev -- --port 4173
