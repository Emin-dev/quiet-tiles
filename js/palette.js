// palette.js — colors paired with distinct shapes/glyphs so colorblind
// players never have to rely on color alone. Each palette entry is used
// consistently for a given color index across every level.

export const PALETTE = [
  { name: "Coral", hex: "#e5533d", glyph: "●" }, // filled circle
  { name: "Teal", hex: "#1f8a82", glyph: "■" }, // filled square
  { name: "Amber", hex: "#c98a1a", glyph: "▲" }, // triangle
  { name: "Violet", hex: "#7757b3", glyph: "◆" }, // diamond
  { name: "Sky", hex: "#2472c8", glyph: "★" }, // star
  { name: "Rose", hex: "#c94f8a", glyph: "✚" }, // plus
  { name: "Olive", hex: "#7a8a1f", glyph: "⬟" }, // pentagon
  { name: "Slate", hex: "#54606e", glyph: "◉" }, // ringed circle
  { name: "Brick", hex: "#a8452f", glyph: "◈" }, // outlined diamond
];

export function colorFor(index) {
  return PALETTE[index % PALETTE.length];
}
