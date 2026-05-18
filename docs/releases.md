# Releases

GitHub Releases drive image tags, install bundles, and update channels.

## Channels

- Normal GitHub Releases publish the `stable` moving tag.
- Prereleases publish the `unstable` moving tag.
- Every release also publishes immutable images tagged with the release tag.

## Images

The release workflow builds and pushes multi-architecture images for `linux/amd64` and `linux/arm64`:

- `ghcr.io/<owner>/household-api:<tag>`
- `ghcr.io/<owner>/household-web:<tag>`
- `ghcr.io/<owner>/household-updater:<tag>`

The same images are also tagged as `stable` or `unstable` based on the GitHub Release type.

## Release assets

The workflow uploads:

- `household-release-bundle.tar.gz`
- `household-release.json`
- `SHA256SUMS`

The release bundle contains:

- `docker-compose.yml`
- `.env.example`
- `observability/`
- `INSTALL.md`
- `UPGRADE.md`
- `household-release.json`
- `SHA256SUMS`

The bundle never contains a real `.env` file.

## Manifest

`household-release.json` includes:

- Release version and channel.
- Repository name.
- Compose and env example filenames.
- Supported platforms.
- Image names, tags, and digests.
- Whether a backup is required before updating.

## Manual verification

After downloading a bundle:

```bash
tar -xzf household-release-bundle.tar.gz
sha256sum -c SHA256SUMS
```

Then follow `INSTALL.md` or [home-server install](install/home-server.md).
