# ai-hubb
AI rules, skills, tools, and prompts collection

---

## 📊 Edmonton Business Dashboard

A self-contained dashboard displaying Edmonton-area businesses for sale is published in the `/docs` folder of this repository.

**Live Dashboard:** https://jasondhubbard.github.io/ai-hubb/ *(requires GitHub Pages to be enabled)*

### Dashboard Location

- **Dashboard:** [docs/index.html](docs/index.html)
- **Documentation:** [docs/README.md](docs/README.md)

### Enable GitHub Pages

To activate the live dashboard site:

1. Go to repository **Settings** → **Pages**
2. Configure source:
   - **Source:** Deploy from a branch
   - **Branch:** `main`
   - **Folder:** `/docs`
3. Click **Save**

The dashboard will be available at https://jasondhubbard.github.io/ai-hubb/ within 2-3 minutes.

### Dashboard Details

- Self-contained HTML (no build required)
- Displays Edmonton businesses for sale
- Data source: Google Drive (maintained by Business Finder)
- To update: Replace `docs/index.html` with new dashboard from Business List Dashboarder

### Alternative: GitHub Actions Deployment

A workflow has been added at `.github/workflows/pages.yml` that can deploy the dashboard using GitHub Actions. To use it:

1. Go to **Settings** → **Pages**
2. Set source to **GitHub Actions**
3. The workflow will automatically deploy on push to `main`
