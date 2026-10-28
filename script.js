const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');

let aireActive = true;
let pointActif = true;

let xMin = -5;
let xMax = 5;
let aireMin = 0;
let aireMax = 2;

let fonctionCompilee = null;
let xSourisMath = null;
let deriveeCompilee = null;

function redimensionnerCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function evaluerNombre(id, valeurParDefaut) {
  const champ = document.getElementById(id);
  const expression = champ.value.trim();

  if (expression === '') {
    alert(`Le champ « ${id} » ne doit pas être vide.`);
    return valeurParDefaut;
  }

  try {
    const resultat = math.evaluate(expression);

    if (typeof resultat !== 'number' || !isFinite(resultat)) {
      throw new Error('Résultat non numérique');
    }

    return resultat;
  } catch (error) {
    alert(
      `La valeur « ${expression} » du champ « ${id} » n’est pas une expression numérique valide.\n\n` +
      `Exemples acceptés : 2, -1.5, pi, 2*pi, sqrt(2), e^2, pi/2.`
    );

    champ.focus();
    return valeurParDefaut;
  }
}

function mettreAJourGraphique() {
  if (typeof math === 'undefined') {
    alert("La bibliothèque math.js n’a pas pu être chargée.");
    return;
  }

  const nouveauXMin = evaluerNombre('traceMin', xMin);
  const nouveauXMax = evaluerNombre('traceMax', xMax);
  const nouveauAireMin = evaluerNombre('borneA', aireMin);
  const nouveauAireMax = evaluerNombre('borneB', aireMax);

  if (nouveauXMin >= nouveauXMax) {
    alert("Le X minimum doit être strictement inférieur au X maximum.");
    return;
  }

  if (nouveauAireMin >= nouveauAireMax) {
    alert("La borne minimale a doit être strictement inférieure à la borne maximale b.");
    return;
  }

  const equation = document.getElementById('equation').value;

  try {
    const fonctionCompileeEssai = math.compile(equation);
    fonctionCompileeEssai.evaluate({ x: 1 });
    fonctionCompilee = fonctionCompileeEssai;
  } catch (error) {
    alert("L’équation de la fonction f(x) n’est pas valide.");
    return;
  }
try {
  deriveeCompilee = math.derivative(equation, 'x');
  deriveeCompilee = deriveeCompilee.compile();
} catch (error) {
  deriveeCompilee = null;
}
  xMin = nouveauXMin;
  xMax = nouveauXMax;
  aireMin = nouveauAireMin;
  aireMax = nouveauAireMax;

  dessiner();
}

