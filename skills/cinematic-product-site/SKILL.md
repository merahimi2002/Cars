---
name: cinematic-product-site
description: Build or refine immersive product showcase websites with a continuous scroll story, interactive product views, adaptive glass UI, and polished mobile layouts. Use when the user wants the cinematic product presentation style established in the Cars project, including for coffee or another product category.
---

# Cinematic product website

## Intent and visual direction

Preserve the user's preferred experience: a prominent interactive product, purposeful cinematic motion, a continuous visual journey between sections, restrained glass surfaces, and carefully composed typography. Transfer this design language to the new product; do not copy car imagery, terminology, or mechanics into unrelated products.

These are defaults learned from the Cars project, not requirements that override the next brief. Inspect an existing site's structure and preserve the parts the user likes. For a new site, choose a coherent product-specific direction and implement it rather than offering a long catalog of possibilities.

## Adapt the product before designing

Identify the featured object, meaningful variants, useful viewing angles, credible details, and an appropriate setting. Let those choices drive the story and motion. Keep content truthful; omit invented specifications, prices, testimonials, awards, addresses, contact information, or certifications.

- Cars: body paint, viewing angles, wheels, lights, cabin, parking environment.
- Coffee: packaging or cup, roast/origin variants, grind or brewing details, tactile paper, ceramic, wood, and a cafe or roastery setting. Product variants must represent real differences; do not just recolor brewed coffee as if it were car paint. Only describe steam or pouring if the asset and animation can support it convincingly.
- Other products: use the equivalent material, functional detail, and context. Avoid applying every control to every object.

Use a real 3D model when the available asset justifies it. Otherwise use coherent transparent imagery or a supplied angle sequence and explain the supported interaction honestly. Do not fake arbitrary 360-degree inspection using a single flat photo.

## Preferred page composition

Choose sections based on the product. A useful starting point is:

1. A cinematic hero with one clear featured product and a small set of usable variant/view controls.
2. A scroll story revealing a few meaningful details, using the selected product and variant throughout.
3. A closing environment where the same object settles naturally behind a readable glass footer or call to action.

The user prefers a cohesive designed page over disconnected template sections. Avoid adding generic feature-card grids, unnecessary counters, repetitive eyebrow labels, fake statistics, and ornamental text that crowds the object. Keep the navigation aligned with the actual page sections.

## Continuous motion

- Treat the featured object as one continuous presence. Reuse the render or preserve its pose, apparent size, and projected screen center when handing it between sections. Avoid a visible duplicate, disappearance, or hard reset.
- Drive section-to-section motion from a shared scroll timeline, with damped interpolation and smooth reversible progress. Camera approach, rotation, translation, and reveal should connect without an idle gap or a sudden vertical drop.
- Tie mechanical motion to actual travel. For wheels, use traveled distance divided by radius; stop rotation when the body parks. Reverse scroll must retrace the same movement rather than accumulate rotations.
- Orbit around the product to change view; avoid interpolating the camera through the product. A view change should serve a detail, not become an arbitrary full spin.
- Hide or disable controls while the object is transitioning out of their usable context. Restore them after the reverse transition settles.
- Reserve space for the traveling object. Keep reading text and interactive controls out of its path, especially on mobile. If the footer intentionally puts copy over the product, place the product behind the glass layer.
- Use feathering or edge-only blur only where it solves a real canvas boundary. Remove artificial border blur and feathering when the object has entered the footer background. Never blur the full product just to conceal a framing defect.
- Respect reduced motion: provide stable framing and usable controls without relying on scroll animation.

## Grounding and backgrounds

Match the virtual floor, contact points, camera perspective, lighting, and scale to the background. Add a tight contact shadow and a softer body shadow that follow the selected model and camera. The object must rest on the floor, not on a distant horizon or a wall in the photo.

When compositing a product over a photograph, use an EMPTY environment plate with no duplicate product. For a car this could be a marked parking bay; for coffee, a clear counter or cafe table. Leave the intended product area unobstructed. Ask for no text, logos, people, or baked-in UI in generated plates unless specifically wanted.

Use a real photographic asset for a requested photographic background, rather than pretending a CSS gradient is a photograph. Save final assets locally, retain the original when making an optimized variant, and record their source or generation prompt. Use the available image-generation workflow when appropriate; never imply unavailable tools exist.

When `cover` is requested, fill the entire intended section. Verify the crop on mobile and desktop: important floor or table contact geometry must survive. A background sized from the entire footer may shift the floor when copy height changes; account for that rather than treating the image as decoration alone.

## Theme, glass, typography, and actions

- Separate light/dark surface tokens, text contrast, theme accents, and selected-product color. A white or black product must not make the UI illegible. Carry the selection consistently into the story, lighting accents, and footer.
- Blend adjoining section surfaces and texture so scrolling does not reveal an abrupt color seam.
- Glass panels should feel part of the environment: translucent fill, subtle border/highlight, and sufficient backdrop blur. Increase contrast or fill when needed; blur alone does not guarantee readable text. In the established footer style, body text is black in light mode and white in dark mode.
- Use a coherent `clamp()` type scale for titles, copy, captions, and controls. Keep oversized background words subdued. Align icons with labels on one baseline. Respect Persian RTL while isolating Latin model names or values when needed.
- Use restrained title gradients and texture. Do not add branding credits or external links without relevant user direction; preserve supplied legitimate credits and links.
- Primary actions can use theme-aware gradients that reverse smoothly on hover and keyboard focus. For an adjacent pair, opposite starting directions provide balance. Preserve clear button text, focus states, touch sizing, and reduced-motion behavior.
- A fixed glass navbar needs a measured offset in sticky layouts and anchor navigation; it must not cover headings, edition labels, or controls.

## Implementation and verification

Use the project's current stack unless there is a concrete reason to change it. Do not introduce a framework, build pipeline, animation library, or additional WebGL context just for this style. Reuse loaded geometry and textures, cap renderer resolution appropriately, lazy-load optional variants, and stop rendering when idle or offscreen.

For static delivery, use relative paths that work under a GitHub Pages subpath. If direct `file://` opening is a requirement, provide a tested compatible asset/script path; normal ES modules and fetch-based models will not work there automatically. Rebuild existing standalone output after changing its source. Keep the final assets in the project, not only in a generation cache.

Before calling the work complete, inspect the real preview:

- Desktop plus narrow mobile widths such as 360 and 390 pixels, in light and dark modes.
- Each featured variant through forward and reverse transitions, including fast scroll and resize.
- Full object framing where intended, believable floor contact, natural shadows, and no accidental text/control overlap.
- Footer glass layering, background crop, text contrast, button states, focus, and reduced motion.
- No horizontal overflow, broken assets, runtime errors, or new static-path regressions.

Fix the observed problems, then provide a concise outcome and a saved preview. Do not claim a browser/device combination was verified if it was only inferred from CSS.

## Example invocation for the next project

«با مهارت cinematic-product-site یک سایت فارسی برای برند قهوه بساز. همان کیفیت نمایش محصول، حرکت پیوسته با اسکرول، پنل شیشه‌ای و تم هماهنگ را می‌خواهم؛ اما فضا، متریال و داستان مخصوص قهوه باشد. محصول اصلی بستهٔ قهوه است و انتخاب نوع رُست باید در همهٔ سکشن‌ها هماهنگ بماند. اول دارایی‌های موجود را بررسی کن، اطلاعات ساختگی نگذار، و موبایل و دارک/لایت را در پیش‌نمایش چک کن.»

This file is also a portable Markdown brief: it can be attached to another assistant even when skill discovery is unavailable.
