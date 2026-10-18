# Local showroom assets

All runtime assets are served locally; the showroom makes no CDN requests.

## Lossless asset optimization (2026-10-18)

Huracán, BMW, Porsche and Nissan GLBs were repacked with lossless Meshopt compression and byte-identical payload deduplication. Selected embedded textures were converted to lossless WebP only when every decoded RGBA pixel and the full image dimensions matched the source exactly and the encoded file was smaller. Geometry attributes, triangle winding, transforms, material factors, texture bindings and samplers were checked against the originals. No mesh simplification, new quantization, texture resizing or lossy image encoding was applied. Ferrari's existing Draco-compressed GLB is unchanged. Embedded author/source/license metadata and all original licenses are retained, including Porsche's CC BY-SA 4.0. Base64 counterparts contain these same optimized GLBs. See `../docs/model-optimization.md` and `../docs/model-optimization.json` for sizes, hashes and verification details.

The generated `models/*.local.js` scripts contain Base64 copies of the same GLB files for opening index.html directly. `../js/showroom.standalone.js` bundles the local showroom and Three.js modules; their licenses and model attributions below apply equally to these generated copies. `../js/vendor/draco/local-decoder.js` embeds the same local Draco JS and WASM decoder.

## Car model

- File: `models/huracan.glb` (15,859,784 bytes, 19 embedded images; upstream original: 19,499,428 bytes).
- Download: https://raw.githubusercontent.com/LorenzoDoremi/Configuratore_Lambo/main/static/ferrari.glb
- Source: https://github.com/LorenzoDoremi/Configuratore_Lambo
- Despite the upstream filename, this is a Lamborghini Huracán Spyder. The source README describes it as a free Huracán model downloaded from Sketchfab. The source does not identify the original author or state an asset license. Retained for the local prototype; obtain the original asset's license or replace it with a model with explicit redistribution rights before public release.
- Runtime changes: normalized orientation and scale; configurable paint, glass, rims and headlight materials. File losslessly repacked; see the optimization section below.

## Additional car models

