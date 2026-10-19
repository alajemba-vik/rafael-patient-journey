# Theme

The Institut Rafaël look for every page: colors, fonts, spacing, radii and a few shared components, taken from [institut-rafael.fr](https://institut-rafael.fr/).

The full design system (brand book, usage rules, live previews) is the [Institut Rafaël design system artifact](https://claude.ai/artifact/B58d9rTBaBKvZt6UQzzVGZ). It is the source of truth: change values there first, then mirror them here. The link is private until its owner shares it from the artifact's Share menu.

## Files

| File | What |
|---|---|
| `tokens.css` | CSS variables (`--ink`, `--accent`, `--space-5`, `--radius-xs`…) and `rf-` type classes (`rf-display-xl`, `rf-body`…). Load first. |
| `components.css` | Component classes: `rf-btn`, `rf-navlink`, `rf-tag`, `rf-card`, `rf-stat`, `rf-media`, `rf-quote`, `rf-page`. |

## Use

- Load `tokens.css`, then `components.css`, once in the app shell.
- Wrap the app in an element with class `rf-root` to get the background, text color, body font and focus ring.
- Light ("Clair") is the default. Set `data-theme="dark"` on `<html>` for the dark theme ("Nuit").
- Use the variables, never raw hex values or pixel sizes, in page styles.
- If we pick NiceGUI, map `--ink`, `--accent` and the surfaces into the Quasar brand colors too, so its built-in components match.

## Rules that matter most

- Text is `--ink`. Amber (`--accent`) is for button fills and current-state markers. Amber text is allowed only on `--band` (navy); on light backgrounds it is unreadable.
- The display font is for headings and labels only; running text uses the body font.
- There are no status colors yet (success, warning, error). Get them validated with the Institute before adding them.

## Not included yet

- The official logo: get the files from the Institute. Never redraw it.
- Pilat Extended, the site's licensed font. Krona One stands in until we have a license that covers the app.
- Form fields, tables, calendar, alerts: to add in `components/forms`, `components/tables` and `components/feedback`, built on these tokens.
