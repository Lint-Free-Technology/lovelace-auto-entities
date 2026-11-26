import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const recordSeparator = "\x1e";
const fieldSeparator = "\x1f";
const githubNoReplyEmail = /^(?:\d+\+)?([a-z\d](?:[a-z\d-]{0,37}))@users\.noreply\.github\.com$/i;

function contributorFrom(name, email) {
  const login = githubNoReplyEmail.exec(email)?.[1];

  if (login && !login.endsWith("[bot]")) {
    return {
      key: `github:${login.toLowerCase()}`,
      text: `[@${login}](https://github.com/${login})`,
    };
  }
}

export function contributorsFromGitLog(log) {
  const contributors = new Map();
  const add = (name, email) => {
    const contributor = contributorFrom(name.trim(), email.trim());
    if (contributor) contributors.set(contributor.key, contributor.text);
  };

  for (const record of log.split(recordSeparator)) {
    if (!record.trim()) continue;

    const [name, email] = record.split(fieldSeparator);
    add(name, email);
  }

  return [...contributors.values()].sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" }),
  );
}

async function latestTag() {
  try {
    const { stdout } = await execFileAsync("git", [
      "describe",
      "--tags",
      "--abbrev=0",
      "HEAD",
    ]);
    return stdout.trim();
  } catch {
    return undefined;
  }
}

async function main() {
  const tag = await latestTag();
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const { stdout } = await execFileAsync("git", [
    "log",
    range,
    `--format=%an${fieldSeparator}%ae${recordSeparator}`,
  ]);
  const contributors = contributorsFromGitLog(stdout);
  const delimiter = randomUUID();

  process.stdout.write(
    `contributors<<${delimiter}\n${contributors.join(", ")}\n${delimiter}\n`,
  );
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
  await main();
}
