Price Checks — No Blank Pages

What’s new (to kill blank pages):
1) In print, **grid → block** for `.page-inner` (works around a Chromium grid pagination quirk).
2) Use both modern `break-after: page` and legacy `page-break-after: always`, with a `:last-child` override.
3) Recalculate the **2-per-page guard** right before print.
4) Remove any empty `.page` elements before print, then force a reflow.

Tips
- Keep Paper = **Letter**, Scale = **100%**, Margins = **Default/Minimum**.
- If your printer/PDF driver enforces larger margins, reduce **Print image max-height** or spacing sliders slightly.

Everything else remains: sticky header, crop modal (dark-mask cutout), spacing sliders, Title Case from filenames.
