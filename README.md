# Paper Black

A layout for the [Herdr](https://herdr.dev) desktop app: Herdr's main layout in light paper colors, with every terminal on a near-black card.

![Paper Black](preview.png)

## Install

Ask your agent to add this repo as a Herdr layout, or copy the files yourself:

```sh
cp layouts/paper-black.json layouts/paper-black.svg ~/.config/herdr-app/layouts/
cp themes/paper-black.json ~/.config/herdr-app/themes/
herdr-app do layout.switch '{"name":"paper-black"}'
```

Use light appearance to see it. In dark appearance it shows Herdr's graphite theme with a near-black terminal area.

## Known limitation

Herdr draws reverse-video text (SGR 7) in the theme background, which this layout keeps white for its panels. Reverse video with default colors, such as `less`'s `(END)`, shows as white on light gray. See "Watch out" in [RECIPE.md](RECIPE.md).
