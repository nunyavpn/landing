# landing

The website for [Nunya](https://github.com/nunyavpn/nunya): what it is, where to download it, and how
to install, update and remove it on macOS, Windows and Linux.

Plain HTML, CSS and JavaScript, so there is no build step and no dependencies.

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

## How it works

| File | What it holds |
| --- | --- |
| `index.html` | Every section of the page, including the per-platform guides |
| `styles.css` | The app's own colour tokens (from `nunya/src/styles.css`), light and dark |
| `main.js` | Fills in the newest release, picks out the visitor's system, and runs the tabs and copy buttons |
| `assets/` | The logo and screenshots, copied from `nunya/docs` |

`main.js` asks the GitHub API for the newest published release. It includes betas, which are
pre-releases that `/releases/latest` would skip. It then points each download button at the
matching file and writes the real file names into the install commands. The answer is cached for 30
minutes per tab, since unauthenticated API calls are limited to 60 an hour. If the request fails,
or JavaScript is off, every button links to the Releases page and the commands show `<version>`.

The asset-name patterns in `ASSETS` follow `.github/workflows/release.yml` in the app repo. If the
release changes how files are named, update them here as well.

## Updating the content

- **Screenshots:** copy them again from `nunya/docs/screenshots` after the app changes.
- **Install, update and remove steps:** these restate the app README's *Installing* and *Updating*
  sections and the packaging in `release.yml`. Keep them in step.

## Deploying

The site is static, so any host works. For GitHub Pages, go to Settings → Pages and serve the `main`
branch from `/`. `.nojekyll` stops Jekyll from processing the files.
