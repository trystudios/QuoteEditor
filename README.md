# Quote Language Editor

A static, browser-only app for swapping a quote card's text into another
language after the fact — no server, nothing uploaded anywhere, everything
runs locally in the browser.

Companion project: [`QuoteMaker_v2`](https://github.com/trystudios/QuoteMaker_v2)
generates the original English quote cards and, alongside each `.jpg`,
exports a `<name>.json` "recipe" file (the card's background image plus its
font/size/color styling). This app opens that recipe, lets you replace the
English text with another language, and re-exports the card as a JPG with
the same look.

## Live

Hosted at **https://quoteeditor.vercel.app** — just open that link, no setup
needed.

It's deployed directly from this folder via the Vercel CLI (not connected to
GitHub), so the repo stays private while the site itself is public. To push
an update after changing any files here:

```bash
npx vercel --prod
```

Run that from this folder — it redeploys to the same URL.

## How to run it locally

No install, no build step — it's plain HTML/CSS/JS.

```bash
git clone https://github.com/trystudios/QuoteEditor.git
```

Then just open `index.html` directly in a browser (double-click it, or drag
it into a browser tab). If you'd rather have it at a `localhost` URL, serve
the folder with any static file server, e.g.:

```bash
cd QuoteEditor
python3 -m http.server 8899
# open http://localhost:8899/index.html
```

## Features

- Load any number of `.json` recipe files at once — each becomes its own
  editable card, stacked on the page (e.g. a whole week's worth of cards)
- Independent text/font/size/color controls for the quote and its
  attribution
- Font picker searches the full Google Fonts catalog (~1942 families) with a
  live preview of each option rendered in its own font
- Automatic script-aware fallback (e.g. Noto Sans Devanagari, Noto Sans
  Arabic) if the chosen font is missing glyphs for the language you typed
- Export one card or all loaded cards as JPGs

## Usage guide (for non-technical users)

This is the walkthrough for someone receiving the app as a zipped folder
rather than cloning it from GitHub — e.g. via a shared Google Drive link.

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
