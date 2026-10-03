#!/usr/bin/env node
// Mechanical skill-structure check for the rules in CLAUDE.md.
// Interpretation lives in .agents/notes/skills-hardening-implementation-notes.md.
// Default root is this repo. --root is for tests.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const USER = "User-invoked";
const MODEL = "Model-invoked";
const GROUPS = [USER, MODEL];

export function checkSkillsStructure(repoRoot) {
  const repo = resolve(repoRoot);
  const errors = [];

  const claudePath = join(repo, "CLAUDE.md");
  const pluginPath = join(repo, ".claude-plugin", "plugin.json");
  const topReadmePath = join(repo, "README.md");
  const claude = readText(claudePath, errors, repo);
  const pluginText = readText(pluginPath, errors, repo);
  const topReadme = readText(topReadmePath, errors, repo);
  if (claude === null || pluginText === null || topReadme === null) {
    return finish(errors);
  }

  const classified = classifyClaudeBuckets(claude, errors);
  const pluginBuckets = pluginSkillBuckets(pluginText, errors);
  if (classified && pluginBuckets) {
    const promoted = [...classified.promoted].sort();
    const fromPlugin = [...pluginBuckets].sort();
    if (promoted.join("\0") !== fromPlugin.join("\0")) {
      errors.push(
        `CLAUDE.md promoted buckets [${promoted.join(", ")}] != plugin.json skills [${fromPlugin.join(", ")}]`,
      );
    }
    for (const bucket of classified.unpromoted) {
      if (pluginBuckets.has(bucket)) {
        errors.push(`plugin.json includes non-promoted bucket ${bucket}`);
      }
    }
  }

  const onDisk = skillBucketsOnDisk(join(repo, "skills"));
  if (classified) {
    const known = new Set([...classified.promoted, ...classified.unpromoted]);
    for (const bucket of onDisk) {
      if (!known.has(bucket)) {
        errors.push(`skills/${bucket} is not listed in a CLAUDE.md bucket bullet`);
      }
    }
    for (const bucket of known) {
      if (!existsSync(join(repo, "skills", bucket))) {
        errors.push(`CLAUDE.md lists skills/${bucket} but the directory is missing`);
      }
    }
  }

  const skills = [];
  for (const bucket of onDisk) {
    for (const name of listSkills(join(repo, "skills", bucket))) {
      const skill = inspectSkill(repo, bucket, name, errors);
      skills.push(skill);
    }
  }

  if (classified) {
    for (const bucket of classified.promoted) {
      checkGroupedReadme({
        repo,
        errors,
        readmePath: join(repo, "skills", bucket, "README.md"),
        label: `skills/${bucket}/README.md`,
        bucket,
        skills: skills.filter((skill) => skill.bucket === bucket),
      });
    }
    for (const bucket of classified.unpromoted) {
      checkFlatReadme({
        repo,
        errors,
        readmePath: join(repo, "skills", bucket, "README.md"),
        label: `skills/${bucket}/README.md`,
        bucket,
        skills: skills.filter((skill) => skill.bucket === bucket),
      });
    }
    checkGroupedReadme({
      repo,
      errors,
      readmePath: topReadmePath,
      label: "README.md",
      bucket: null,
      skills: skills.filter((skill) => classified.promoted.has(skill.bucket)),
    });
    const promotedIds = new Set(
      skills.filter((skill) => classified.promoted.has(skill.bucket)).map((skill) => skill.id),
    );
    for (const link of skillLinks(topReadme, topReadmePath, repo)) {
      if (!link.skill || promotedIds.has(link.skill.id)) continue;
      if (classified.unpromoted.has(link.skill.bucket)) {
        errors.push(`README.md links non-promoted skill ${link.skill.id}`);
      }
    }
  }

  return finish(errors);
}

function finish(errors) {
  const unique = [...new Set(errors)].sort();
  return { ok: unique.length === 0, errors: unique };
}

