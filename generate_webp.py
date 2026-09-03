#!/usr/bin/env python3
"""
Skrypt do generowania zoptymalizowanych tekstur WebP dla galerii Metavers.

W odróżnieniu od portfolio (z0z6/foto), obrazy tutaj są teksturami 3D
(ramy na ścianach, tapety, materiały podłogi/ścian) — nie ma lightboxa
ani potrzeby serwowania oryginału w pełnej rozdzielczości. Dlatego zamiast
dwóch rozmiarów miniatur generujemy JEDEN, odpowiednio dobrany do sposobu
użycia danej grupy plików:

  images-src/      (prace w galerii, max 2m wysokości w scenie)
      -> images/            max 1600px, jakość 82
  wallpapers-src/  (tło pełnoekranowe / CSS)
      -> wallpapers/         max 1920px, jakość 80
  textures-src/    (tekstury materiałów: color mapy — teksele powtarzane
                     przez repeat(), więc NIE zmniejszamy rozdzielczości,
                     tylko rekompresujemy do WebP)
      -> textures/            bez zmiany rozmiaru, jakość 85
                               (normal/roughness mapy zostają w oryginalnym
                               formacie — patrz NORMAL_ROUGHNESS_KEYWORDS
                               niżej: kompresja stratna potrafi wprowadzić
                               widoczne artefakty w oświetleniu)

Wymaga: pip install Pillow

Użycie:
    python generate_webp.py
"""

from PIL import Image
import os
import glob
import shutil

# (folder źródłowy, folder wynikowy, maks. dłuższy bok w px lub None = bez zmiany, jakość)
JOBS = [
    ("images-src", "images", 1600, 82),
    ("wallpapers-src", "wallpapers", 1920, 80),
    ("textures-src", "textures", None, 85),
]

# Pliki zawierające jedno z tych słów w nazwie NIE są konwertowane do WebP —
# zostają skopiowane 1:1. Normal/roughness mapy są wrażliwe na kompresję
# stratną (widoczne prążkowanie w oświetleniu PBR).
SKIP_LOSSY_KEYWORDS = ("normal", "roughness")

EXTENSIONS = ("*.jpg", "*.jpeg", "*.png", "*.webp")


def convert_one(input_path, output_path, max_size, quality):
    with Image.open(input_path) as img:
        if img.mode in ("RGBA", "P"):
            # Zachowaj przezroczystość jeśli występuje (WebP ją wspiera)
            img = img.convert("RGBA") if "A" in img.getbands() else img.convert("RGB")
        if max_size:
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        img.save(output_path, "WEBP", quality=quality, method=6)
        return os.path.getsize(output_path)


def copy_one(input_path, output_path):
    # Kopia bit-w-bit (bez ponownego zapisu/kompresji przez Pillow) —
    # normal/roughness mapy mają zostać dokładnie takie, jak w źródle.
    shutil.copy2(input_path, output_path)
    return os.path.getsize(output_path)


def main():
    grand_total_in = 0
    grand_total_out = 0

    for src_dir, out_dir, max_size, quality in JOBS:
        if not os.path.isdir(src_dir):
            print(f"(pomijam {src_dir}/ — folder nie istnieje)")
            continue

        os.makedirs(out_dir, exist_ok=True)

        files = []
        for pattern in EXTENSIONS:
            files.extend(glob.glob(os.path.join(src_dir, pattern)))
        files.sort()

        if not files:
            print(f"(brak plików w {src_dir}/)")
            continue

        print(f"\n== {src_dir}/ -> {out_dir}/ "
              f"(max {max_size or 'bez zmian'}px, jakość {quality}) ==")

        for path in files:
            filename = os.path.basename(path)
            name, ext = os.path.splitext(filename)
            original_size = os.path.getsize(path)
            grand_total_in += original_size

            if any(k in name.lower() for k in SKIP_LOSSY_KEYWORDS):
                out_path = os.path.join(out_dir, filename)
                new_size = copy_one(path, out_path)
                tag = "kopia (bez WebP — normal/roughness)"
            else:
                out_path = os.path.join(out_dir, f"{name}.webp")
                new_size = convert_one(path, out_path, max_size, quality)
                tag = "WebP"

            grand_total_out += new_size
            reduction = (1 - new_size / original_size) * 100 if original_size else 0
            print(f"  {filename:20s} {original_size/1024:8.1f} KB -> "
                  f"{os.path.basename(out_path):20s} {new_size/1024:8.1f} KB "
                  f"({reduction:+.0f}%) [{tag}]")

    print("\n" + "-" * 70)
    print(f"RAZEM: {grand_total_in/1024/1024:.1f} MB -> {grand_total_out/1024/1024:.1f} MB "
          f"(oszczędność {(1 - grand_total_out/grand_total_in)*100:.1f}%)"
          if grand_total_in else "Brak plików do przetworzenia.")
    print("\nNastępny krok: zaktualizuj ścieżki w artworks.json / src/textures.js /"
          " js/vr-headset-bg.js / index.html na rozszerzenie .webp"
          " (jednorazowo — patrz README).")


if __name__ == "__main__":
    main()
