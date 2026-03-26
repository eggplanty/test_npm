const fs = require("fs");
const path = require("path");
const https = require("https");

const VERSION = require("../package.json").version;
const REPO = "eggplanty/test_npm";
const NAME = "mycli";

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

if (!platform || !arch) {
  console.error(
    `Unsupported platform: ${process.platform}-${process.arch}`
  );
  process.exit(1);
}

const ext = process.platform === "win32" ? ".exe" : "";
const binaryName = `${NAME}-${platform}-${arch}${ext}`;
const url = `https://github.com/${REPO}/releases/download/v${VERSION}/${binaryName}`;
const dest = path.join(__dirname, "..", "bin", NAME + ext);

fs.mkdirSync(path.dirname(dest), { recursive: true });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : require("http");
    client
      .get(url, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          return download(res.headers.location, dest).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          return reject(
            new Error(`Download failed with status ${res.statusCode}: ${url}`)
          );
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", reject);
  });
}

download(url, dest)
  .then(() => {
    fs.chmodSync(dest, 0o755);
    console.log(`${NAME} v${VERSION} installed successfully`);
  })
  .catch((err) => {
    console.error(`Failed to install ${NAME}:`, err.message);
    process.exit(1);
  });
