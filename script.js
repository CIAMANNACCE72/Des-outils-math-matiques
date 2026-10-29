const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');

let aireActive = true;
let pointActif = true;
let tangenteActive = false;
let suiteActive = false;

let xMin = -2;
let xMax = 6;
let yMin = -2;
let yMax = 6;
let aireMin = 0;
let aireMax = 2;

let xSourisMath = null;
let xFixe = null; // Point fixe pour la tangente au clic
let fonctionsData = [];
let couleursPalette = ['#2b6cb0', '#e53e3e', '#38a169', '#d69e2e', '#805ad5', '#319795'];

// Variables pour le déplacement (Pan)
let estEnGlissement = false;
let dernierXGlissement = 0;
let dernierYGlissement = 0;

function initialiserFonctionsParDefaut() {
  ajouterLigneFonction("0.5*x + 2", couleursPalette[0]);
  mettreAJourGraphique();
}

function ajouterLigneFonction(expression = "x^2", couleur = null) {
  const listDiv = document.getElementById('listFonctions');
  const index = listDiv.children.length;
  if (!couleur) {
    couleur = couleursPalette[index % couleursPalette.length];
  }

  const row = document.createElement('div');
  row.className = 'function-row';
  row.innerHTML = `
    <input type="color" value="${couleur}" style="width: 40px; height: 38px; padding: 0; border: none; cursor: pointer;" title="Couleur de la courbe">
    <input type="text" class="input-eq" value="${expression}" placeholder="Ex: x^2, sqrt(x+1), etc.">
    <button type="button" class="btn-danger btn-supprimer">Supprimer</button>
  `;

  row.querySelector('.btn-supprimer').addEventListener('click', () => {
    if (listDiv.children.length > 1) {
      row.remove();
      mettreAJourGraphique();
    } else {
      alert("Vous devez conserver au moins une fonction.");
    }
  });

  row.querySelector('.input-eq').addEventListener('keydown', event => {
    if (event.key === 'Enter') mettreAJourGraphique();
  });

  listDiv.appendChild(row);
  mettreAJourGraphique();
}

document.getElementById('btnAjouterFonction').addEventListener('click', () => {
  ajouterLigneFonction();
});

function redimensionnerCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function synchroniserChampsSaisie() {
  document.getElementById('traceMin').value = Number(xMin.toFixed(2));
  document.getElementById('traceMax').value = Number(xMax.toFixed(2));
  document.getElementById('yMinInput').value = Number(yMin.toFixed(2));
  document.getElementById('yMaxInput').value = Number(yMax.toFixed(2));
}

function evaluerNombre(id, valeurParDefaut) {
  const champ = document.getElementById(id);
  if (!champ) return valeurParDefaut;
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
    alert(`La valeur « ${expression} » du champ « ${id} » n’est pas valide.`);
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
  const nouveauYMin = evaluerNombre('yMinInput', yMin);
  const nouveauYMax = evaluerNombre('yMaxInput', yMax);
  const nouveauAireMin = evaluerNombre('borneA', aireMin);
  const nouveauAireMax = evaluerNombre('borneB', aireMax);

  if (nouveauXMin >= nouveauXMax || nouveauYMin >= nouveauYMax) {
    alert("Les bornes minimales doivent être strictement inférieures aux bornes maximales.");
    return;
  }

  const rows = document.querySelectorAll('.function-row');
  const nouvellesFonctions = [];
  let indexSelectionne = document.getElementById('selectCourbeAire').value;

  for (let i = 0; i < rows.length; i++) {
    const couleur = rows[i].querySelector('input[type="color"]').value;
    const equation = rows[i].querySelector('.input-eq').value;

    try {
      const compilee = math.compile(equation);
      compilee.evaluate({ x: 1 });

      let deriveeCompilee = null;
      try {
        const deriveeExpr = math.derivative(equation, 'x');
        deriveeCompilee = deriveeExpr.compile();
      } catch (e) {
        deriveeCompilee = null;
      }

      nouvellesFonctions.push({
        index: i,
        equation,
        couleur,
        compilee,
        deriveeCompilee
      });
    } catch (error) {
      alert(`L’équation de la fonction #${i + 1} (${equation}) n’est pas valide.`);
      return;
    }
  }

  fonctionsData = nouvellesFonctions;

  const select = document.getElementById('selectCourbeAire');
  select.innerHTML = '';
  fonctionsData.forEach((f, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.innerText = `Courbe ${idx + 1}: f(x) = ${f.equation}`;
    select.appendChild(opt);
  });

  if (indexSelectionne < fonctionsData.length) {
    select.value = indexSelectionne;
  }

  xMin = nouveauXMin;
  xMax = nouveauXMax;
  yMin = nouveauYMin;
  yMax = nouveauYMax;
  aireMin = nouveauAireMin;
  aireMax = nouveauAireMax;

  dessiner();
  genererTableauValeurs();
}

