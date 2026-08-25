# APL Storytime Fall 2026 calendar

Subscribeable iCal of Austin Public Library storytimes for **7 September – 21 November 2026**, transcribed from dated APL event listings that match the printed Fall 2026 flyer.

**Status:** Pages path `/storytime/` after merge — https://tuchel.github.io/tuchel-general/storytime/

Map + day calendar of the same dated listings: pick a day, see which branches have a program, sort by distance, open the APL listing. The map is the full canvas; the calendar and schedule sit on a floating paper card. Tapping a branch highlights it in the list — it does not hide the rest of the day.

## Add to iCal / Apple Calendar

After the Pages deploy:

1. Open https://tuchel.github.io/tuchel-general/storytime/
2. Tap **Add to Apple Calendar** (uses `webcal://…/storytime.ics`), or
3. In Calendar on Mac: File → New Calendar Subscription… and paste `https://tuchel.github.io/tuchel-general/storytime/storytime.ics`

Google Calendar: use **Add to Google Calendar** on that page, or Settings → Add calendar → From URL with the same HTTPS `.ics` link.

Until Pages is live, download `web/storytime.ics` from this folder and import it (File → Import on Mac Calendar). Import is a snapshot; subscribe is the live file.

## What is on the feed

Dated programs from APL tag pages (All Ages, Pajama, Books and Babies, Toddler, Preschool, dual-language, Music & Movement, Spanish storytime) that fall inside the flyer window. Durations are the listing’s start–end, not a guessed length. Closed days from the [APL holiday schedule](https://library.austintexas.gov/node/1734929) (Labor Day 6–7 Sep 2026, Veterans Day 11 Nov 2026) have no in-person events.

“Select” flyer lines (pajama at Windsor Park / Milwood / Howson, Saturday All Ages at Hampton and Windsor Park, Twin Oaks language rotation, Mandarin third Fridays, Portuguese last Wednesdays, and so on) use the **dated** library listings, not a fake weekly recurrence.

This is unofficial. APL can cancel or move a program; the event URL in each calendar item is the listing to check.

## Flyer slots not on the feed

These weekly flyer lines had no matching dated event on the library site when the feed was built. They are listed on the subscribe page and are **not** injected as guessed dates:

- Little Walnut Creek All Ages, Wednesdays 10:30 AM
- Southeast Spanish-English, Wednesdays 11 AM
- Southeast Books and Babies, Fridays 12:30 PM
- Spicewood Springs Books and Babies, Mondays 2:00 PM
- Spicewood Springs Toddler, Wednesdays 10:15 AM
- Spicewood Springs Preschool, Wednesdays 11 AM

Hora de Cuentos on the flyer at University Hills Tuesdays 10 AM is represented by dated **Cuentos con Senora Lili** listings (mostly Wednesdays 10–11 AM at that branch). Virtual Hora de Cuentos is the Tuesday 6 PM Zoom program; the Zoom link is issued after registering on the APL event page.

## Rebuild

```bash
cd projects/2026-08-apl-storytime
python3 scripts/build_calendar.py --scrape   # refresh APL listings
python3 scripts/test_calendar.py
```

Without `--scrape`, the builder reuses `data/events_scraped.json`.

Map app:

```bash
cd projects/2026-08-apl-storytime/web
npm install
npm run dev    # http://localhost:5173/tuchel-general/storytime/
```

Branch coordinates are OpenStreetMap/Nominatim lookups stored in `data/branches.json`.

## Prior art

See [`notes/prior-art.md`](notes/prior-art.md). APL’s events site is browse-only; this project’s named delta is a subscribeable ICS for the flyer season.
