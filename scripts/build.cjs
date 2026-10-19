const esbuild = require('esbuild');
const fs = require('node:fs');
const options = {
  entryPoints: ['src/extension.ts'], bundle: true, platform: 'node', format: 'cjs',
  target: 'node20', external: ['vscode'], outfile: 'dist/extension.js',
  sourcemap: true, minify: !process.argv.includes('--watch'), logLevel: 'info',
  legalComments: 'eof'
};
(async () => {
  if (process.argv.includes('--watch')) await (await esbuild.context(options)).watch();
  else await esbuild.build(options);
  fs.writeFileSync('THIRD_PARTY_NOTICES.txt', [
    'Workspace TODOs bundles the following open-source libraries:\n',
    'TypeScript (Microsoft) — Apache-2.0\n' + fs.readFileSync('node_modules/typescript/LICENSE.txt', 'utf8'),
    '\nminimatch, brace-expansion, balanced-match and ignore — ISC / MIT\n',
    ...['minimatch', 'brace-expansion', 'balanced-match', 'ignore'].map(name => {
      const dir = require('node:path').dirname(require.resolve(name + '/package.json'));
      const license = fs.readdirSync(dir).find(file => /^licen[sc]e/i.test(file));
      return name + '\n' + (license ? fs.readFileSync(require('node:path').join(dir, license), 'utf8') : 'See package license.');
    })
  ].join('\n').replace(/\r\n/g, '\n').replace(/[\t ]+$/gm, ''));
})().catch(error => { console.error(error); process.exitCode = 1; });
