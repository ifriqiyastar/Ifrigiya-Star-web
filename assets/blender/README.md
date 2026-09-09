# Landing-page star

`ifriqiya-star.blend` is the editable Blender 5.2 source, including the chrome
sculpture, lime perimeter inlay, camera and studio lights.

Regenerate the source, browser model and transparent fallback image from the
repository root:

```sh
blender --background --python scripts/create-hero-star.py
```

Outputs:

- `assets/blender/ifriqiya-star.blend` — editable source and render studio.
- `public/models/ifriqiya-star.glb` — sculpture only, with PBR materials.
- `public/models/ifriqiya-star-poster.png` — transparent Blender render.

The hero lazily imports `components/site/star-scene.ts`, which loads the GLB
with Three.js GLTFLoader. Studio reflections are generated locally, so there
are no remote model, texture or HDR dependencies. Motion pauses when the hero
is outside the viewport or the tab is hidden. A visible pause button also
stops movement. Reduced-motion preferences use the poster without loading
Three.js; the same poster handles loading and WebGL/model failures.

To change the geometry reproducibly, edit the generator script. To sculpt by
hand, edit the `.blend`, select only the star body and inlay, and export a GLB
with Selected Objects and +Y Up enabled to the path above. Re-render the poster
after changing the model. The browser studio is configured separately in
`star-scene.ts`, so its moving reflections differ slightly from the poster.
