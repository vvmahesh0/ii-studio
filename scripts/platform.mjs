export function platformStatus(platform = process.platform, arch = process.arch) {
  if (platform === "darwin" && ["arm64", "x64"].includes(arch)) return { allowed: true, experimental: arch === "x64", label: `macOS ${arch}` };
  if (platform === "win32" && arch === "x64") return { allowed: true, experimental: true, label: "Windows x64 (Windows 11 target)" };
  return { allowed: false, experimental: true, label: `${platform}/${arch}` };
}
