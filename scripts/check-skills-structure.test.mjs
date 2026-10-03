import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkSkillsStructure } from './check-skills-structure.mjs';

const script = fileURLToPath(new URL('./check-skills-structure.mjs', import.meta.url));
const repo = join(dirname(fileURLToPath(import.meta.url)), '..');

const claude = `# fixture

- \`engineering/\` — promoted
- \`misc/\` — 保留但不推广
`;

const plugin = `{
  "skills": ["./skills/engineering/"]
}
`;

const topReadme = `# Fixture

## User-invoked

- [alpha](skills/engineering/alpha/SKILL.md)

## Model-invoked

- [beta](skills/engineering/beta/SKILL.md)
`;

const engineeringReadme = `# Engineering

## User-invoked

- [alpha](./alpha/SKILL.md)

## Model-invoked

- [beta](./beta/SKILL.md)
`;

const miscReadme = `# Misc

- [gamma](./gamma/SKILL.md)
`;

function skillFile(disable) {
  const flag = disable ? 'disable-model-invocation: true\n' : '';
  return `---\nname: fixture\ndescription: fixture\n${flag}---\n\n# Fixture\n`;
}

function baseFiles() {
  return {
    'CLAUDE.md': claude,
    '.claude-plugin/plugin.json': plugin,
    'README.md': topReadme,
    'skills/engineering/README.md': engineeringReadme,
    'skills/engineering/alpha/SKILL.md': skillFile(true),
    'skills/engineering/beta/SKILL.md': skillFile(false),
    'skills/misc/README.md': miscReadme,
    'skills/misc/gamma/SKILL.md': skillFile(true),
  };
}

function writeFixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'skills-structure-'));
  for (const [rel, body] of Object.entries(files)) {
    const path = join(root, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
  }
  return root;
}

