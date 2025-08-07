# GitLab Issues SLA Dashboard

A lightweight HTML dashboard that displays open issues from a GitLab project and highlights their SLA status.

## 📌 Purpose

This dashboard was created to help service teams easily monitor open issues from the GitLab project [`raidiam-conformance/open-finance/certification`](https://gitlab.com/raidiam-conformance/open-finance/certification). It calculates how many working days (Monday–Friday) each issue has been open and highlights those that are over the 10-working-day SLA.

## 🚀 Features

- 📡 **Live fetch** of issues from GitLab (public API, no token needed)
- 📆 **SLA tracking** (10 working days)
- 🔴 Issues over SLA highlighted in **red**
- ✅ Issues within SLA shown in **green**
- 🔄 **Manual refresh** button to reload the list
- 🔗 Clickable issue links to open directly on GitLab

## 🛠️ How to Run

1. Download or clone this repository (or just the HTML file `gitlab_dashboard.html`).
2. Open `gitlab_dashboard.html` in any modern web browser (e.g., Chrome, Firefox, Edge).
3. The dashboard will load open issues automatically.
4. Click the **🔄 Refresh** button anytime to reload issue data.

> 💡 No installation or dependencies required.

## 📦 File Structure

- `gitlab_dashboard.html` — The single-file application with embedded JavaScript and styling.

## 📐 SLA Logic

The dashboard calculates SLA using the number of **working days** between the issue's creation date and today. Weekends are skipped. If an issue is open for more than 10 working days, it is marked as **Over SLA**.

## 📍 GitLab Project Source

Data is pulled from:
[https:]()
