#include <chrono>
#include <filesystem>
#include <iostream>
#include <optional>
#include <random>
#include <sstream>
#include <string>
#include <vector>

#ifdef _WIN32
  #define NOMINMAX
  #include <windows.h>
#endif

namespace fs = std::filesystem;

static std::string trim(const std::string& s) {
  size_t start = 0;
  while (start < s.size() && std::isspace(static_cast<unsigned char>(s[start]))) start++;
  size_t end = s.size();
  while (end > start && std::isspace(static_cast<unsigned char>(s[end - 1]))) end--;
  return s.substr(start, end - start);
}

static bool looksLikeTime(const std::string& t) {
  if (t.empty()) return false;
  for (char c : t) {
    if (!(std::isdigit(static_cast<unsigned char>(c)) || c == ':' || c == '.')) return false;
  }
  return true;
}

static std::optional<double> parseTimeSeconds(const std::string& raw) {
  const std::string s = trim(raw);
  if (s.empty()) return std::nullopt;

  // Pure seconds: 83 or 83.5
  {
    bool ok = true;
    for (char c : s) {
      if (!(std::isdigit(static_cast<unsigned char>(c)) || c == '.')) {
        ok = false;
        break;
      }
    }
    if (ok) {
      try {
        const double v = std::stod(s);
        if (v >= 0.0) return v;
      } catch (...) {
      }
      return std::nullopt;
    }
  }

  // HH:MM:SS(.ms) or MM:SS(.ms)
  std::vector<std::string> parts;
  {
    std::stringstream ss(s);
    std::string part;
    while (std::getline(ss, part, ':')) parts.push_back(part);
  }

  if (parts.size() < 2 || parts.size() > 3) return std::nullopt;

  auto parseNum = [](const std::string& p) -> std::optional<double> {
    const std::string ps = trim(p);
    if (ps.empty()) return std::nullopt;
    for (char c : ps) {
      if (!(std::isdigit(static_cast<unsigned char>(c)) || c == '.')) return std::nullopt;
    }
    try {
      const double v = std::stod(ps);
      if (v < 0.0) return std::nullopt;
      return v;
    } catch (...) {
      return std::nullopt;
    }
  };

  std::vector<double> nums;
  for (const auto& p : parts) {
    auto v = parseNum(p);
    if (!v) return std::nullopt;
    nums.push_back(*v);
  }

  double seconds = 0.0;
  if (nums.size() == 2) {
    seconds = nums[0] * 60.0 + nums[1];
  } else {
    seconds = nums[0] * 3600.0 + nums[1] * 60.0 + nums[2];
  }
  return seconds;
}

static std::string toFfmpegTime(double seconds) {
  // Use seconds with millisecond precision; ffmpeg accepts fractional seconds.
  std::ostringstream os;
  os.setf(std::ios::fixed);
  os.precision(3);
  os << seconds;
  std::string out = os.str();
  // strip trailing .000
  if (out.size() >= 4 && out.substr(out.size() - 4) == ".000") out.resize(out.size() - 4);
  return out;
}

static std::string quoteArgWindows(const std::string& arg) {
  // Minimal Windows quoting: wrap in quotes if it has spaces/quotes.
  // Also escape embedded quotes by backslash.
  bool needs = false;
  for (char c : arg) {
    if (std::isspace(static_cast<unsigned char>(c)) || c == '"') { needs = true; break; }
  }
  if (!needs) return arg;
  std::string out = "\"";
  for (char c : arg) {
    if (c == '"') out += "\\\"";
    else out += c;
  }
  out += "\"";
  return out;
}

#ifdef _WIN32
static fs::path getExecutablePath() {
  std::wstring buf;
  buf.resize(32768);
  DWORD len = GetModuleFileNameW(nullptr, buf.data(), static_cast<DWORD>(buf.size()));
  if (len == 0 || len >= buf.size()) return fs::path();
  buf.resize(len);
  return fs::path(buf);
}

static std::optional<fs::path> findBundledTool(const std::string& exeName) {
  fs::path self = getExecutablePath();
  if (self.empty()) return std::nullopt;
  fs::path dir = self.parent_path();
  fs::path candidate = dir / exeName;
  if (fs::exists(candidate)) return candidate;
  return std::nullopt;
}

static std::wstring widen(const std::string& s) {
  if (s.empty()) return std::wstring();
  int len = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, nullptr, 0);
  if (len <= 0) return std::wstring();
  std::wstring w(static_cast<size_t>(len - 1), L'\0');
  MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, &w[0], len);
  return w;
}

