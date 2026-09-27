# Brand assets

`household-logo.svg` is the source of truth for the Household logo. T3 Code reads it as the project icon through `t3.json`. `household-favicon.ico` is exported from it at 16, 32 and 48 px, one PNG per size.

The web app serves copies, because the web image and the dev sync only see `clients/web`. The SVG is used by the header, the login screen and the browser icon; Next serves the ICO as `/favicon.ico`. After changing the logo, export the ICO again and copy both over:

```bash
cp assets/household-logo.svg clients/web/public/household-logo.svg
cp assets/household-favicon.ico clients/web/src/app/favicon.ico
```
