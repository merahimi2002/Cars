# Local showroom assets

All runtime assets are served locally; the showroom makes no CDN requests.

The generated `models/*.local.js` scripts contain Base64 copies of the same GLB files for opening index.html directly. `../js/showroom.standalone.js` bundles the local showroom and Three.js modules; their licenses and model attributions below apply equally to these generated copies. `../js/vendor/draco/local-decoder.js` embeds the same local Draco JS and WASM decoder.

## Car model

- File: `models/huracan.glb` (19,499,428 bytes, 19 embedded images).
- Download: https://raw.githubusercontent.com/LorenzoDoremi/Configuratore_Lambo/main/static/ferrari.glb
- Source: https://github.com/LorenzoDoremi/Configuratore_Lambo
- Despite the upstream filename, this is a Lamborghini Huracán Spyder. The source README describes it as a free Huracán model downloaded from Sketchfab. The source does not identify the original author or state an asset license. Retained for the local prototype; obtain the original asset's license or replace it with a model with explicit redistribution rights before public release.
- Runtime changes: normalized orientation and scale; configurable paint, glass, rims and headlight materials. Model file is unmodified.

## Additional car models

- `models/ferrari-458.glb`: Ferrari 458 Italia by vicent091036, distributed in the official Three.js r169 car-materials example. Original attribution: https://sketchfab.com/models/57bf6cc56931426e87494f554df1dab6 . Download: https://raw.githubusercontent.com/mrdoob/three.js/r169/examples/models/gltf/ferrari.glb . The original model listing is currently unavailable; no separate asset license is asserted here.
- `models/bmw-m4.glb`: BMW M4 Competition M Package by SRT Performance (https://sketchfab.com/TheRealSRT), CC BY 4.0, https://creativecommons.org/licenses/by/4.0/ . Original: https://skfb.ly/oyM8P . Download mirror: https://github.com/coopercodes/bmwGLB . Author, title, source and license are embedded in the GLB asset metadata. Runtime changes: orientation/scale normalized and paint materials replaced; the model file is unmodified.
- Local Draco decoder files in `../js/vendor/draco/` are from the Three.js 0.169.0 package. Draco is Copyright Google, Apache License 2.0, https://github.com/google/draco/blob/main/LICENSE . DRACOLoader uses the Three.js MIT license.

## Photographs

- `../Image/cars/huracan-spyder.webp`: Matti Blume, *Lamborghini Huracan Evo Spyder, GIMS 2019, Le Grand-Saconnex (GIMS0852)*.
  Source: https://commons.wikimedia.org/wiki/File:Lamborghini_Huracan_Evo_Spyder,_GIMS_2019,_Le_Grand-Saconnex_(GIMS0852).jpg
  License: CC BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/ . Resized to 1600 px and converted to WebP; the resulting image retains the same license. Visible attribution is in the page asset credits.
- These reference photographs show the EVO Spyder; the interactive model is an earlier Huracán Spyder.

## Renderer

Three.js 0.169.0 and its GLTFLoader, OrbitControls, BufferGeometryUtils and RoomEnvironment modules are vendored in `../js/vendor/`. MIT license is included in `../js/vendor/THREE-LICENSE.txt`. Imports point to local files.

## Scroll story specifications

- Huracán LP 610-4 Spyder: 610 metric hp, 0–100 km/h in 3.4 s, top speed 324 km/h. Manufacturer: https://preowned.lamborghini.com/models/huracan-spyder .
- Ferrari 458 Italia: 570 CV, 0–100 km/h in under 3.4 s, top speed 325 km/h. Manufacturer: https://www.ferrari.com/en-GQ/history/moments/2009/benchmark-car/more and https://cdn.ferrari.com/cms/network/media/pdf/12_prospectus_ferrari_n_v_eu_20160103.pdf .
- BMW M4 Competition G82, original rear-wheel-drive specification: 510 PS, 0–100 km/h in 3.9 s, electronically limited 250 km/h (155 mph). Manufacturer: https://www.press.bmwgroup.com/united-kingdom/article/detail/T0316947EN_GB/the-new-bmw-m3-competition-saloon-and-bmw-m4-competition-coup%C3%A9 .
- The story reuses the active local 3D model and its paint; it downloads no additional vehicle assets. Descriptions concern visible design details. The specific variant is shown beside the figures.

## Paint palettes

Factory colour names are used for each car's six selected presets. Hex values are approximate RGB previews, not manufacturer colour measurements; showroom lighting and screen calibration change their appearance. The custom colour picker is separate from the factory presets.

- Lamborghini: manufacturer configurator colour catalogue, https://configurator.lamborghini.com/ (Rosso Mars, Giallo Inti, Verde Mantis, Arancio Borealis, Bianco Monocerus, Nero Noctis).
- Ferrari: 458 Italia factory personalisation catalogue, https://axisofoversteer.com/blog/documents/458Italia.pdf ; Ferrari Approved inventory, https://preowned.ferrari.com/ .
- BMW: original M4 Competition launch and paint choices, https://www.press.bmwgroup.com/united-kingdom/article/detail/T0316947EN_GB/the-new-bmw-m3-competition-saloon-and-bmw-m4-competition-coup%C3%A9 ; M4 colour brochure, https://www.bmw.in/content/dam/bmw/marketIN/bmw_in/brochure%20download/brochureupload/2022/PR73028_INR-CWW-BMW_NSC_M4CompetitionMxDriveBrochure_Jan22_1_6.pdf.asset.1644560380169.pdf .

## Design reference

Horizon Hero Section by scott clayton: https://21st.dev/@lovesickfromthe6ix/components/horizon-hero-section . Used as visual direction; the showroom implementation is original and stays buildless HTML/CSS/JavaScript.
