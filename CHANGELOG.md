## [2.0.0](https://github.com/Lint-Free-Technology/lovelace-auto-entities/compare/v1.16.1...v2.0.0) (2026-02-11)

### ⭐ New Features

* **major:** Bump major version for first semantic-release ([11a66a4](https://github.com/Lint-Free-Technology/lovelace-auto-entities/commit/11a66a4049953fdb6e194d5eadfc8a05160b7744))

### 🐞 Bug Fixes

* Filter editor issues where rules may be cleared in various scenarios ([13f6235](https://github.com/Lint-Free-Technology/lovelace-auto-entities/commit/13f623586d45f1838ed0dac34990c3bc4445e5a8))

### 📔 Documentation

* Update readme to reflect fork as well as satisfy markdown linter. ([ad7a413](https://github.com/Lint-Free-Technology/lovelace-auto-entities/commit/ad7a413673091c4483bcb188ba1b407e02e24d22))
* Update README with information on choose selector in visual editor. ([64a04c2](https://github.com/Lint-Free-Technology/lovelace-auto-entities/commit/64a04c2cbcc90d7e79fd79ec4c731ce1355e91c7))
* Update README. Remove cspell directive in table which broke layout. ([76dd2b9](https://github.com/Lint-Free-Technology/lovelace-auto-entities/commit/76dd2b99cb5e68b1001ff6712f634a5383ddffd7))

### ⚙️ Miscellaneous

* Implement semantic-release ([fd90c4f](https://github.com/Lint-Free-Technology/lovelace-auto-entities/commit/fd90c4ff0453dd82a4d06340dfab75bc5b92fc18))
* Move build output to dist directory to prepare for semantic-release ([4d33a36](https://github.com/Lint-Free-Technology/lovelace-auto-entities/commit/4d33a367098c6918b1ac70726720148933051bce))
* Readjust minimum HACS version from 2026.2.0 back to 2026.1.1 ([7e05f14](https://github.com/Lint-Free-Technology/lovelace-auto-entities/commit/7e05f14fb3cc78d337aba33a614195ed9f372a98))
* Update minimum HACS version ([abce447](https://github.com/Lint-Free-Technology/lovelace-auto-entities/commit/abce447c799988f7078520964935248f7c89022b))

## [2.0.0-beta.1](https://github.com/Lint-Free-Technology/lovelace-auto-entities/compare/v1.16.1...v2.0.0-beta.1) (2026-02-11)

### ⭐ New Features

- Use new choose selector for filter pickers to allow for built in selector including migration of existing config

### 🐞 Bug Fixes

- Pass through layout parameter to have panel layout styling for card
- Invalidate cache for entities, devices, areas, labels, floors when config registry changes.
- Load card / else via hui-card
- card_as_row config to work as nested row in entities card
- Always show card preview (or else card if configured)
- Button updates
- Filter editor issues where rules may be cleared in various scenarios
- Ha tabs
- Fixup rule count in filter editor
- Migrate mwc-button to ha-button for HA 2025.8 mwc-button removal
- Split translated states to own filter 'state_translated'
- Update workaround for cards which show errors
- Performance improvements

### 📔 Documentation

* Update readme to reflect fork as well as satisfy markdown linter. ([ad7a413](https://github.com/Lint-Free-Technology/lovelace-auto-entities/commit/ad7a413673091c4483bcb188ba1b407e02e24d22))
* Update README with information on choose selector in visual editor. ([64a04c2](https://github.com/Lint-Free-Technology/lovelace-auto-entities/commit/64a04c2cbcc90d7e79fd79ec4c731ce1355e91c7))

### ⚙️ Miscellaneous

* Implement semantic-release ([fd90c4f](https://github.com/Lint-Free-Technology/lovelace-auto-entities/commit/fd90c4ff0453dd82a4d06340dfab75bc5b92fc18))
* Move build output to dist directory to prepare for semantic-release ([4d33a36](https://github.com/Lint-Free-Technology/lovelace-auto-entities/commit/4d33a367098c6918b1ac70726720148933051bce))
* Readjust minimum HACS version from 2026.2.0 back to 2026.1.1 ([7e05f14](https://github.com/Lint-Free-Technology/lovelace-auto-entities/commit/7e05f14fb3cc78d337aba33a614195ed9f372a98))
* Update minimum HACS version ([abce447](https://github.com/Lint-Free-Technology/lovelace-auto-entities/commit/abce447c799988f7078520964935248f7c89022b))
