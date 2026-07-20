/* ============================================================
   CCM SITE CONFIG — edit this file, nothing else needs to change
   ============================================================ */

window.CCM_CONFIG = {

  /* 1) YOUR EMAIL — the "Drop Box" form at the bottom of the home
     page sends submissions here via formsubmit.co (free, no account).
     IMPORTANT: the first time someone submits, FormSubmit emails you
     a one-time confirmation link. Click it once and you're live. */
  CONTACT_EMAIL: "YOUR_EMAIL_HERE@example.com",

  /* 2) MOVIES — get a free API key at https://www.themoviedb.org
     (create account -> Settings -> API -> Request key -> "Developer").
     Takes ~2 minutes. Paste the "API Key (v3 auth)" between the quotes.
     Until then the Movies section shows setup instructions. */
  TMDB_API_KEY: "",

  /* 3) EARNINGS CALENDAR (optional) — free key at https://finnhub.io
     (sign up -> dashboard shows your key). Powers the "upcoming
     earnings" table on the Stocks tab. Everything else on the Stocks
     page works without it. */
  FINNHUB_API_KEY: "",

  /* 4) WEATHER CITIES — add as many as you want. Find lat/lon by
     googling "<city> coordinates". First city = home page weather. */
  CITIES: [
    { name: "Houston, TX",   lat: 29.7604, lon: -95.3698 },
    { name: "New York, NY",  lat: 40.7128, lon: -74.0060 },
    { name: "Amesbury, MA",  lat: 42.8584, lon: -70.9300 }
  ]
};
