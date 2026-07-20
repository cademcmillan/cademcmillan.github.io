# CCM — cademcmillan.com

Your personal daily briefing: live markets, today's games with betting lines, weather,
world news, a daily word, a daily historical figure, a daily geography fact, movies,
the puzzle-game circuit, and a drop box that emails submissions straight to you.

Pure static site — no server, no build step. Works on GitHub Pages as-is.

---

## 1. Put it on GitHub (replaces your current site)

1. Open your website repo on GitHub (the one currently serving cademcmillan.com).
2. Delete the old files (or move them to an `old/` folder).
3. Upload **everything in this folder** to the root of the repo — including the
   `CNAME` file (that's what keeps your custom domain working) and the hidden
   `.nojekyll` file.
4. Commit. GitHub Pages redeploys automatically in about a minute.
5. If Pages isn't already on: repo **Settings → Pages → Deploy from branch → main / root**,
   and set the custom domain to `cademcmillan.com`.

## 2. Two-minute setup (edit `js/config.js`)

Open `js/config.js` — it's the only file you ever need to touch:

| Setting | What it does | Required? |
|---|---|---|
| `CONTACT_EMAIL` | Where Drop Box submissions get emailed (via free formsubmit.co) | Yes, for the form |
| `TMDB_API_KEY` | Powers the Movies sections. Free key: themoviedb.org → Settings → API | Yes, for movies |
| `FINNHUB_API_KEY` | Powers the earnings-calendar table on the Stocks tab. Free key: finnhub.io | Optional |
| `CITIES` | Weather cities — add as many as you want with lat/lon | Pre-filled |

**Drop Box heads-up:** the very first time someone submits the form, FormSubmit sends
*you* a one-time confirmation email. Click the link once and every submission after
that lands in your inbox.

**Note on keys:** on a static site, config values are visible to visitors. That's normal
and fine for free-tier keys like TMDB/Finnhub — just don't ever paste a paid or private
key in there.

## 3. What updates, and how often

- **Ticker + stock widgets (TradingView):** live/streaming — better than every 5 minutes.
- **Sports, weather, world news:** fetched fresh on every page load and auto-refreshed
  every 5 minutes while the page is open.
- **Historical figure, word of the day, geography fact:** rotate automatically at midnight —
  new ones every day, no maintenance needed.
- **Watchlist:** saved in your browser (localStorage), so it persists between visits.

## 4. Making it yours

- **Add weather cities:** append to `CITIES` in `js/config.js` (google "city coordinates").
- **Add vocab words:** extend `CCM_WORDS` in `js/data.js`.
- **Add geography facts:** extend `CCM_GEO_FACTS` in `js/data.js` (same format).
- **Change colors/fonts:** everything lives in the `:root` block at the top of `css/style.css`.

## Data sources (all free)

TradingView (markets), ESPN public feeds (scores, odds, headlines), Wikipedia
(historical figures), Free Dictionary API (words), TMDB (movies), Open-Meteo
(weather), BBC World (news via RSS), FormSubmit (contact form).