static int runProcessWindows(const std::string& exe, const std::vector<std::string>& args) {
  std::string cmd = quoteArgWindows(exe);
  for (const auto& a : args) {
    cmd += " ";
    cmd += quoteArgWindows(a);
  }

  STARTUPINFOW si;
  PROCESS_INFORMATION pi;
  ZeroMemory(&si, sizeof(si));
  ZeroMemory(&pi, sizeof(pi));
  si.cb = sizeof(si);

  std::wstring wcmd = widen(cmd);
  if (wcmd.empty()) return 1;

  // CreateProcess requires a writable buffer.
  std::vector<wchar_t> buffer(wcmd.begin(), wcmd.end());
  buffer.push_back(L'\0');

  BOOL ok = CreateProcessW(
    nullptr,
    buffer.data(),
    nullptr,
    nullptr,
    TRUE,
    0,
    nullptr,
    nullptr,
    &si,
    &pi
  );

  if (!ok) {
    DWORD err = GetLastError();
    std::cerr << "Failed to start process: " << exe << " (error " << err << ")\n";
    return 1;
  }

  WaitForSingleObject(pi.hProcess, INFINITE);

  DWORD exitCode = 1;
  GetExitCodeProcess(pi.hProcess, &exitCode);
  CloseHandle(pi.hThread);
  CloseHandle(pi.hProcess);

  return static_cast<int>(exitCode);
}
#endif

static std::string randomToken() {
  std::random_device rd;
  std::mt19937_64 gen(rd());
  std::uniform_int_distribution<unsigned long long> dist;
  unsigned long long v = dist(gen);
  std::ostringstream os;
  os << std::hex << v;
  return os.str();
}

static void printUsage() {
  std::cout
    << "ytcut - Download a YouTube video and trim a segment\n\n"
    << "No-install bundle: place yt-dlp.exe and ffmpeg.exe next to ytcut.exe.\n"
    << "(If not present, it will fall back to PATH.)\n\n"
    << "Usage:\n"
    << "  ytcut --url <youtube_url> --start <time> --end <time> [--out <output.mp4>]\n\n"
    << "Time formats:\n"
    << "  - seconds: 83 or 83.5\n"
    << "  - HH:MM:SS(.ms) or MM:SS(.ms): 00:01:23 or 01:23\n";
}

static std::optional<std::string> getArgValue(const std::vector<std::string>& argv, const std::string& key) {
  for (size_t i = 0; i + 1 < argv.size(); i++) {
    if (argv[i] == key) return argv[i + 1];
  }
  return std::nullopt;
}

