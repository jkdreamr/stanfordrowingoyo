from pathlib import Path
import struct
import zlib

def icon(size):
    rows = []
    glyph = ["11111", "10000", "10000", "11111", "00001", "00001", "11111"]
    scale = size // 12
    for y in range(size):
        row = bytearray()
        for x in range(size):
            gx = (x - (size - scale * 5) // 2) // scale
            gy = (y - (size - scale * 7) // 2) // scale
            white = 0 <= gx < 5 and 0 <= gy < 7 and glyph[gy][gx] == "1"
            row.extend((255, 255, 255) if white else (140, 21, 21))
        rows.append(b"\x00" + row)
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(b"".join(rows))) + chunk(b"IEND", b"")

out = Path(__file__).parent / "public" / "icons"
out.mkdir(exist_ok=True)
for name, size in [("icon-192", 192), ("icon-512", 512), ("maskable", 512), ("apple-touch", 180)]:
    (out / (name + ".png")).write_bytes(icon(size))
