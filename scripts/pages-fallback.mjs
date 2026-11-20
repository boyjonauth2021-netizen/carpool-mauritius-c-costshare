import { copyFileSync, writeFileSync } from "node:fs";

copyFileSync("out/index.html", "out/404.html");
writeFileSync("out/.nojekyll", "");
console.log("Static output: out/ (index.html, 404.html, .nojekyll)");
