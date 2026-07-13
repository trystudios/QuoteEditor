# Quote Language Editor

A static, browser-only app for swapping a quote card's text into another
language after the fact. Translators can either use the quotes already
preloaded for the current/upcoming week, or upload their own recipe JSONs —
whichever's convenient. Nothing is uploaded anywhere except through the
password-protected admin page.

Companion project: [`QuoteMaker_v2`](https://github.com/trystudios/QuoteMaker_v2)
generates the original English quote cards and, alongside each `.jpg`,
exports a `<name>.json` "recipe" file (the card's background image plus its
font/size/color styling). This app opens that recipe, lets you replace the
English text with another language, and re-exports the card as a JPG with
the same look.

## Live

Hosted at **https://quoteeditor.vercel.app** — just open that link, no setup
needed.

Deployed via the Vercel CLI under the `premrawatquotes@gmail.com` account
(project `prquotes/quoteeditor`) — not connected to GitHub, so the repo stays
private while the site itself is public.

**To redeploy after changing files here:** running `vercel` commands directly
from this folder can hang indefinitely — it's synced via OneDrive, and
OneDrive's on-demand file hydration seems to interfere with the CLI's own
file/auth handling. The reliable way is to copy the files to a plain local
folder first and deploy from there:

```bash
SCRATCH=/tmp/quoteeditor_deploy
rm -rf "$SCRATCH" && mkdir -p "$SCRATCH/api"
cp index.html app.js style.css data.html data.js weekdates.js fonts.js \
   fontpicker.js google-fonts-list.js package.json package-lock.json \
   vercel.json "$SCRATCH/"
cp api/weeks.js "$SCRATCH/api/"
cd "$SCRATCH"
vercel link --project quoteeditor --yes   # first time only
vercel --prod --yes
```

(If any individual `cp` times out, just rerun it — OneDrive tends to succeed
on the second attempt once the file's hydrated.)

## Weekly quotes admin

**https://quoteeditor.vercel.app/data** — password-protected page for
uploading each week's recipe JSONs (from QuoteMaker_v2's Step 7 output). Pick
the week's Monday, drop the `.json` files, upload. Up to 20 files total can be
stored across all weeks at once — uploading more evicts the oldest stored
week first. Existing weeks can be deleted from the same page.

The homepage shows 4 week tabs — the previous week, the current/upcoming
week (selected by default), and the next 2 weeks — computed from today's
date, so it automatically rolls forward each Monday without needing a manual
update. Tabs for weeks with no uploaded data still show, just empty.

## How to run it locally

No install, no build step for the static parts — it's plain HTML/CSS/JS. The
`/data` page's upload/delete does need the `/api/weeks` serverless function
and Vercel Blob storage, so use `vercel dev` (not a plain static file server)
to test that locally:

```bash
git clone https://github.com/trystudios/QuoteEditor.git
cd QuoteEditor
npm install
vercel dev
```

If you only need the main editor (drag-and-drop upload, no `/data` admin
page, no week tabs), any static file server works fine, e.g.
`python3 -m http.server 8899`.

## Features

- Week tabs on the homepage auto-select the current/upcoming week (see
  "Weekly quotes admin" above); manual drag-and-drop upload still works
  alongside them
- Load any number of `.json` recipe files at once — each becomes its own
  editable card, stacked on the page (e.g. a whole week's worth of cards)
- Independent text/font/size/color controls for the quote and its
  attribution
- Font picker searches the full Google Fonts catalog (~1942 families) with a
  live preview of each option rendered in its own font
- Automatic script-aware fallback (e.g. Noto Sans Devanagari, Noto Sans
  Arabic) if the chosen font is missing glyphs for the language you typed
- Export one card or all loaded cards as JPGs, named after their original
  date (e.g. `Jul 13.jpg`)

## Usage guide (for non-technical users)

This is the walkthrough for someone receiving the app as a zipped folder
rather than using the live site directly — e.g. via a shared Google Drive
link. (In practice, most translators can just visit
https://quoteeditor.vercel.app/ directly and the current week's quotes are
already loaded — this manual flow is only needed for an offline copy or an
older/different set of quotes.)

> **Steps:**
>
> 1. Go to this link: https://drive.google.com/drive/folders/1t7JQDj5Coq6FIxQFwAfRETAJUjjSTbkc?usp=drive_link
> 2. Download the zip file in this link to your desktop or system.
> 3. Unzip the file.
> 4. Open the `index.html` file in this folder, which will open in a browser
>    like Chrome. It will look like this:
>
>    ![Open index.html](docs/01_open_index.png)
>
> 5. Download the JSON zip file that gets sent along with the quotes every
>    week.
> 6. Unzip the JSON files.
> 7. Now upload these JSON files in the browser tab you opened in Step 4.
> 8. You can now see that the quotes are visible in English, and the text on
>    the right side is editable. It will look like this:
>
>    ![Editable card](docs/02_editable_card.png)
>
> 9. Now you can simply edit the English text to the corresponding language
>    and adjust the font size and color if required.
> 10. Export the updated files as JPGs.
