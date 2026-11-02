# Paper Black

Herdr's main layout in light paper colors, with every terminal on a near-black card. The sidebar, tab bar, status bar, pane headers and the Files and Changes panels stay light. Only the terminal area under each pane header is dark, with light text and a blue block cursor. In dark appearance it shows Herdr's graphite theme, and the terminal area is the same near-black.

![Paper Black](preview.png)

## What you see

Left to right, in light appearance:

- **Sidebar**, 268px wide (44 to 480px), background `chrome` `#f1f1ee`, separated by a 1px `border` (`#00000017`) divider. From top to bottom:
  - the brand row, 46px: the Herdr logo, search and sidebar-fold buttons;
  - the Spaces list and the Agents list, sharing the rest of the height equally (each at least 90px);
  - the footer, 69px: Settings and Add machine.
- **Work column**, background `canvas` `#fafaf9`:
  - the tab bar, 42px: tabs as pills, a `+` menu, and Files and Changes buttons on the right;
  - the work body, 8px padding and 8px gaps: the panes of the shown tab, and an optional side panel on the right;
  - the status bar, 28px: machine, branch and agent count.
- **Pane cards**: radius 10px, 8px gap between panes, 1px `#00000017` border, 1px accent `#1f62d0` border on the focused pane. Every pane is framed, even a tab's only pane. Each card has a 30px white header on top: the terminal's title, its folder, the agent's status, and split, zoom and close buttons. Below the header the terminal area is `#0e0f11`, with 14px by 12px terminal padding.
- **Terminal colors**: text `#d4d6db`, cursor `#2f6fe4`, selection `#2f4a6e`. ANSI 0 to 15: `#45484f #d6525a #368f45 #a3761d #377fdc #aa5fca #2a8b91 #c8cad0 #838790 #f0a5ad #bad5a2 #ead2a1 #b0cbef #cbb7e6 #a4d5db #f2f2f4`.
- **Side panel**, 368px (280 to 900px), hidden until opened: the Files tree or the Changes list, on white cards with dark text.
- **Panel text and accents** are paper's: foreground `#1b1b1e`, muted `#69696b`, dim `#969698`, accent `#1f62d0`, popovers `#ffffff`.

In dark appearance the theme is `graphite`. The terminal area stays `#0e0f11`, slightly darker than graphite's own cards.

## How it behaves

It behaves exactly like Herdr's main layout; only the colors differ.

- Agent status in the Agents list uses the theme colors: working is a spinning icon in `#9a6700`; blocked is a "Needs you" badge in `#c93c2c` on a tint of the same color; done is a filled `#2f6fe4` dot; idle is a `#a8a8aa` ring.
- The fold button in the brand row turns the sidebar into a narrow rail (76px on macOS, 44px elsewhere) and back.
- The Files and Changes buttons in the tab bar open the side panel. Which panel is open is remembered per space.
- Panes can be split, zoomed, closed and dragged by their top-center grip, as in main.
- Light or dark follows the system, or `appearance` in `settings.json`.

## Built from

- `layouts/paper-black.json`: a copy of Herdr's `main` layout (app 0.1.11) with four changes:
  - root `"theme": { "light": "paper-black", "dark": "graphite" }`;
  - root `"terminal_opacity": 0`;
  - the tab block's `pane.background` set to `"#0e0f11"` (main uses `"background"`);
  - root `"preview": "layouts/paper-black.svg"`.
- Node tree: root `row` → `sidebar` column (`brand` block with `workspace-chrome`; `sidebar-lists` column with `spaces` and `agents` blocks; `sidebar-footer` block with `workspace-chrome` and props `{ "footer": true }`) and `work` column (`tabs` block with `tabs`; `work-body` row with the `main` block `{ "tab": "active" }` and the `panel` column holding the `panel-body` stack of `files` and `changes`; `status` block with `workspace-status`).
- Shipped mods only: `workspace-chrome`, `spaces`, `agents`, `tabs`, `pane` (the pane header), `files`, `changes`, `workspace-status`. No mods of its own, no programs, no network, no files read.
- `themes/paper-black.json`: top-level `background` `#ffffff`, `foreground` (terminal text) `#d4d6db`, `selection`, `cursor` and the 16 ANSI colors, plus `colors` set to paper's panel colors. The theme has the layout's name, so Settings offers it only while this layout is shown.
- `layouts/paper-black.svg`: the picture in Settings → Look.

## Watch out

- The terminal's default background is the theme color `background`. Herdr uses the same color for pane headers, the Files and Changes panels and the input fields in the palette, pickers and dialogs. Keep it `#ffffff`. The black comes from the pane frame (`#0e0f11`) showing through a transparent terminal (`terminal_opacity: 0`). Setting `colors.background` dark makes those panels and inputs dark with dark text.
- In the theme file, the top-level `background` decides whether the theme counts as light. It does not change terminal rendering. Keep it `#ffffff`, or the theme moves to the dark list.
- The top-level `foreground` becomes `terminal_foreground` (terminal text). `colors.foreground` is the panel text. They are deliberately different.
- Herdr draws the character under the block cursor, and reverse-video cells (SGR 7), in the theme `background`, which is white here. The cursor is `#2f6fe4` so a white character on it reads (4.65:1). Reverse video with default colors stays white on `#d4d6db` (about 1.5:1) and is hard to read, for example `less`'s `(END)` and search highlights. No setting fixes this today.
- Keep `minimum_contrast` at `1`. It measures against the white `background`, so any higher value that fixes reverse video also turns normal terminal text near-black on the dark card.
- OSC 11 (set default background) sent by a program does not fix reverse video either.
- ANSI 1 to 6 are also panel text colors (Files syntax colors, Changes `+`/`−` counts), so they are mid-brightness: about 4:1 on white and 4.7:1 on `#0e0f11`. ANSI 9 to 14 are graphite's brighter set and used only by terminals.
- A copy of `main` made with `layout.clone` also copies main's theme clicks (`{ "light": "paper", "dark": "graphite" }`), which win over the file. Pick "paper black" once in Settings → Look on this layout, or run `herdr-app do app.theme '{"name":"paper-black"}'`.
- It is a copy of main from app 0.1.11 and does not get main's later changes.

## Done when

- After `herdr-app do layout.switch '{"name":"paper-black"}'`, `herdr-app status` shows `"layout": "paper-black"` and no errors.
- In light appearance the sidebar is `#f1f1ee`, the tab bar and status bar are light, each pane header is white, and the terminal area below it is `#0e0f11` with `#d4d6db` text.
- `printf '\e[31mred \e[32mgreen \e[33myellow \e[34mblue\e[0m\n'` reads clearly on the dark card.
- With the cursor over a character, the cursor is a `#2f6fe4` block and the character on it is readable.
- The Files panel opens on a white card with dark text.
- Settings → Look lists the theme "paper black" only while this layout is shown.
- In dark appearance the window shows graphite, with the terminal area `#0e0f11`.
