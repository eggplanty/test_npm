const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const os = require("os");
const crypto = require("crypto");

const PACKAGE = require("../package.json");
const VERSION = PACKAGE.version.replace(/-.*$/, "");
const NAME = "mycli";
const ALLOWED_HOSTS = [
  "github.com",
  "objects.githubusercontent.com",
];

function getRepo() {
  const repoUrl =
    typeof PACKAGE.repository === "string"
      ? PACKAGE.repository
      : PACKAGE.repository && PACKAGE.repository.url;
  if (!repoUrl) {
    throw new Error("repository.url is required in package.json");
  }

  const normalized = repoUrl
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")
    .replace(/^git@github\.com:/, "https://github.com/");
  const match = normalized.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)$/);
  if (!match) {
    throw new Error(`Unsupported repository URL: ${repoUrl}`);
  }

  return match[1];
}

const PLATFORM_MAP = {
  darwin: "darwin",
  linux: "linux",
  win32: "windows",
};

const ARCH_MAP = {
  x64: "amd64",
  arm64: "arm64",
};

const platform = PLATFORM_MAP[process.platform];
const arch = ARCH_MAP[process.arch];

const isWindows = process.platform === "win32";
const ext = isWindows ? ".zip" : ".tar.gz";
const archiveName = `${NAME}-${VERSION}-${platform}-${arch}${ext}`;
const url = `https://github.com/${getRepo()}/releases/download/v${VERSION}/${archiveName}`;
const binDir = path.join(__dirname, "..", "bin");
const dest = path.join(binDir, NAME + (isWindows ? ".exe" : ""));

function assertAllowedHost(downloadUrl) {
  const { hostname } = new URL(downloadUrl);
  if (!ALLOWED_HOSTS.includes(hostname)) {
    throw new Error(`Download host not allowed: ${hostname}`);
  }
}

function download(downloadUrl, destPath) {
  assertAllowedHost(downloadUrl);
  const args = [
    "--fail",
    "--location",
    "--silent",
    "--show-error",
    "--connect-timeout",
    "10",
    "--max-time",
    "120",
    "--max-redirs",
    "3",
    "--output",
    destPath,
  ];

  if (isWindows) {
    args.unshift("--ssl-revoke-best-effort");
  }

  args.push(downloadUrl);
  execFileSync("curl", args, { stdio: ["ignore", "ignore", "pipe"] });
}

function getExpectedChecksum(targetArchiveName, checksumsDir) {
  const dir = checksumsDir || path.join(__dirname, "..");
  const checksumsPath = path.join(dir, "checksums.txt");

  if (!fs.existsSync(checksumsPath)) {
    console.error(
      "[WARN] checksums.txt not found, skipping checksum verification"
    );
    return null;
  }

  const content = fs.readFileSync(checksumsPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf("  ");
    if (idx === -1) continue;
    const hash = trimmed.slice(0, idx);
    const name = trimmed.slice(idx + 2);
    if (name === targetArchiveName) return hash;
  }

  throw new Error(`Checksum entry not found for ${targetArchiveName}`);
}

function verifyChecksum(archivePath, expectedHash) {
  if (expectedHash === null) return;

  const content = fs.readFileSync(archivePath);
  const actual = crypto.createHash("sha256").update(content).digest("hex");

  if (actual.toLowerCase() !== expectedHash.toLowerCase()) {
    throw new Error(
      `[SECURITY] Checksum mismatch for ${path.basename(archivePath)}: expected ${expectedHash} but got ${actual}`
    );
  }
}

function install() {
  fs.mkdirSync(binDir, { recursive: true });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mycli-"));
  const archivePath = path.join(tmpDir, archiveName);

  try {
    download(url, archivePath);
    const expectedHash = getExpectedChecksum(archiveName);
    verifyChecksum(archivePath, expectedHash);

    if (isWindows) {
      execFileSync(
        "powershell",
        [
          "-Command",
          `Expand-Archive -Path '${archivePath}' -DestinationPath '${tmpDir}'`,
        ],
        { stdio: "ignore" }
      );
    } else {
      execFileSync("tar", ["-xzf", archivePath, "-C", tmpDir], {
        stdio: "ignore",
      });
    }

    const binaryName = NAME + (isWindows ? ".exe" : "");
    const extractedBinary = path.join(tmpDir, binaryName);

    fs.copyFileSync(extractedBinary, dest);
    fs.chmodSync(dest, 0o755);
    console.log(`${NAME} v${VERSION} installed successfully`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  if (!platform || !arch) {
    console.error(
      `Unsupported platform: ${process.platform}-${process.arch}`
    );
    process.exit(1);
  }

  const isNpxPostinstall =
    process.env.npm_command === "exec" && !process.env.MYCLI_RUN;

  if (isNpxPostinstall) {
    process.exit(0);
  }

  try {
    install();
  } catch (err) {
    console.error(`Failed to install ${NAME}:`, err.message);
    console.error(
      `\nIf you are behind a firewall or in a restricted network, try setting a proxy:\n` +
      `  export https_proxy=http://your-proxy:port\n` +
      `  npm install -g ${PACKAGE.name}`
    );
    process.exit(1);
  }
}

module.exports = { getExpectedChecksum, verifyChecksum, install };
