# Carpool Mauritius — version C

Capped cost sharing for trips people were already making. Built for Bojo Solutions in Mauritius.

This repository is only version C. It is not free matching (A) and it is not paid rides (B). The amount on a seat is a contribution to running cost, stopped at a cap an admin sets. If the cap is missing, new requests are blocked. The app does not invent a statutory rupee figure.

The hosted demo is fully static. Nothing is sent to a server.

**Pages:** https://boyjonauth2021-netizen.github.io/carpool-mauritius-c-costshare/

**Static output folder:** `out/`

## Run it locally

```bash
npm ci
npm test
npm run build
npm run preview
```

Open http://127.0.0.1:4317/carpool-mauritius-c-costshare/

`npm run dev` starts the Next.js dev server on port 4317 at the same base path. The preview command serves the static `out/` folder, which is what GitHub Pages serves.

Hash routes keep the app on one HTML file: `#/rides`, `#/rides/new`, `#/admin`, `#/admin/settings`.

## Demo, no credentials

The first visit seeds this browser. Every sample account uses the password `demo-pass`:

| Who | Email | One click |
| --- | --- | --- |
| Passenger | passenger@bojo.demo | Meera |
| Driver | driver@bojo.demo | Kevin |
| Admin | admin@bojo.demo | Admin desk |
| Driver waiting for review | asha@bojo.demo | Driver awaiting review |

Sample rates are Rs 15 per km running cost and Rs 8 per km cap. They are labelled demo. The admin desk can change them, clear them, or restore them. Clearing them blocks new bookings.

Maps, SMS, email, and payment are mocks. Distance comes from a small gazetteer of Mauritian towns. The OTP is shown on the registration form. Messages stay in the inbox. Marking a handover records that no money moved.

Reset from `#/account`.

## Deploy to GitHub Pages

The site is https://boyjonauth2021-netizen.github.io/carpool-mauritius-c-costshare/

1. Push this repository to `boyjonauth2021-netizen/carpool-mauritius-c-costshare` on the `main` branch.
2. In the GitHub repo, set Settings → Pages → Build and deployment → Source to **GitHub Actions**.
3. `.github/workflows/pages.yml` runs `npm ci`, `npm test`, and `npm run build`, then uploads the `out/` folder.

The build sets `basePath` to `/carpool-mauritius-c-costshare/`. No secrets are required. Do not add API keys to the Pages environment.

Local check of that same folder:

```bash
npm run build
npm run preview
```

## Keys

Copy `.env.example` only if you want to experiment. The Pages build ignores it. Real key names, and the open legal questions, are in [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md). The plan and the logical data shape are in [docs/PLAN.md](docs/PLAN.md).

## Tests

```bash
npm test
```

The cost-share formula, the cap, matching, the gazetteer, and the demo flow (request, accept, tighten the cap, mock OTP, offline handover) are covered by Vitest.