function errorsFor(files) {
  const root = writeFixture(files);
  try {
    return checkSkillsStructure(root).errors;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('good fixture and this repository pass', () => {
  assert.deepEqual(errorsFor(baseFiles()), []);
  assert.deepEqual(checkSkillsStructure(repo).errors, []);
});

test('indented top-level invocation flags are checked without reading block scalar content', () => {
  const indent = (body) => body.split('\n').map((line) => line && line !== '---' ? `  ${line}` : line).join('\n');
  assert.deepEqual(errorsFor({
    ...baseFiles(),
    'skills/engineering/alpha/SKILL.md': indent(skillFile(true)),
    'skills/engineering/beta/SKILL.md': indent(skillFile(false)),
  }), []);
  const invalid = indent(skillFile(false).replace('description: fixture\n', 'description: fixture\ndisable-model-invocation: false\n'));
  assert.ok(errorsFor({
    ...baseFiles(),
    'skills/engineering/beta/SKILL.md': invalid,
  }).some((error) => error.includes('disable-model-invocation must be omitted or true')));
  const block = skillFile(false).replace('description: fixture\n', 'description: |\n  disable-model-invocation: false\n');
  for (const body of [block, indent(block)]) {
    assert.deepEqual(errorsFor({
      ...baseFiles(),
      'skills/engineering/beta/SKILL.md': body,
    }), []);
  }
});

test('invocation group is the innermost heading, not an outer catalog heading', () => {
  const nested = `# Fixture

## Skills

### User-invoked

- [alpha](skills/engineering/alpha/SKILL.md)

### Model-invoked

- [beta](skills/engineering/beta/SKILL.md)
`;
  const nestedBucket = `# Engineering

## Catalog

### User-invoked

- [alpha](./alpha/SKILL.md)

### Model-invoked

- [beta](./beta/SKILL.md)
`;
  assert.deepEqual(errorsFor({
    ...baseFiles(),
    'README.md': nested,
    'skills/engineering/README.md': nestedBucket,
  }), []);
});

test('bad fixtures fail', () => {
  const cases = [
    {
      name: 'missing readme entry',
      files: {
        ...baseFiles(),
        'skills/engineering/README.md': engineeringReadme.replace('- [beta](./beta/SKILL.md)\n', ''),
      },
      includes: 'engineering/beta: bucket README does not link SKILL.md',
    },
    {
      name: 'broken link',
      files: {
        ...baseFiles(),
        'skills/engineering/README.md': engineeringReadme.replace('./beta/SKILL.md', './missing/SKILL.md'),
      },
      includes: 'unresolved skill link',
    },
    {
      name: 'wrong invocation group',
      files: {
        ...baseFiles(),
        'README.md': topReadme.replace(
          '## Model-invoked\n\n- [beta](skills/engineering/beta/SKILL.md)\n',
          '## Model-invoked\n\n- [alpha](skills/engineering/alpha/SKILL.md)\n',
        ).replace('- [alpha](skills/engineering/alpha/SKILL.md)\n', '- [beta](skills/engineering/beta/SKILL.md)\n'),
      },
      includes: 'expected User-invoked',
    },
    {
      name: 'illegal invocation flag',
      files: {
        ...baseFiles(),
        'skills/engineering/beta/SKILL.md': skillFile(false).replace(
          'description: fixture\n',
          'description: fixture\ndisable-model-invocation: false\n',
        ),
      },
      includes: 'disable-model-invocation must be omitted or true',
    },
    {
      name: 'quoted invocation key is still a key',
      files: {
        ...baseFiles(),
        'skills/engineering/beta/SKILL.md': skillFile(false).replace(
          'description: fixture\n',
          'description: fixture\n"disable-model-invocation": false\n',
        ),
      },
      includes: 'disable-model-invocation must be omitted or true',
    },
    {
      name: 'catalog link only inside a fence',
      files: {
        ...baseFiles(),
        'skills/engineering/README.md': `# Engineering

## User-invoked

- [alpha](./alpha/SKILL.md)

## Model-invoked

\`\`\`md
- [beta](./beta/SKILL.md)
\`\`\`
`,
      },
      includes: 'engineering/beta: bucket README does not link SKILL.md',
    },
    {
      name: 'catalog link only inside an html comment',
      files: {
        ...baseFiles(),
        'README.md': topReadme.replace(
          '- [beta](skills/engineering/beta/SKILL.md)\n',
          '<!-- - [beta](skills/engineering/beta/SKILL.md) -->\n',
        ),
      },
      includes: 'engineering/beta: top README does not link SKILL.md',
    },
    {
      name: 'misc uses invocation headings',
      files: {
        ...baseFiles(),
        'skills/misc/README.md': `# Misc\n\n## User-invoked\n\n- [gamma](./gamma/SKILL.md)\n`,
      },
      includes: 'invocation headings are not allowed',
    },
    {
      name: 'top readme promotes misc',
      files: {
        ...baseFiles(),
        'README.md': `${topReadme}\n- [gamma](skills/misc/gamma/SKILL.md)\n`,
      },
      includes: 'README.md links non-promoted skill misc/gamma',
    },
    {
      name: 'plugin omits a promoted bucket',
      files: {
        ...baseFiles(),
        '.claude-plugin/plugin.json': `{ "skills": [] }\n`,
      },
      includes: 'CLAUDE.md promoted buckets [engineering] != plugin.json skills []',
    },
    {
      name: 'plugin includes misc',
      files: {
        ...baseFiles(),
        '.claude-plugin/plugin.json': `{ "skills": ["./skills/engineering/", "./skills/misc/"] }\n`,
      },
      includes: 'plugin.json includes non-promoted bucket misc',
    },
    {
      name: 'duplicate catalog link',
      files: {
        ...baseFiles(),
        'README.md': topReadme.replace(
          '- [beta](skills/engineering/beta/SKILL.md)\n',
          '- [beta](skills/engineering/beta/SKILL.md)\n- [beta](skills/engineering/beta/SKILL.md)\n',
        ),
      },
      includes: 'engineering/beta: top README links SKILL.md 2 times',
    },
    {
      name: 'duplicate plugin bucket',
      files: {
        ...baseFiles(),
        '.claude-plugin/plugin.json': `{ "skills": ["./skills/engineering/", "./skills/engineering/"] }\n`,
      },
      includes: 'plugin.json lists engineering more than once',
    },
    {
      name: 'duplicate invocation flag',
      files: {
        ...baseFiles(),
        'skills/engineering/alpha/SKILL.md': skillFile(true).replace(
          'disable-model-invocation: true\n',
          'disable-model-invocation: true\ndisable-model-invocation: true\n',
        ),
      },
      includes: 'disable-model-invocation appears more than once',
    },
    {
      name: 'unregistered bucket',
      files: {
        ...baseFiles(),
        'skills/other/delta/SKILL.md': skillFile(false),
      },
      includes: 'skills/other is not listed in a CLAUDE.md bucket bullet',
    },
    {
      name: 'wrong link text',
      files: {
        ...baseFiles(),
        'skills/engineering/README.md': engineeringReadme.replace('[beta]', '[not-beta]'),
      },
      includes: 'engineering/beta: bucket README link text "not-beta" != skill name',
    },
    {
      name: 'cross bucket link',
      files: {
        ...baseFiles(),
        'skills/engineering/README.md': engineeringReadme.replace('./beta/SKILL.md', '../misc/gamma/SKILL.md'),
      },
      includes: 'resolves outside engineering: misc/gamma',
    },
  ];

  for (const item of cases) {
    const errors = errorsFor(item.files);
    assert.equal(errors.some((error) => error.includes(item.includes)), true, item.name);
  }
});

test('absolute, scheme, and protocol-relative hrefs do not count', () => {
  const root = writeFixture(baseFiles());
  try {
    const target = join(root, 'skills/engineering/beta/SKILL.md');
    const hrefs = [target, `file://${target}`, `//example.test${target}`, `%2F${target.slice(1)}`];
    for (const href of hrefs) {
      writeFileSync(join(root, 'README.md'), topReadme.replace('(skills/engineering/beta/SKILL.md)', `(${href})`));
      const errors = checkSkillsStructure(root).errors;
      assert.equal(errors.some((error) => error.includes('unresolved skill link')), true, href);
      assert.equal(errors.some((error) => error.includes('engineering/beta: top README does not link SKILL.md')), true, href);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a nested SKILL.md is not another skill', () => {
  assert.deepEqual(errorsFor({
    ...baseFiles(),
    'skills/engineering/alpha/nested/SKILL.md': skillFile(false),
  }), []);
});

test('cli exits 0 for this repository', () => {
  const output = execFileSync(process.execPath, [script], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.match(output, /skills structure ok/);
});

test('cli exits 1 for a bad fixture', () => {
  const root = writeFixture({
    ...baseFiles(),
    'skills/engineering/alpha/SKILL.md': skillFile(false).replace(
      'description: fixture\n',
      'description: fixture\ndisable-model-invocation: false\n',
    ),
  });
  try {
    assert.throws(
      () => execFileSync(process.execPath, [script, '--root', root], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
      (error) => error.status === 1 && String(error.stderr).includes('disable-model-invocation must be omitted or true'),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