function readText(path, errors, repo) {
  if (!existsSync(path)) {
    errors.push(`missing ${display(repo, path)}`);
    return null;
  }
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

function classifyClaudeBuckets(claude, errors) {
  const promoted = new Set();
  const unpromoted = new Set();
  for (const line of claude.split("\n")) {
    const match = line.match(/^- `([^`]+)\/`/);
    if (!match) continue;
    const bucket = match[1];
    if (bucket.includes("/") || promoted.has(bucket) || unpromoted.has(bucket)) {
      errors.push(`CLAUDE.md bucket bullet ${bucket} is duplicate or not a single directory`);
      continue;
    }
    if (line.includes("不推广")) unpromoted.add(bucket);
    else promoted.add(bucket);
  }
  if (promoted.size + unpromoted.size === 0) {
    errors.push("CLAUDE.md has no bucket bullets");
    return null;
  }
  return { promoted, unpromoted };
}

function pluginSkillBuckets(pluginText, errors) {
  let plugin;
  try {
    plugin = JSON.parse(pluginText);
  } catch {
    errors.push("plugin.json is not valid JSON");
    return null;
  }
  if (!Array.isArray(plugin.skills)) {
    errors.push("plugin.json skills is not an array");
    return null;
  }
  const buckets = new Set();
  for (const entry of plugin.skills) {
    const normalized = String(entry).replace(/^\.\//, "").replace(/\/+$/, "");
    const match = normalized.match(/^skills\/([^/]+)$/);
    if (!match) {
      errors.push(`plugin.json skills entry is not a bucket path: ${entry}`);
      continue;
    }
    if (buckets.has(match[1])) errors.push(`plugin.json lists ${match[1]} more than once`);
    buckets.add(match[1]);
  }
  return buckets;
}

function skillBucketsOnDisk(skillsDir) {
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .filter((name) => listSkills(join(skillsDir, name)).length > 0)
    .sort();
}

function listSkills(bucketPath) {
  if (!existsSync(bucketPath)) return [];
  return readdirSync(bucketPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .filter((name) => isFile(join(bucketPath, name, "SKILL.md")))
    .sort();
}

function inspectSkill(repo, bucket, name, errors) {
  const id = `${bucket}/${name}`;
  const text = readFileSync(join(repo, "skills", bucket, name, "SKILL.md"), "utf8").replace(/\r\n/g, "\n");
  const frontmatter = splitFrontmatter(text);
  let group = null;
  if (frontmatter === null) {
    errors.push(`${id}: SKILL.md has no frontmatter`);
  } else {
    // YAML mappings may indent all top-level keys. Deeper lines belong to
    // nested values (including description block scalars), not skill flags.
    const lines = frontmatter.split("\n").filter((line) => line.trim() && !line.trimStart().startsWith("#"));
    const indentation = Math.min(...lines.map((line) => line.match(/^ */)[0].length));
    const keys = lines
      .filter((line) => line.match(/^ */)[0].length === indentation)
      .map((line) => line.slice(indentation))
      .filter((line) => invocationKey(line));
    if (keys.length > 1) {
      errors.push(`${id}: disable-model-invocation appears more than once`);
    } else if (keys.length === 0) {
      group = MODEL;
    } else {
      const value = keys[0].slice(keys[0].indexOf(":") + 1).trim();
      if (value !== "true") {
        errors.push(`${id}: disable-model-invocation must be omitted or true`);
      } else {
        group = USER;
      }
    }
  }
  return { id, bucket, name, group };
}

function invocationKey(line) {
  return /^(?:"disable-model-invocation"|'disable-model-invocation'|disable-model-invocation)\s*:/.test(line);
}

function splitFrontmatter(text) {
  if (!text.startsWith("---\n")) return null;
  const match = text.slice(4).match(/\n---(?:\n|$)/);
  if (!match) return null;
  return text.slice(4, 4 + match.index);
}

function checkGroupedReadme({ repo, errors, readmePath, label, bucket, skills }) {
  const raw = readText(readmePath, errors, repo);
  if (raw === null) return;
  const text = visibleMarkdown(raw);
  const sections = headingSections(text);
  for (const title of GROUPS) {
    const found = sections.filter((section) => section.title === title);
    if (found.length === 0) errors.push(`${label}: missing heading "${title}"`);
    if (found.length > 1) errors.push(`${label}: duplicate heading "${title}"`);
  }
  const links = skillLinks(text, readmePath, repo);
  const byId = new Map();
  for (const link of links) {
    if (!link.skill) {
      errors.push(`${label}: unresolved skill link ${link.href}`);
      continue;
    }
    if (bucket && link.skill.bucket !== bucket) {
      errors.push(`${label}: skill link resolves outside ${bucket}: ${link.skill.id}`);
      continue;
    }
    const row = byId.get(link.skill.id) ?? { user: 0, model: 0, other: 0, texts: [] };
    row.texts.push(link.text);
    if (link.group === USER) row.user += 1;
    else if (link.group === MODEL) row.model += 1;
    else row.other += 1;
    byId.set(link.skill.id, row);
  }
  for (const skill of skills) {
    const row = byId.get(skill.id);
    const where = bucket ? "bucket README" : "top README";
    if (!row) {
      errors.push(`${skill.id}: ${where} does not link SKILL.md`);
      continue;
    }
    const count = row.user + row.model + row.other;
    if (count !== 1) errors.push(`${skill.id}: ${where} links SKILL.md ${count} times`);
    for (const text of row.texts) {
      if (text !== skill.name) {
        errors.push(`${skill.id}: ${where} link text "${text}" != skill name`);
      }
    }
    if (skill.group && count === 1) {
      let actual = "outside invocation headings";
      if (row.user === 1) actual = USER;
      else if (row.model === 1) actual = MODEL;
      if (actual !== skill.group) {
        errors.push(`${skill.id}: ${where} lists it under ${actual}, expected ${skill.group}`);
      }
    }
    byId.delete(skill.id);
  }
  for (const id of byId.keys()) {
    if (!bucket || id.startsWith(`${bucket}/`)) {
      errors.push(`${label}: links unknown skill ${id}`);
    }
  }
}

function checkFlatReadme({ repo, errors, readmePath, label, bucket, skills }) {
  const raw = readText(readmePath, errors, repo);
  if (raw === null) return;
  const text = visibleMarkdown(raw);
  const titles = headingSections(text).map((section) => section.title);
  for (const title of GROUPS) {
    if (titles.includes(title)) {
      errors.push(`${label}: invocation headings are not allowed; non-promoted bucket list is flat`);
    }
  }
  const byId = new Map();
  for (const link of skillLinks(text, readmePath, repo)) {
    if (!link.skill) {
      errors.push(`${label}: unresolved skill link ${link.href}`);
      continue;
    }
    if (link.skill.bucket !== bucket) {
      errors.push(`${label}: skill link resolves outside ${bucket}: ${link.skill.id}`);
      continue;
    }
    const row = byId.get(link.skill.id) ?? { count: 0, texts: [] };
    row.count += 1;
    row.texts.push(link.text);
    byId.set(link.skill.id, row);
  }
  for (const skill of skills) {
    const row = byId.get(skill.id);
    if (!row) {
      errors.push(`${skill.id}: bucket README does not link SKILL.md`);
      continue;
    }
    if (row.count !== 1) errors.push(`${skill.id}: bucket README links SKILL.md ${row.count} times`);
    for (const text of row.texts) {
      if (text !== skill.name) errors.push(`${skill.id}: bucket README link text "${text}" != skill name`);
    }
    byId.delete(skill.id);
  }
}

function visibleMarkdown(text) {
  const lines = text.split("\n");
  let fence = null;
  let comment = false;
  return lines.map((line) => {
    if (fence) {
      const close = line.trimStart();
      if (close.startsWith(fence.char.repeat(fence.length)) && !close.slice(fence.length).trim()) fence = null;
      return "";
    }
    let rest = line;
    let visible = "";
    if (comment) {
      const end = rest.indexOf("-->");
      if (end === -1) return "";
      comment = false;
      rest = rest.slice(end + 3);
    }
    while (rest.includes("<!--")) {
      const start = rest.indexOf("<!--");
      visible += rest.slice(0, start);
      const end = rest.indexOf("-->", start + 4);
      if (end === -1) {
        comment = true;
        rest = "";
        break;
      }
      rest = rest.slice(end + 3);
    }
    visible += rest;
    const open = /^(?: {0,3})(`{3,}|~{3,})/.exec(visible);
    if (open) {
      fence = { char: open[1][0], length: open[1].length };
      return "";
    }
    return visible;
  }).join("\n");
}

