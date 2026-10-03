// Nunya landing page.
//
// The page works with this script off: every download link falls back to the Releases page and every
// command shows a <version> placeholder. With it on, the newest release (betas included — they are
// GitHub pre-releases, which /releases/latest would skip) fills in the real files and names, and the
// visitor's own system is put first.

const REPO = "nunyavpn/nunya";
const RELEASES = `https://github.com/${REPO}/releases`;
const CACHE_KEY = "nunya-release-v1";
const CACHE_MS = 30 * 60 * 1000; // unauthenticated GitHub API allows 60 requests an hour per address

// Release asset name patterns, as .github/workflows/release.yml in the app repo produces them.
const ASSETS = {
  "mac-dmg": /_aarch64\.dmg$/,
  "win-exe": /_x64-setup\.exe$/,
  "deb-amd64": /_amd64\.deb$/,
  "deb-arm64": /_arm64\.deb$/,
  "rpm-x86_64": /\.x86_64\.rpm$/,
  "rpm-aarch64": /\.aarch64\.rpm$/,
  arch: /-x86_64\.pkg\.tar\.zst$/,
  sums: /^SHA256SUMS$/,
};

const OS_LABEL = { mac: "macOS", win: "Windows", linux: "Linux" };

// ------------------------------------------------------------------ release

async function latestRelease() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.release;
  } catch {}

  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const list = await res.json();
  const rel = list.find((r) => !r.draft);
  if (!rel) throw new Error("no published release");

  const release = {
    tag: rel.tag_name,
    version: rel.tag_name.replace(/^v/, ""),
    prerelease: rel.prerelease,
    url: rel.html_url,
    date: rel.published_at,
    assets: rel.assets.map((a) => ({ name: a.name, url: a.browser_download_url, size: a.size })),
  };
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), release }));
  } catch {}
  return release;
}

function pickAssets(release) {
  const found = {};
  for (const [key, re] of Object.entries(ASSETS)) {
    const asset = release.assets.find((a) => re.test(a.name));
    if (asset) found[key] = asset;
  }
  return found;
}

function formatSize(bytes) {
  return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(0)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

function applyRelease(release) {
  const found = pickAssets(release);

  document.querySelectorAll("[data-asset]").forEach((el) => {
    const asset = found[el.dataset.asset];
    if (!asset) return;
    el.href = asset.url;
    if (el.classList.contains("btn") && el.dataset.asset !== "sums") {
      el.title = `${asset.name} · ${formatSize(asset.size)}`;
    }
  });

  document.querySelectorAll("[data-name]").forEach((el) => {
    const asset = found[el.dataset.name];
    if (asset) el.textContent = asset.name;
  });

  const date = new Date(release.date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const kind = release.prerelease ? "beta" : "stable";

  document.querySelectorAll("[data-version-label]").forEach((el) => {
    el.textContent = `Nunya ${release.version} is out`;
  });

  const line = document.getElementById("release-line");
  if (line) {
    line.innerHTML =
      `Nunya <b>${escapeHtml(release.version)}</b> (${kind}), released ${escapeHtml(date)}. ` +
      `<a href="${escapeHtml(release.url)}" rel="noopener">Release notes</a> · ` +
      `each file has a SHA-256 in <code>SHA256SUMS</code>.`;
  }

  return found;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// ------------------------------------------------------------------ the visitor's system

function detectOS() {
  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
  const ua = navigator.userAgent;
  if (/android|iphone|ipad|ipod/i.test(ua)) return "mobile";
  if (/mac/i.test(platform) || /Macintosh/.test(ua)) {
    // iPadOS reports itself as a Mac; a touch screen gives it away.
    return navigator.maxTouchPoints > 1 ? "mobile" : "mac";
  }
  if (/win/i.test(platform) || /Windows/.test(ua)) return "win";
  if (/linux|x11|cros/i.test(platform) || /Linux|X11/.test(ua)) return "linux";
  return null;
}

// Browsers seldom name the distribution, but some (Firefox on Ubuntu and Fedora) still do.
function detectDistro() {
  const ua = navigator.userAgent;
  if (/Ubuntu|Debian|Mint|Pop!_OS|elementary/i.test(ua)) return "deb";
  if (/Fedora|Red Hat|openSUSE|SUSE|CentOS/i.test(ua)) return "rpm";
  if (/Arch|Manjaro|EndeavourOS/i.test(ua)) return "arch";
  return null;
}

function highlightSystem(os, distro, found) {
  const hero = document.getElementById("hero-download");
  const label = document.getElementById("hero-download-label");
  const meta = document.getElementById("hero-meta");

  if (os === "mobile") {
    label.textContent = "Get Nunya for desktop";
    meta.textContent = "Nunya runs on macOS, Windows and Linux. Phone apps aren't out yet.";
    return;
  }
  if (!os) return;

  document.querySelector(`.platform[data-os="${os}"]`)?.classList.add("is-you");
  label.textContent = `Download for ${OS_LABEL[os]}`;

  const direct = { mac: "mac-dmg", win: "win-exe" }[os];
  if (direct && found && found[direct]) {
    hero.href = found[direct].url;
    meta.innerHTML =
      `${escapeHtml(found[direct].name)} · ${formatSize(found[direct].size)} &nbsp;—&nbsp; ` +
      `<a href="#download">other platforms</a>`;
  }

  if (os === "linux" && distro) {
    const pkg = { deb: "deb-amd64", rpm: "rpm-x86_64", arch: "arch" }[distro];
    document.querySelector(`.pkg[data-asset="${pkg}"]`)?.classList.add("is-you");
    const radio = document.querySelector(`input[name="distro"][value="${distro}"]`);
    if (radio) {
      radio.checked = true;
      showDistro(distro);
    }
  }
}

// ------------------------------------------------------------------ tabs

const tabs = [...document.querySelectorAll('[role="tab"]')];

function selectTab(tab, focus = false) {
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
  });
  if (focus) tab.focus();
}

tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (step) {
      e.preventDefault();
      selectTab(tabs[(i + step + tabs.length) % tabs.length], true);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      selectTab(tabs[e.key === "Home" ? 0 : tabs.length - 1], true);
    }
  });
});