- `models/ferrari-458.glb`: Ferrari 458 Italia by vicent091036, distributed in the official Three.js r169 car-materials example. Original attribution: https://sketchfab.com/models/57bf6cc56931426e87494f554df1dab6 . Download: https://raw.githubusercontent.com/mrdoob/three.js/r169/examples/models/gltf/ferrari.glb . The original model listing is currently unavailable; no separate asset license is asserted here.
- `models/bmw-m4.glb`: BMW M4 Competition M Package by SRT Performance (https://sketchfab.com/TheRealSRT), CC BY 4.0, https://creativecommons.org/licenses/by/4.0/ . Original: https://skfb.ly/oyM8P . Download mirror: https://github.com/coopercodes/bmwGLB . Author, title, source and license are embedded in the GLB asset metadata. Runtime changes: orientation/scale normalized and paint materials replaced; the file is losslessly repacked; see below.
- Local Draco decoder files in `../js/vendor/draco/` are from the Three.js 0.169.0 package. Draco is Copyright Google, Apache License 2.0, https://github.com/google/draco/blob/main/LICENSE . DRACOLoader uses the Three.js MIT license.

## Photographs

- `../Image/cars/huracan-spyder.webp`: Matti Blume, *Lamborghini Huracan Evo Spyder, GIMS 2019, Le Grand-Saconnex (GIMS0852)*.
  Source: https://commons.wikimedia.org/wiki/File:Lamborghini_Huracan_Evo_Spyder,_GIMS_2019,_Le_Grand-Saconnex_(GIMS0852).jpg
  License: CC BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/ . Resized to 1600 px and converted to WebP; the resulting image retains the same license. Attribution and source links are retained in this document.
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

## Footer architectural background
- File: `footer-pavilion.webp` (local optimized WebP, 194 KB).
- Created with the built-in imagegen tool for this project.
- Prompt: Photorealistic luxury automotive editorial background plate, no cars, no people, no text or logos. Wide landscape 16:9. Empty modern architectural pavilion on a coastal cliff, warm grey textured concrete, pale limestone floor with realistic subtle reflections, large curved architectural wall framing distant misty mountains and ocean, overcast blue hour soft natural light, charcoal and silver neutral palette. Eye-level low automotive photography camera, spacious empty foreground center for compositing a sports car. Sophisticated quiet premium atmosphere, realistic photography rather than illustration. Fine tactile material detail, restrained atmospheric haze.

## Footer automotive studio background
- File: `footer-garage.webp` (local WebP).
- Generated with the built-in imagegen tool; no car, person, logo or text is present in the image.
- Prompt: Photorealistic automotive advertising background plate, empty premium car photography studio inside a modern motorsport garage. Absolutely no vehicles, cars, wheels, people, text, signage or logos. Wide 16:9 composition. Low automotive camera at 0.8 metres, level horizon, 50mm lens. Large empty flat charcoal concrete floor occupying lower 60 percent of frame, fine realistic matte concrete texture and subtle soft reflections. Upper 40 percent: dark graphite garage walls, long soft white strip lights, frosted glass partitions, architectural beams and silver blue ambient illumination. Central floor empty for compositing a sports car; realistic automotive photography, neutral lighting for light and dark overlays.

## Exhibition parking footer background
- File: `footer-exhibition-parking.webp`.
- Built-in imagegen; empty exhibition parking hall with one central marked parking bay, no vehicles, people, logos or text.
- Prompt: Photorealistic luxury automotive exhibition parking hall background plate. Wide 16:9, symmetrical modern exhibition garage, polished matte grey concrete floor occupying lower 65%. One clearly defined large empty central foreground parking bay with white painted lines in perspective, rear edge at y48%, foreground edge at y90%. Adjacent empty bays, pillars, graphite wall panels, soft linear white ceiling lighting, frosted windows, neutral silver-blue light. Low camera at about 1m looking slightly down, flat floor and restrained reflections, suitable for compositing an animated sports car in front three-quarter view. No cars, people, text, logos, podium, plants, racing flags, neon or signs.

## User-selected footer parking background
- Original: `Image/Twilight Luxury Parking Deck.png`, supplied by the user.
- Website version: `assets/footer-twilight-parking.webp`, optimized WebP; original preserved.

## Added Porsche and Nissan models
- `models/porsche-911.glb`: *(FREE) Porsche 911 Carrera 4S*, Karol Miklas / Lionsharp Studios. Embedded author: https://sketchfab.com/karolmiklas ; original https://sketchfab.com/3d-models/free-porsche-911-carrera-4s-d01b254483794de3819786d93e0e1ebf . CC BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/ . Downloaded from https://raw.githubusercontent.com/pedrosoandre/carros/main/assets/porsche-911-carrera.glb . Local GLB losslessly repacked; geometry and decoded texture pixels retained exactly (see below). Runtime: remove baked ground/duplicate coat shells, normalize scale, replace paint, split wheel surfaces into axle pivots. Model adaptations retain CC BY-SA 4.0; this does not change unrelated website code licensing.
- `models/nissan-r34.glb`: *Nissan Skyline R34 GT-R*, Lexyc16, https://sketchfab.com/Lexyc16 . Original https://sketchfab.com/3d-models/nissan-skyline-r34-gt-r-ff8fb2251dfa4bb9979e7022c5a6666c . CC BY 4.0, https://creativecommons.org/licenses/by/4.0/ . Downloaded from https://raw.githubusercontent.com/pedrosoandre/carros/main/assets/nissan-gt-r.glb . Local GLB losslessly repacked; geometry and decoded texture pixels retained exactly (see below). Runtime: normalize scale, replace paint, split wheel surfaces into axle pivots.
- Base64 `.local.js` counterparts carry the same asset licenses, metadata and attribution. Both assets load locally, on demand.
- `../js/vendor/meshopt_decoder.module.js`: meshoptimizer decoder from Three.js r169, Copyright 2016–2022 Arseny Kapoulkine, MIT; see `../js/vendor/MESHOPT-LICENSE.txt`. Decoder WASM is embedded and requires no external fetch. Original distribution: https://github.com/mrdoob/three.js/blob/r169/examples/jsm/libs/meshopt_decoder.module.js .
- Porsche reference figures: 991 Carrera 4S, 3.8 L, 400 PS, 0–100 km/h in 4.1 s and 299 km/h with suitable optional equipment. Manufacturer release: https://www.porsche.com/usa/aboutporsche/pressreleases/pag/?id=2012-08-27&pool=international-de . Palette references: https://www.porsche.com/stories/design/the-most-iconic-porsche-colours/ and https://www.porsche.com/filestore/download/uk/none/991-2nd-c2-catalogue-price/default/b6b24a31-dbc2-11e5-b8f1-0019999cd470/911-Price-list.pdf . Presets are representative 991 factory colours, not a claim that every paint was offered in every model year.
- Nissan reference figures: BNR34 V·spec II, 280 PS, 392 Nm, 1,560 kg. No unverified acceleration or top-speed figure is shown. Manufacturer: https://www.nissan-global.com/EN/HERITAGE_COLLECTION/280_skyline_gt-r_v-spec_ii.html . R34 paint-history reference: https://usa.nissannews.com/en-US/releases/stories-beyond-black-and-white-iconic-gt-r-colors-then-and-now . Presets span R34 versions, including special editions; displayed RGB and the purple/jade appearance are approximate, not calibrated multi-layer paint simulations.
