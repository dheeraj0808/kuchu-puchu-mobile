# kuchu-puchu-mobile

Kuchu Puchu Android-first dating app, built with Expo, React Native and TypeScript.

## Project rules

These rules apply to every change in this app.

### 1. Which document to follow

| Area | Source of truth |
| --- | --- |
| UI: screens, layout, colours, fonts, copy | [docs/Kuchu-Puchu-App-UI-50-Screens.pdf](docs/Kuchu-Puchu-App-UI-50-Screens.pdf) |
| Everything else: tech stack, API, architecture, features, testing, release | [docs/Kuchu-Puchu-App-Developer-Guide.pdf](docs/Kuchu-Puchu-App-Developer-Guide.pdf) |

If the two documents disagree, the UI deck wins on how things look, and the Developer Guide wins on how things work.

### 2. Colours

Use only these four brand colours:

| Name | Hex |
| --- | --- |
| Pink | `#c76883` |
| Black | `#111111` |
| White | `#ffffff` |
| Pink shade | `#fff8f8` |

Only transparent variants of these are allowed (for example black at 60% for secondary text). The one exception is a system red for errors and destructive actions.

### 3. Fonts

| Font | Use |
| --- | --- |
| Bricolage Grotesque | Names and headings |
| Plus Jakarta Sans | All other text |

## Commands

```bash
npx expo start      # start the dev server
npx expo lint       # lint
npx tsc --noEmit    # typecheck
npm test            # unit tests
```