// Links such as "#guide-win" open that platform's tab and scroll to the guide.
function openGuideFromHash() {
  const id = location.hash.slice(1);
  const tab = tabs.find((t) => t.getAttribute("aria-controls") === id);
  if (!tab) return false;
  selectTab(tab);
  document.getElementById("guide").scrollIntoView();
  return true;
}
window.addEventListener("hashchange", openGuideFromHash);

// ------------------------------------------------------------------ distributions

function showDistro(value) {
  document.querySelectorAll("#guide-linux [data-distro]").forEach((el) => {
    el.hidden = el.dataset.distro !== value;
  });
}

document.querySelectorAll('input[name="distro"]').forEach((radio) => {
  radio.addEventListener("change", () => showDistro(radio.value));
});

// ------------------------------------------------------------------ copy buttons

document.querySelectorAll(".copy").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const text = btn.parentElement.querySelector("pre").innerText.trim();
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied";
      btn.classList.add("done");
    } catch {
      btn.textContent = "Select & copy";
    }
    setTimeout(() => {
      btn.textContent = "Copy";
      btn.classList.remove("done");
    }, 1800);
  });
});

// ------------------------------------------------------------------ theme
//
// Three states: no attribute follows the system (the default), and data-theme="light" or "dark" is the
// visitor's own pick, remembered in localStorage. The script in <head> applies it before first paint.

const THEME_KEY = "nunya-theme";
const THEME_NEXT = { system: "light", light: "dark", dark: "system" };
const THEME_COLOR = { light: "#eef1f7", dark: "#090d1a" };
const themeButton = document.getElementById("theme-toggle");
const themeMetas = [...document.querySelectorAll('meta[name="theme-color"]')];

function currentTheme() {
  return document.documentElement.dataset.theme || "system";
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;

  try {
    if (theme === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {}

  // The browser bar colour: per scheme when following the system, the picked one otherwise.
  themeMetas.forEach((meta) => {
    const scheme = /dark/.test(meta.media) ? "dark" : "light";
    meta.content = THEME_COLOR[theme === "system" ? scheme : theme];
  });

  const label = `Theme: ${theme}. Switch to ${THEME_NEXT[theme]}`;
  themeButton.setAttribute("aria-label", label);
  themeButton.title = label;
}

themeButton.addEventListener("click", () => applyTheme(THEME_NEXT[currentTheme()]));
applyTheme(currentTheme());

// ------------------------------------------------------------------ nav

const nav = document.querySelector(".nav");
const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// ------------------------------------------------------------------ start

const os = detectOS();
const distro = os === "linux" ? detectDistro() : null;

const osTab = tabs.find((t) => t.id === `tab-${os}`);
if (!openGuideFromHash() && osTab) selectTab(osTab);

highlightSystem(os, distro, null);

latestRelease()
  .then((release) => highlightSystem(os, distro, applyRelease(release)))
  .catch(() => {
    // Leave the Releases-page fallbacks in place; they always work.
    document.querySelectorAll("[data-asset]").forEach((el) => (el.href = RELEASES));
  });
