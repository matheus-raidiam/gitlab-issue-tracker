# GitLab Issues SLA Dashboard

A lightweight, static dashboard to monitor GitLab issues (Open Finance + Open Insurance) with SLA awareness, filters, sorting, and local notes.

## Purpose

Help the Service team quickly triage issues by showing:

* how long each issue has been open (in **working days**, Mon–Fri),
* whether it’s **Within SLA**, **Over SLA**, **SLA Paused**, or **No SLA**,
* grouped labels (Nature, Product, Status),
* and handy filters + per-issue notes saved in your browser.

Live demo: [https://sla-gitlab.netlify.app/](https://sla-gitlab.netlify.app/)

## Features

* **Two project feeds**:

  * Open Finance (OPF): `raidiam-conformance/open-finance/certification`
  * Open Insurance (OPIN): `raidiam-conformance/open-insurance/open-insurance-brasil`
* **Views**: Open issues, or issues **closed in the last 7 days**
* **SLA logic** (working days only) with automatic status:

  * Bug & Questions → **10** working days
  * Under Evaluation or **no Nature** tag → **3** working days
  * Under WG Evaluation / Waiting Participant / Production Testing → **SLA Paused**
  * Others → **No SLA**
* **Filters** by Nature, Product, and Status (with chips + quick clear)
* **Sorting** per table (ID, Title, Date, Working Days, SLA Status) with arrows
* **Local notes** (comments per issue) persisted via `localStorage`
* **Summary counters** (totals, SLA-applicable, Over SLA)
* **Empty states** that clearly explain why a table is empty
* **Refresh** button and **Reset Filters / Clear All Comments** actions
* **Deep links** from section titles to each project’s issues list in GitLab

## How it works

* Public GitLab REST endpoints (no tokens):

  * OPF: `https://gitlab.com/api/v4/projects/26426113/issues`
  * OPIN: `https://gitlab.com/api/v4/projects/32299006/issues`
* Working-day math excludes weekends.
* Comments are stored in the browser (no backend).
* “SLA Paused” when Status has **Under WG Evaluation**, **Waiting Participant**, or **Production Testing**.

## Getting started (local)

1. Download the three files: `index.html`, `styles.css`, `script.js`.
2. Put them in the same folder and open `index.html` in your browser.

> Tip: No build or server is required. It’s a static app.

## Deploying (Netlify or similar)

* Connect the repo and deploy as a static site.
* No environment variables or keys are needed (uses public APIs).

## File structure

```
/ (project root)
├─ index.html     # HTML shell + links to CSS/JS
├─ styles.css     # Theme + layout + empty state styles
└─ script.js      # Fetch, SLA logic, filters, sorting, render
```

## Configuration

If you need to point at different GitLab projects, change the IDs in `script.js`:

```js
await Promise.all([
  loadProjectIssues(26426113, 'finance'),  // Open Finance
  loadProjectIssues(32299006, 'insurance') // Open Insurance
]);
```

## SLA rules (summary)

* **Bug & Questions**: 10 working days
* **Under Evaluation** or **no Nature**: 3 working days
* **Under WG Evaluation / Waiting Participant / Production Testing**: SLA Paused
* **Others**: No SLA

## Limitations

* Assumes label taxonomy as described (Nature / Status / Product).
* National holidays are not excluded (only weekends).
* Browser storage for comments (cleared if you wipe site data).

## Credits

Built as a POC by the team for internal use and fast iteration.