int main(int argc, char** argvRaw) {
  std::vector<std::string> argv;
  argv.reserve(static_cast<size_t>(argc));
  for (int i = 0; i < argc; i++) argv.push_back(argvRaw[i] ? argvRaw[i] : "");

  if (argc <= 1) {
    printUsage();
    std::cout << "\nInteractive mode:\n";
    std::string url, startStr, endStr, out;

    std::cout << "YouTube URL: ";
    std::getline(std::cin, url);
    url = trim(url);

    std::cout << "Start (optional; leave blank for full download): ";
    std::getline(std::cin, startStr);
    startStr = trim(startStr);

    std::cout << "End (optional; leave blank for full download): ";
    std::getline(std::cin, endStr);
    endStr = trim(endStr);

    std::cout << "Output file (optional; default: out.mp4 next to ytcut.exe): ";
    std::getline(std::cin, out);
    out = trim(out);

    argv = { argv[0], "--url", url };
    if (!startStr.empty() || !endStr.empty()) {
      argv.push_back("--start");
      argv.push_back(startStr);
      argv.push_back("--end");
      argv.push_back(endStr);
    }
    if (!out.empty()) {
      argv.push_back("--out");
      argv.push_back(out);
    }
  }

  if (std::find(argv.begin(), argv.end(), "--help") != argv.end() ||
      std::find(argv.begin(), argv.end(), "-h") != argv.end()) {
    printUsage();
    return 0;
  }

  const auto url = getArgValue(argv, "--url");
  const auto startStr = getArgValue(argv, "--start");
  const auto endStr = getArgValue(argv, "--end");
  const auto outStr = getArgValue(argv, "--out");

  if (!url) {
    printUsage();
    std::cerr << "\nMissing required arg: --url\n";
    return 2;
  }

  const bool hasStart = static_cast<bool>(startStr) && !trim(*startStr).empty();
  const bool hasEnd = static_cast<bool>(endStr) && !trim(*endStr).empty();
  const bool doTrim = hasStart && hasEnd;
  if ((hasStart && !hasEnd) || (!hasStart && hasEnd)) {
    std::cerr << "If trimming, provide both --start and --end (or omit both for full download).\n";
    return 2;
  }

  std::optional<double> startSec;
  std::optional<double> endSec;
  if (doTrim) {
    if (!looksLikeTime(*startStr) || !looksLikeTime(*endStr)) {
      std::cerr << "Start/end must look like a time (digits, ':' and '.').\n";
      return 2;
    }
    startSec = parseTimeSeconds(*startStr);
    endSec = parseTimeSeconds(*endStr);
    if (!startSec || !endSec) {
      std::cerr << "Failed to parse start/end time.\n";
      return 2;
    }
    if (*endSec <= *startSec) {
      std::cerr << "End must be after start.\n";
      return 2;
    }
  }

  fs::path exeDir;
#ifdef _WIN32
  {
    fs::path self = getExecutablePath();
    exeDir = self.empty() ? fs::current_path() : self.parent_path();
  }
#else
  exeDir = fs::current_path();
#endif

  std::string outArg = outStr ? trim(*outStr) : std::string();
  fs::path outPath = outArg.empty() ? fs::path("out.mp4") : fs::path(outArg);
  if (!outPath.is_absolute()) {
    outPath = exeDir / outPath;
  }
  if (!outPath.has_extension()) {
    outPath.replace_extension(".mp4");
  }

  fs::path tmp = fs::temp_directory_path();
  const auto token = randomToken();
  const fs::path downloadBase = tmp / ("ytcut_" + token);

  const std::string ytdlpExe = []() {
#ifdef _WIN32
    auto bundled = findBundledTool("yt-dlp.exe");
    if (bundled) return bundled->string();
#endif
    return std::string("yt-dlp");
  }();

  const std::string ffmpegExe = []() {
#ifdef _WIN32
    auto bundled = findBundledTool("ffmpeg.exe");
    if (bundled) return bundled->string();
#endif
    return std::string("ffmpeg");
  }();

  // Download with yt-dlp, merge to mp4.
  std::cout << "Downloading with yt-dlp...\n";

  const std::string downloadTemplate = [&]() {
    if (!doTrim) {
      fs::path base = outPath;
      base.replace_extension("");
      return base.string() + ".%(ext)s";
    }
    return downloadBase.string() + ".%(ext)s";
  }();

  std::vector<std::string> ytdlpArgs = {
    "--no-playlist",
    "--force-overwrites",
    "-f", "bv*+ba/b",
    "--merge-output-format", "mp4",
    "-o", downloadTemplate,
    *url
  };

#ifdef _WIN32
  int ytdlpCode = runProcessWindows(ytdlpExe, ytdlpArgs);
#else
  int ytdlpCode = 1;
  std::cerr << "This build only supports Windows right now.\n";
#endif

  if (ytdlpCode != 0) {
    std::cerr << "yt-dlp failed (exit code " << ytdlpCode << ").\n";
    std::cerr << "Make sure yt-dlp is installed and on PATH.\n";
    return ytdlpCode;
  }

  if (!doTrim) {
    if (!fs::exists(outPath)) {
      std::cerr << "Download finished but output file was not found: " << outPath.string() << "\n";
      return 3;
    }
    std::cout << "Done: " << outPath.string() << "\n";
    return 0;
  }

  fs::path inputMp4 = downloadBase;
  inputMp4 += ".mp4";
  if (!fs::exists(inputMp4)) {
    std::cerr << "Expected downloaded file not found: " << inputMp4.string() << "\n";
    return 3;
  }

  std::cout << "Trimming with ffmpeg...\n";

  // Fast trim via stream copy. For frame-accurate trimming, re-encoding is required.
  // We prefer minimal dependencies + speed.
  std::vector<std::string> ffmpegArgs = {
    "-hide_banner",
    "-loglevel", "error",
    "-y",
    "-ss", toFfmpegTime(*startSec),
    "-to", toFfmpegTime(*endSec),
    "-i", inputMp4.string(),
    "-c", "copy",
    "-avoid_negative_ts", "make_zero",
    outPath.string()
  };

#ifdef _WIN32
  int ffmpegCode = runProcessWindows(ffmpegExe, ffmpegArgs);
#else
  int ffmpegCode = 1;
#endif

  // Cleanup temp mp4
  try { fs::remove(inputMp4); } catch (...) {}

  if (ffmpegCode != 0) {
    std::cerr << "ffmpeg failed (exit code " << ffmpegCode << ").\n";
    std::cerr << "Make sure ffmpeg is installed and on PATH.\n";
    return ffmpegCode;
  }

  std::cout << "Done: " << outPath.string() << "\n";
  return 0;
}