function headingSections(text) {
  const lines = text.split("\n");
  const headings = [];
  lines.forEach((line, index) => {
    const match = /^(#{1,6})[ \t]+(.*?)[ \t]*$/.exec(line);
    if (match) headings.push({ level: match[1].length, title: match[2].trim(), line: index });
  });
  return headings.map((heading, index) => {
    let end = lines.length;
    for (let cursor = index + 1; cursor < headings.length; cursor += 1) {
      if (headings[cursor].level <= heading.level) {
        end = headings[cursor].line;
        break;
      }
    }
    return { title: heading.title, start: heading.line + 1, end };
  });
}

function skillLinks(text, readmePath, repo) {
  const sections = headingSections(text);
  const links = [];
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    for (const match of line.matchAll(/(!?)\[([^\]]+)\]\(([^)\s]+)\)/g)) {
      if (match[1] === "!") continue;
      const href = match[3];
      const pathOnly = href.split("#")[0].split("?")[0];
      if (!(pathOnly.endsWith("/SKILL.md") || pathOnly === "SKILL.md")) continue;
      const section = sections.filter((item) => index >= item.start && index < item.end).at(-1);
      links.push({
        href,
        text: match[2].replace(/[*_`]/g, "").trim(),
        group: section && GROUPS.includes(section.title) ? section.title : null,
        skill: resolveSkillLink(readmePath, pathOnly, repo),
      });
    }
  });
  return links;
}

function resolveSkillLink(readmePath, href, repo) {
  let decoded = href;
  try {
    decoded = decodeURIComponent(href);
  } catch {
    return null;
  }
  if (!isRepoRelativeHref(href) || !isRepoRelativeHref(decoded)) return null;
  const absolute = resolve(dirname(readmePath), decoded);
  const rel = relative(repo, absolute).split(sep).join("/");
  if (rel.startsWith("..") || isAbsolute(rel)) return null;
  const match = rel.match(/^skills\/([^/]+)\/([^/]+)\/SKILL\.md$/);
  if (!match || !isFile(absolute)) return null;
  return { bucket: match[1], name: match[2], id: `${match[1]}/${match[2]}` };
}

function isRepoRelativeHref(href) {
  if (href.startsWith("/") || href.startsWith("\\")) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return false;
  return true;
}

function isFile(path) {
  return existsSync(path) && statSync(path).isFile();
}

function display(repo, path) {
  return relative(repo, path).split(sep).join("/") || path;
}

function repoFromArgv(argv) {
  const flag = argv.indexOf("--root");
  if (flag === -1) return join(dirname(fileURLToPath(import.meta.url)), "..");
  const value = argv[flag + 1];
  if (!value) {
    console.error("--root requires a directory");
    process.exit(1);
  }
  return resolve(value);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) {
  const report = checkSkillsStructure(repoFromArgv(process.argv));
  if (!report.ok) {
    for (const error of report.errors) console.error(error);
    process.exit(1);
  }
  console.log("skills structure ok");
}
