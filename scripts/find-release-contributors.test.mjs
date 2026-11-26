import assert from "node:assert/strict";
import test from "node:test";

import { contributorsFromGitLog } from "./find-release-contributors.mjs";

const recordSeparator = "\x1e";
const fieldSeparator = "\x1f";

test("finds unique human GitHub contributors", () => {
  const log = [
    `Alice${fieldSeparator}123+alice@users.noreply.github.com`,
    `Alice${fieldSeparator}123+alice@users.noreply.github.com`,
    `Bob${fieldSeparator}bob@example.com`,
    `dependabot[bot]${fieldSeparator}49699333+dependabot[bot]@users.noreply.github.com`,
    `Zed${fieldSeparator}zed@users.noreply.github.com`,
  ].join(recordSeparator);

  assert.deepEqual(contributorsFromGitLog(log), [
    "[@alice](https://github.com/alice)",
    "[@zed](https://github.com/zed)",
  ]);
});
