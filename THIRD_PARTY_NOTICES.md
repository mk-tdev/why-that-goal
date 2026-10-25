# Third-party software and asset notices

This inventory covers all **133 package-lock entries**, including transitive dependencies, development tools and optional platform variants. Exact versions, npm archive URLs/integrities, license identifiers and hashes of preserved notice files are in [the machine-readable audit](docs/evaluations/dependency-licenses.json). Run `npm run audit:licenses` after `npm ci`; it fails on missing/stale notices, version mismatches or a new license requiring review. To regenerate after a reviewed dependency change, use `npm run audit:licenses -- --write`.

## Preserved attribution

[third_party/licenses](third_party/licenses) contains unaltered upstream copyright, license and bundled third-party notice files. A consolidated [browser-accessible copy](public/third-party-notices.txt) ships in the frontend at `/third-party-notices.txt`, linked from the app footer. Docker retains both the public copy and this notice directory, in addition to runtime packages' original licenses. Bundled component attributions in Vite, TypeScript, Rolldown and Prettier are retained in full; the lock-level count is not a count of every component named inside those notices.

| Declared license | Locked entries | Treatment |
| --- | ---: | --- |
| MIT | 112 | Preserve copyright, permission and disclaimer texts. |
| Apache-2.0 | 4 | Preserve license and supplied notices. No upstream files were modified. |
| BSD-3-Clause | 2 | Preserve copyright, conditions and disclaimer; no endorsement claim. |
| ISC | 2 | Preserve permission/copyright notices and disclaimer. |
| 0BSD | 1 | Preserve upstream notice. |
| MPL-2.0 | 12 | Unmodified Lightning CSS build tooling and optional native variants; source information below. |

Native esbuild/Rolldown/Lightning CSS platform packages are covered by their same-version upstream release notices, even when another OS's optional binary is not installed. The generator verifies matching license and version against the installed parent package, and records this mapping explicitly. This does not claim that every optional binary was downloaded or reverse-engineered.

## Lightning CSS and MPL-2.0

Lightning CSS 1.33.0 is a development/build dependency of Vite. It and its native platform variants remain unmodified. `npm prune --omit=dev` excludes them from the final runtime dependencies; their parser/minifier implementation is not imported into the browser application. Generated CSS is application output, not a redistributed copy of the minifier's implementation.

For recipients using the build tool, the covered source is available under MPL-2.0 from [the upstream v1.33.0 source](https://github.com/parcel-bundler/lightningcss/tree/v1.33.0); its published package is identified by its exact registry URL and integrity in the audit. The full MPL text is preserved locally. MPL applies to covered upstream files, not automatically to unrelated original app files. See [Mozilla's FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/).

## Fonts and original assets

The app requests **DM Sans** and **Barlow Condensed** from Google Fonts. Their respective copyright and SIL OFL-1.1 notices are preserved in [third_party/fonts](third_party/fonts) and the public notice file. No font binary is vendored or modified by this project. Upstream notices: [DM Sans](https://github.com/google/fonts/blob/main/ofl/dmsans/OFL.txt), [Barlow Condensed](https://github.com/google/fonts/blob/main/ofl/barlowcondensed/OFL.txt). Local fallback fonts remain available if the external font service is unavailable.

Match scenarios, fictional teams/players, procedural stadium/player geometry and pitch textures are created for this project. No third-party match footage, club crests or licensed match feed is included. The generated YouTube thumbnail is conceptual promotional artwork, not a product screenshot. The video editing tools use installed fonts to rasterize title cards; the app/container does not distribute those font files. Any user-added narration or music requires its own rights check.

## Container and service boundaries

The official Node.js Debian base image supplies Node and OS components. Their packaged notices remain in the image (including `/usr/share/doc/*/copyright` and Node's installation license). This npm audit does not enumerate every Debian package or replace the base-image license notices. We do not modify those system components. Microsoft Foundry/Azure and Google Fonts are external services governed by their own terms; their model/service internals are not npm dependencies and are not relicensed here.

No new license is imposed on the original application by this document. Public source access for judging does not itself grant an open-source license to the author's original work. Third-party rights and notices remain intact. This is a technical inventory and notice-completeness review, not an independent legal opinion or certification of every contributor's rights.
