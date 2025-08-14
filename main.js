// js13k-2025 Black Cat
// Minimal starter, golfed for size
const c = document.getElementById("c"),
  x = c.getContext("2d");
let w, h;
function R() {
  w = window.innerWidth;
  h = window.innerHeight;
  c.width = w;
  c.height = h;
}
window.onresize = R;
R();
function L() {
  x.fillStyle = "#101020";
  x.fillRect(0, 0, w, h);
  /*...game loop...*/ requestAnimationFrame(L);
}
L();