function calculerAire() {
  if (!fonctionCompilee || aireMin >= aireMax) return 0;

  const nombreRectangles = 2000;
  const pas = (aireMax - aireMin) / nombreRectangles;
  let total = 0;

  for (let i = 0; i < nombreRectangles; i++) {
    const x = aireMin + (i + 0.5) * pas;

    try {
      const y = fonctionCompilee.evaluate({ x });

      if (typeof y === 'number' && isFinite(y)) {
        total += y * pas;
      }
    } catch (error) {
      // Valeur non définie : on l’ignore.
    }
  }

  return total;
}
function dessiner() {
  if (!fonctionCompilee) return;

  redimensionnerCanvas();

  const ratio = window.devicePixelRatio || 1;
  const largeur = canvas.width / ratio;
  const hauteur = canvas.height / ratio;

  ctx.clearRect(0, 0, largeur, hauteur);

  let yMin = Infinity;
  let yMax = -Infinity;
  const valeursY = [];

  for (let px = 0; px <= largeur; px++) {
    const x = xMin + (px / largeur) * (xMax - xMin);

    try {
      const y = fonctionCompilee.evaluate({ x });
      valeursY.push(y);

      if (typeof y === 'number' && isFinite(y)) {
        yMin = Math.min(yMin, y);
        yMax = Math.max(yMax, y);
      }
    } catch (error) {
      valeursY.push(NaN);
    }
  }

  if (!isFinite(yMin) || !isFinite(yMax) || yMin === yMax) {
    yMin = -1;
    yMax = 1;
  }

  const marge = (yMax - yMin) * 0.1 || 1;
  yMin -= marge;
  yMax += marge;

  const pixX = x => ((x - xMin) / (xMax - xMin)) * largeur;
  const pixY = y => hauteur - ((y - yMin) / (yMax - yMin)) * hauteur;

  const formater = valeur => {
    if (Math.abs(valeur) >= 1000 || (Math.abs(valeur) < 0.001 && valeur !== 0)) {
      return valeur.toExponential(2);
    }
    return Number(valeur.toFixed(2)).toString();
  };

  // Axes
  ctx.strokeStyle = '#cbd5e0';
  ctx.lineWidth = 1;

  const axeX = pixY(0);
  const axeY = pixX(0);

  ctx.beginPath();
  ctx.moveTo(0, axeX);
  ctx.lineTo(largeur, axeX);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(axeY, 0);
  ctx.lineTo(axeY, hauteur);
  ctx.stroke();

   // Étiquettes des bornes
  ctx.fillStyle = '#334155';
  ctx.font = '12px system-ui, sans-serif';

  // Ordonnée maximale : en haut à gauche
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(formater(yMax), 6, Math.max(12, pixY(yMax)));

  // Ordonnée minimale : à gauche, mais jamais dans la bande réservée à xMin
  const yMinPixel = Math.min(hauteur - 34, pixY(yMin));
  ctx.fillText(formater(yMin), 6, yMinPixel);

  // Abscisse minimale : en bas, décalée pour éviter yMin
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(formater(xMin), 50, hauteur - 18);

  // Abscisse maximale : en bas à droite
  ctx.textAlign = 'right';
  ctx.fillText(formater(xMax), largeur - 10, hauteur - 18);

  // Aire
  if (aireActive) {
    ctx.fillStyle = 'rgba(49, 130, 206, 0.25)';
    ctx.beginPath();

    let premierPoint = true;
    const debut = Math.max(xMin, aireMin);
    const fin = Math.min(xMax, aireMax);

    for (let px = Math.floor(pixX(debut)); px <= Math.ceil(pixX(fin)); px++) {
      const x = xMin + (px / largeur) * (xMax - xMin);
      const y = valeursY[px];

      if (typeof y === 'number' && isFinite(y)) {
        if (premierPoint) {
          ctx.moveTo(pixX(x), axeX);
          premierPoint = false;
        }
        ctx.lineTo(pixX(x), pixY(y));
      }
    }

    if (!premierPoint) {
      ctx.lineTo(pixX(fin), axeX);
      ctx.closePath();
      ctx.fill();
    }

    document.getElementById('valeurAire').innerText =
      calculerAire().toFixed(4);
  } else {
    document.getElementById('valeurAire').innerText = '--';
  }
// Graduations
const choisirPas = amplitude => {
  const grossier = amplitude / 10;
  const puissances = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05,
                      0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50,
                      100, 200, 500, 1000];

  for (const candidat of puissances) {
    if (candidat >= grossier) return candidat;
  }

  return 1000;
};

const pasX = choisirPas(xMax - xMin);
const pasY = choisirPas(yMax - yMin);

ctx.fillStyle = '#475569';
ctx.font = '11px system-ui, sans-serif';
ctx.lineWidth = 1;

// Graduations de l'axe des abscisses
ctx.textAlign = 'center';
ctx.textBaseline = 'top';

for (
  let x = Math.ceil(xMin / pasX) * pasX;
  x <= xMax;
  x += pasX
) {
  const px = pixX(x);

  ctx.beginPath();
  ctx.moveTo(px, axeX - 4);
  ctx.lineTo(px, axeX + 4);
  ctx.stroke();

  if (Math.abs(x) > 1e-10) {
    ctx.fillText(
      Number(x.toFixed(3)).toString(),
      px,
      axeX + 6
    );
  }
}

// Graduations de l'axe des ordonnées
ctx.textAlign = 'right';
ctx.textBaseline = 'middle';

