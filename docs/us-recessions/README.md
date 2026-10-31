# US recessions, political parties & global causes (1857–2020)

Static dashboard of the 34 NBER-dated US recessions (1857–2020). It shows the president and party in office at the start and end of each recession, how far into the term each one began, the preceding administration, exposure-adjusted rates per party (based on years in office), listed causes grouped into keyword-derived categories, World Bank global-recession overlap, and stock-index drawdowns. Everything comes from `data/recessions.json`, and the methodology and every source link are shown on the page. Correlation is not causation: these charts are a way to explore the patterns, and they don't show who or what caused a recession.

## Files
- `index.html`: the page
- `assets/style.css`, `assets/app.js`: styles and chart/table logic (Chart.js 4.4.1 loaded from jsDelivr)
- `data/recessions.json`: the source data
- `data/recessions.js`: the same data wrapped as `window.RECESSION_DATA`, so the page also works when opened straight from disk (file://)

All paths are relative, so the folder works from any subpath.

## Publish on GitHub Pages (as `docs/us-recessions/` in an existing repo)
1. Copy this folder into the repo as `docs/us-recessions/`, then commit and push to `main`.
2. In the repo, open **Settings → Pages**. Under "Build and deployment", choose **Deploy from a branch**, pick branch `main` and folder `/docs`, and save. Skip this step if Pages is already serving `/docs`.
3. After the Pages build finishes, the page is at `https://<user>.github.io/<repo>/us-recessions/`.

## Update the data
Replace `data/recessions.json`, then regenerate `data/recessions.js`:
```
python3 -c "import json;d=open('data/recessions.json').read();json.loads(d);open('data/recessions.js','w').write('window.RECESSION_DATA = '+d.rstrip()+';\n')"
```
