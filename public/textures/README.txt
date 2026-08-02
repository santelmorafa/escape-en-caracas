Texturas reales opcionales (PolyHaven / ambientCG, CC0).

Por defecto el juego genera texturas PBR procedurales de alta calidad en runtime
(asfalto con grietas, aceras de baldosas, fachadas con ventanas, metal), así que
NO necesitas nada aquí para jugar.

Para subir el realismo con texturas fotográficas:
  1) Descarga sets PBR (albedo/normal/roughness) de:
       - https://polyhaven.com/textures
       - https://ambientcg.com
  2) Colócalas en esta carpeta.
  3) Amplía src/materials/Materials.js para cargarlas con THREE.TextureLoader
     y reemplazar las procedurales (la interfaz ya está centralizada ahí).
