const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('../.build-tools/node_modules/esbuild');
const root = path.resolve(__dirname, '..');

(async () => {
    await esbuild.build({
        entryPoints: [path.join(root, 'js/showroom.js')],
        outfile: path.join(root, 'js/showroom.standalone.js'),
        bundle: true, format: 'iife', target: 'es2020', minify: true,
        legalComments: 'eof'
    });
    for (const [id, filename] of Object.entries({ huracan: 'huracan.glb', ferrari: 'ferrari-458.glb', bmw: 'bmw-m4.glb' })) {
        const base64 = fs.readFileSync(path.join(root, 'assets/models', filename)).toString('base64');
        const output = 'window.CarsLocalAssets=window.CarsLocalAssets||{models:{}};window.CarsLocalAssets.models[' + JSON.stringify(id) + ']=' + JSON.stringify(base64) + ';\n';
        fs.writeFileSync(path.join(root, 'assets/models', id + '.local.js'), output);
    }
    const decoder = {
        js: fs.readFileSync(path.join(root, 'js/vendor/draco/draco_wasm_wrapper.js'), 'utf8'),
        wasm: fs.readFileSync(path.join(root, 'js/vendor/draco/draco_decoder.wasm')).toString('base64')
    };
    fs.writeFileSync(path.join(root, 'js/vendor/draco/local-decoder.js'), 'window.CarsLocalDecoder=' + JSON.stringify(decoder) + ';\n');
    console.log('Built classic showroom bundle, three local model scripts, and embedded Draco decoder.');
})().catch(error => { console.error(error); process.exitCode = 1; });