for (
  let y = Math.ceil(yMin / pasY) * pasY;
  y <= yMax;
  y += pasY
) {
  const py = pixY(y);

  ctx.beginPath();
  ctx.moveTo(axeY - 4, py);
  ctx.lineTo(axeY + 4, py);
  ctx.stroke();

  if (Math.abs(y) > 1e-10) {
    ctx.fillText(
      Number(y.toFixed(3)).toString(),
      axeY - 6,
      py
    );
  }
}
  // Courbe
  ctx.beginPath();
  ctx.strokeStyle = '#2b6cb0';
  ctx.lineWidth = 2.5;

  let nouveauTrait = true;

  for (let px = 0; px <= largeur; px++) {
    const y = valeursY[px];

    if (typeof y === 'number' && isFinite(y)) {
      if (nouveauTrait) {
        ctx.moveTo(px, pixY(y));
        nouveauTrait = false;
      } else {
        ctx.lineTo(px, pixY(y));
      }
    } else {
      nouveauTrait = true;
    }
  }

  ctx.stroke();
if (document.getElementById('afficherDerivee').checked && deriveeCompilee) {
  ctx.beginPath();
  ctx.strokeStyle = '#e53e3e';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);

  let nouveauTrait = true;

  for (let px = 0; px <= largeur; px++) {
    const x = xMin + (px / largeur) * (xMax - xMin);

    try {
      const y = deriveeCompilee.evaluate({ x });

      if (typeof y === 'number' && isFinite(y)) {
        if (nouveauTrait) {
          ctx.moveTo(px, pixY(y));
          nouveauTrait = false;
        } else {
          ctx.lineTo(px, pixY(y));
        }
      } else {
        nouveauTrait = true;
      }
    } catch (error) {
      nouveauTrait = true;
    }
  }

  ctx.stroke();
  ctx.setLineDash([]);
}
  // Point mobile
  if (
    pointActif &&
    xSourisMath !== null &&
    xSourisMath >= xMin &&
    xSourisMath <= xMax
  ) {
    try {
      const yPoint = fonctionCompilee.evaluate({ x: xSourisMath });

      if (typeof yPoint === 'number' && isFinite(yPoint)) {
        ctx.beginPath();
        ctx.fillStyle = '#e53e3e';
        ctx.arc(pixX(xSourisMath), pixY(yPoint), 5, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        document.getElementById('coordonneesPoint').innerText =
          `X = ${xSourisMath.toFixed(2)}, Y = ${yPoint.toFixed(2)}`;
      }
    } catch (error) {
      document.getElementById('coordonneesPoint').innerText =
        'Point non défini';
    }
  }
}


function basculerAire() {
  aireActive = !aireActive;

  const bouton = document.getElementById('btnAire');

  bouton.innerText = aireActive
    ? '🟢 Aire : Activée'
    : '🔴 Aire : Désactivée';

  bouton.className = aireActive
    ? 'btn-toggle btn-active'
    : 'btn-toggle btn-inactive';

  dessiner();
}

function basculerPoint() {
  pointActif = !pointActif;

  const bouton = document.getElementById('btnPoint');

  bouton.innerText = pointActif
    ? '🟢 Point : Activé'
    : '🔴 Point : Désactivé';

  bouton.className = pointActif
    ? 'btn-toggle btn-active'
    : 'btn-toggle btn-inactive';

  if (!pointActif) {
    document.getElementById('coordonneesPoint').innerText = 'Désactivé';
  }

  dessiner();
}

function sauvegarderImage() {
  const lien = document.createElement('a');
  lien.download = 'mon_graphique_aire.png';
  lien.href = canvas.toDataURL('image/png');
  lien.click();
}

canvas.addEventListener('mousemove', event => {
  if (!pointActif || !fonctionCompilee) return;

  const rect = canvas.getBoundingClientRect();
  const xPixel = event.clientX - rect.left;

  xSourisMath = xMin + (xPixel / rect.width) * (xMax - xMin);
  dessiner();
});

canvas.addEventListener('mouseleave', () => {
  xSourisMath = null;
  document.getElementById('coordonneesPoint').innerText =
    'Survolez le graphique';
  dessiner();
});

document.getElementById('btnTracer').addEventListener('click', mettreAJourGraphique);
document.getElementById('btnAire').addEventListener('click', basculerAire);
document.getElementById('btnPoint').addEventListener('click', basculerPoint);
document.getElementById('btnImage').addEventListener('click', sauvegarderImage);

document.getElementById('equation').addEventListener('keydown', event => {
  if (event.key === 'Enter') mettreAJourGraphique();
});

window.addEventListener('resize', dessiner);
window.addEventListener('load', () => {
  redimensionnerCanvas();
  mettreAJourGraphique();
});