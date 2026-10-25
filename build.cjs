// Inlines src/ into one self-contained index.html (GitHub Pages).
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const safe = js => js.replace(/<\/script/gi, '<\/script');

const title = 'Manager Effect Lab';
const description = 'How well do you lead a team? Lead three AI teammates through hidden-profile puzzles and see which research-backed leadership habits you use. A playful test inspired by Weidmann, Xu & Deming (2025), plus tools for running the method with real teams.';
const ogTitle = 'How well do you lead a team of AI agents?';
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,500..800&family=IBM+Plex+Mono:wght@400;500&family=Public+Sans:ital,wght@0,400..700;1,400&display=swap">';
const css = read('styles.css');
const body = read('body.html');
const scripts = ['stats.js', 'puzzles.js', 'coach.js', 'scripted.js', 'llm.js', 'app.js'].map(f => '<script>\n' + safe(read(f)) + '\n</script>').join('\n');

// applies a saved light/dark choice before first paint, so a dark-mode reader never sees a light flash
const themeBoot = '<script>try{var t=JSON.parse(localStorage.getItem("mel.theme"));if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}</script>';

const full = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${description.replace(/"/g, '&quot;')}">
<meta property="og:title" content="${ogTitle}">
<meta property="og:description" content="${description.replace(/"/g, '&quot;')}">
${themeBoot}
${fonts}
<style>
${css}
</style>
</head>
<body>
${body}
${scripts}
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, 'index.html'), full);
console.log('index.html', (full.length / 1024).toFixed(1) + ' KB');