function calculerAire(fonctionCompilee) {
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
    } catch (error) {}
  }
  return total;
}

function dessiner() {
  if (fonctionsData.length === 0) return;

  redimensionnerCanvas();

  const ratio = window.devicePixelRatio || 1;
  const largeur = canvas.width / ratio;
  const hauteur = canvas.height / ratio;

  ctx.clearRect(0, 0, largeur, hauteur);

  const stockValeursY = [];
  fonctionsData.forEach((f) => {
    const valeursY = [];
    for (let px = 0; px <= largeur; px++) {
      const x = xMin + (px / largeur) * (xMax - xMin);
      try {
        const y = f.compilee.evaluate({ x });
        valeursY.push(y);
      } catch (error) {
        valeursY.push(NaN);
      }
    }
    stockValeursY.push(valeursY);
  });

  const pixX = x => ((x - xMin) / (xMax - xMin)) * largeur;
  const pixY = y => hauteur - ((y - yMin) / (yMax - yMin)) * hauteur;

  const formater = valeur => {
    if (Math.abs(valeur) >= 1000 || (Math.abs(valeur) < 0.001 && valeur !== 0)) {
      return valeur.toExponential(2);
    }
    return Number(valeur.toFixed(2)).toString();
  };

  // Axes principaux
  ctx.strokeStyle = '#cbd5e0';
  ctx.lineWidth = 1;
  const axeX = pixY(0);
  const axeY = pixX(0);

  ctx.beginPath();
  ctx.moveTo(0, axeX); ctx.lineTo(largeur, axeX); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(axeY, 0); ctx.lineTo(axeY, hauteur); ctx.stroke();

  // Droite y = x si suite active
  if (suiteActive) {
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pixX(xMin), pixY(xMin));
    ctx.lineTo(pixX(xMax), pixY(xMax));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Bornes d'axes
  ctx.fillStyle = '#334155';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(formater(yMax), 6, Math.max(12, pixY(yMax)));
  ctx.fillText(formater(yMin), 6, Math.min(hauteur - 34, pixY(yMin)));

  ctx.textBaseline = 'top';
  ctx.fillText(formater(xMin), 50, hauteur - 18);
  ctx.textAlign = 'right';
  ctx.fillText(formater(xMax), largeur - 10, hauteur - 18);

  const indexCible = parseInt(document.getElementById('selectCourbeAire').value) || 0;
  const courbeCible = fonctionsData[indexCible] || fonctionsData[0];

  // Aire sous la courbe
  if (aireActive && courbeCible) {
    ctx.fillStyle = hexToRgba(courbeCible.couleur, 0.25);
    ctx.beginPath();

    let premierPoint = true;
    const debut = Math.max(xMin, aireMin);
    const fin = Math.min(xMax, aireMax);

    for (let px = Math.floor(pixX(debut)); px <= Math.ceil(pixX(fin)); px++) {
      const x = xMin + (px / largeur) * (xMax - xMin);
      const y = stockValeursY[courbeCible.index][px];

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

    document.getElementById('valeurAire').innerText = calculerAire(courbeCible.compilee).toFixed(4);
  } else {
    document.getElementById('valeurAire').innerText = '--';
  }

  // Graduations
  const choisirPas = amplitude => {
    const grossier = amplitude / 10;
    const puissances = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
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

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let x = Math.ceil(xMin / pasX) * pasX; x <= xMax; x += pasX) {
    const px = pixX(x);
    ctx.beginPath(); ctx.moveTo(px, axeX - 4); ctx.lineTo(px, axeX + 4); ctx.stroke();
    if (Math.abs(x) > 1e-10) {
      ctx.fillText(Number(x.toFixed(3)).toString(), px, axeX + 6);
    }
  }

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let y = Math.ceil(yMin / pasY) * pasY; y <= yMax; y += pasY) {
    const py = pixY(y);
    ctx.beginPath(); ctx.moveTo(axeY - 4, py); ctx.lineTo(axeY + 4, py); ctx.stroke();
    if (Math.abs(y) > 1e-10) {
      ctx.fillText(Number(y.toFixed(3)).toString(), axeY - 6, py);
    }
  }

  // Traçage des courbes
  fonctionsData.forEach((f, idx) => {
    ctx.beginPath();
    ctx.strokeStyle = f.couleur;
    ctx.lineWidth = (idx === indexCible) ? 3 : 2;

    let nouveauTrait = true;
    const valeursY = stockValeursY[idx];

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
  });

  // Dérivée
  if (document.getElementById('afficherDerivee').checked && courbeCible && courbeCible.deriveeCompilee) {
    ctx.beginPath();
    ctx.strokeStyle = '#e53e3e';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);

    let nouveauTrait = true;
    for (let px = 0; px <= largeur; px++) {
      const x = xMin + (px / largeur) * (xMax - xMin);
      try {
        const y = courbeCible.deriveeCompilee.evaluate({ x });
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

  // Toile d'araignée (Suite récurrente)
  const suiteContainer = document.getElementById('suiteResultatContainer');
  const valeursSuiteSpan = document.getElementById('valeursSuite');

  if (suiteActive && courbeCible) {
    const u0 = evaluerNombre('suiteU0', 0.5);
    const N = Math.floor(evaluerNombre('suiteN', 5));

    let un = u0;
    let termes = [un];
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.8;

    try {
      let unSuivant = courbeCible.compilee.evaluate({ x: un });
      if (typeof unSuivant === 'number' && isFinite(unSuivant)) {
        ctx.beginPath();
        ctx.moveTo(pixX(un), pixY(0));
        ctx.lineTo(pixX(un), pixY(unSuivant));
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(pixX(un), pixY(unSuivant));
        ctx.lineTo(pixX(unSuivant), pixY(unSuivant));
        ctx.stroke();

        termes.push(unSuivant);
        un = unSuivant;

        for (let i = 1; i < N; i++) {
          let suivant = courbeCible.compilee.evaluate({ x: un });
          if (typeof suivant !== 'number' || !isFinite(suivant)) break;

          ctx.beginPath();
          ctx.moveTo(pixX(un), pixY(un));
          ctx.lineTo(pixX(un), pixY(suivant));
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(pixX(un), pixY(suivant));
          ctx.lineTo(pixX(suivant), pixY(suivant));
          ctx.stroke();

          termes.push(suivant);
          un = suivant;
        }

        ctx.fillStyle = '#b45309';
        termes.forEach((val) => {
          let yVal = courbeCible.compilee.evaluate({ x: val });
          if (typeof yVal === 'number' && isFinite(yVal)) {
            ctx.beginPath();
            ctx.arc(pixX(val), pixY(yVal), 4, 0, 2 * Math.PI);
            ctx.fill();
          }
        });
      }

      valeursSuiteSpan.innerHTML = termes.map((t, idx) => `u<sub>${idx}</sub> = <strong>${Number(t.toFixed(4))}</strong>`).join(' ; ');
      suiteContainer.style.display = 'block';

    } catch (e) {
      suiteContainer.style.display = 'none';
    }
  } else {
    suiteContainer.style.display = 'none';
  }

  // Point mobile et Tangente (Mobile ou Fixé par clic xFixe)
  const xActif = (xFixe !== null) ? xFixe : xSourisMath;

  if (pointActif && courbeCible && xActif !== null && xActif >= xMin && xActif <= xMax) {
    try {
      const yPoint = courbeCible.compilee.evaluate({ x: xActif });
      if (typeof yPoint === 'number' && isFinite(yPoint)) {
        ctx.beginPath();
        ctx.fillStyle = (xFixe !== null) ? '#ef4444' : courbeCible.couleur;
        ctx.arc(pixX(xActif), pixY(yPoint), (xFixe !== null) ? 6.5 : 5.5, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (tangenteActive && courbeCible.deriveeCompilee) {
          const pente = courbeCible.deriveeCompilee.evaluate({ x: xActif });
          if (typeof pente === 'number' && isFinite(pente)) {
            const yGauche = pente * (xMin - xActif) + yPoint;
            const yDroite = pente * (xMax - xActif) + yPoint;

            ctx.beginPath();
            ctx.strokeStyle = (xFixe !== null) ? '#dc2626' : courbeCible.couleur;
            ctx.lineWidth = (xFixe !== null) ? 2 : 1.5;
            ctx.setLineDash([4, 4]);
            ctx.moveTo(pixX(xMin), pixY(yGauche));
            ctx.lineTo(pixX(xMax), pixY(yDroite));
            ctx.stroke();
            ctx.setLineDash([]);

            // Affichage équation réduite de la tangente fixée
            if (xFixe !== null) {
              const ordonneeOrigine = yPoint - pente * xActif;
              const signeOrdonnee = ordonneeOrigine >= 0 ? '+' : '-';
              const eqTexte = `y = ${pente.toFixed(2)}x ${signeOrdonnee} ${Math.abs(ordonneeOrigine).toFixed(2)}  (au point x₀ = ${xActif.toFixed(2)})`;
              
              const eqContainer = document.getElementById('equationTangenteContainer');
              const eqText = document.getElementById('equationTangenteText');
              if (eqContainer && eqText) {
                eqText.innerText = eqTexte;
                eqContainer.style.display = 'block';
              }
            } else {
              document.getElementById('equationTangenteContainer').style.display = 'none';
            }
          }
        }

        const statutFixe = (xFixe !== null) ? ' 📌 (Fixé - Cliquez pour libérer)' : '';
        document.getElementById('coordonneesPoint').innerText =
          `[Courbe ${indexCible + 1}] x = ${xActif.toFixed(2)}, y = ${yPoint.toFixed(2)}${statutFixe}`;
      }
    } catch (error) {
      document.getElementById('coordonneesPoint').innerText = 'Point non défini';
    }
  } else {
    if (xFixe === null) {
      document.getElementById('equationTangenteContainer').style.display = 'none';
    }
  }
}

function genererTableauValeurs() {
  const debut = evaluerNombre('tabDebut', 0);
  const fin = evaluerNombre('tabFin', 5);
  const pas = evaluerNombre('tabPas', 1);

  const wrapper = document.getElementById('tableauValeursWrapper');
  if (debut >= fin || pas <= 0 || fonctionsData.length === 0) {
    wrapper.innerHTML = `<p style="text-align: center; color: #ef4444; padding: 10px; margin:0;">Intervalle ou pas invalide.</p>`;
    return;
  }

  let html = `<table class="val-table"><thead><tr><th>x</th>`;
  fonctionsData.forEach((f, idx) => {
    html += `<th>f<sub>${idx + 1}</sub>(x)</th>`;
  });
  html += `</tr></thead><tbody>`;

  for (let x = debut; x <= fin + 1e-9; x += pas) {
    let xArrondi = Number(x.toFixed(4));
    html += `<tr><td><strong>${xArrondi}</strong></td>`;
    
    fonctionsData.forEach(f => {
      try {
        let y = f.compilee.evaluate({ x: xArrondi });
        let yStr = (typeof y === 'number' && isFinite(y)) ? Number(y.toFixed(4)) : 'err';
        html += `<td>${yStr}</td>`;
      } catch (e) {
        html += `<td>err</td>`;
      }
    });
    html += `</tr>`;
  }

  html += `</tbody></table>`;
  wrapper.innerHTML = html;
}

function hexToRgba(hex, alpha) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return `rgba(${num >> 16}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

function basculerAire() {
  aireActive = !aireActive;
  const bouton = document.getElementById('btnAire');
  bouton.innerText = aireActive ? '🟢 Aire : Activée' : '🔴 Aire : Désactivée';
  bouton.className = aireActive ? 'btn-toggle btn-active' : 'btn-toggle btn-inactive';
  dessiner();
}

function basculerPoint() {
  pointActif = !pointActif;
  const bouton = document.getElementById('btnPoint');
  bouton.innerText = pointActif ? '🟢 Point : Activé' : '🔴 Point : Désactivé';
  bouton.className = pointActif ? 'btn-toggle btn-active' : 'btn-toggle btn-inactive';
  if (!pointActif) {
    document.getElementById('coordonneesPoint').innerText = 'Désactivé';
  }
  dessiner();
}

function basculerTangente() {
  tangenteActive = !tangenteActive;
  const bouton = document.getElementById('btnTangente');
  bouton.innerText = tangenteActive ? '🟢 Tangente : Activée' : '🔴 Tangente : Désactivée';
  bouton.className = tangenteActive ? 'btn-toggle btn-active' : 'btn-toggle btn-inactive';
  dessiner();
}

function basculerSuite() {
  suiteActive = !suiteActive;
  const bouton = document.getElementById('btnSuite');
  bouton.innerText = suiteActive ? '🟢 Suite : Activée' : '🔴 Suite : Désactivée';
  bouton.className = suiteActive ? 'btn-toggle btn-active' : 'btn-toggle btn-inactive';
  dessiner();
}

function sauvegarderImage() {
  const lien = document.createElement('a');
  lien.download = 'mon_graphique_lycee.png';
  lien.href = canvas.toDataURL('image/png');
  lien.click();
}

// Clic sur le canvas pour fixer ou libérer le point/tangente
canvas.addEventListener('click', event => {
  if (!pointActif || fonctionsData.length === 0) return;

  const rect = canvas.getBoundingClientRect();
  const xPixel = event.clientX - rect.left;
  const xClic = xMin + (xPixel / rect.width) * (xMax - xMin);

  if (xFixe !== null && Math.abs(xClic - xFixe) < (xMax - xMin) * 0.03) {
    xFixe = null; // Libère si on clique près du point fixe
    document.getElementById('equationTangenteContainer').style.display = 'none';
  } else {
    xFixe = xClic; // Fixe à cette abscisse
  }
  dessiner();
});

// Zoom à la molette centré sur le curseur
canvas.addEventListener('wheel', event => {
  event.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  const xCentre = xMin + (mouseX / rect.width) * (xMax - xMin);
  const yCentre = yMax - (mouseY / rect.height) * (yMax - yMin);

  const facteur = event.deltaY < 0 ? 0.9 : 1.1;

  const amplitudeX = (xMax - xMin) * facteur;
  const amplitudeY = (yMax - yMin) * facteur;

  const ratioX = mouseX / rect.width;
  const ratioY = mouseY / rect.height;

  xMin = xCentre - ratioX * amplitudeX;
  xMax = xCentre + (1 - ratioX) * amplitudeX;
  yMin = yCentre - (1 - ratioY) * amplitudeY;
  yMax = yCentre + ratioY * amplitudeY;

  synchroniserChampsSaisie();
  dessiner();
}, { passive: false });

// Glisser-déposer (Pan)
canvas.addEventListener('mousedown', event => {
  estEnGlissement = true;
  dernierXGlissement = event.clientX;
  dernierYGlissement = event.clientY;
  canvas.style.cursor = 'grabbing';
});

canvas.addEventListener('mousemove', event => {
  const rect = canvas.getBoundingClientRect();
  const xPixel = event.clientX - rect.left;

  if (estEnGlissement) {
    const dxPixel = event.clientX - dernierXGlissement;
    const dyPixel = event.clientY - dernierYGlissement;

    const dxMath = (dxPixel / rect.width) * (xMax - xMin);
    const dyMath = (dyPixel / rect.height) * (yMax - yMin);

    xMin -= dxMath;
    xMax -= dxMath;
    yMin += dyMath;
    yMax += dyMath;

    dernierXGlissement = event.clientX;
    dernierYGlissement = event.clientY;

    synchroniserChampsSaisie();
    dessiner();
  } else {
    if (pointActif && fonctionsData.length === 0) return;
    if (xFixe === null) {
      xSourisMath = xMin + (xPixel / rect.width) * (xMax - xMin);
      dessiner();
    }
  }
});

window.addEventListener('mouseup', () => {
  if (estEnGlissement) {
    estEnGlissement = false;
    canvas.style.cursor = 'crosshair';
  }
});

canvas.addEventListener('mouseleave', () => {
  estEnGlissement = false;
  if (xFixe === null) {
    xSourisMath = null;
    document.getElementById('coordonneesPoint').innerText = 'Survolez le graphique (Cliquez pour fixer)';
  }
  canvas.style.cursor = 'crosshair';
  dessiner();
});

document.getElementById('btnTracer').addEventListener('click', mettreAJourGraphique);
document.getElementById('btnAire').addEventListener('click', basculerAire);
document.getElementById('btnPoint').addEventListener('click', basculerPoint);
document.getElementById('btnTangente').addEventListener('click', basculerTangente);
document.getElementById('btnSuite').addEventListener('click', basculerSuite);
document.getElementById('btnCalculerTableau').addEventListener('click', genererTableauValeurs);
document.getElementById('btnImage').addEventListener('click', sauvegarderImage);
document.getElementById('selectCourbeAire').addEventListener('change', dessiner);
document.getElementById('afficherDerivee').addEventListener('change', dessiner);

window.addEventListener('resize', dessiner);
window.addEventListener('load', initialiserFonctionsParDefaut);