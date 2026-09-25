# Brand assets

`household-logo.svg` is the source of truth for the Household logo. T3 Code reads it as the project icon through `t3.json`.

The web app serves a copy at `clients/web/public/household-logo.svg` for the header, the login screen and the browser favicon. The web image and the dev sync only see `clients/web`, so the copy has to live there. After changing the logo, copy it over:

```bash
cp assets/household-logo.svg clients/web/public/household-logo.svg
```
