// Fonction utilitaire pour parser une ligne CSV en gérant les virgules dans les champs
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // Double quotes inside quotes
                current += '"';
                i++;
            } else {
                // Toggle quotes mode
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // End of field
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    // Push the last field
    result.push(current.trim());
    return result;
}

// Fonction utilitaire pour charger le CSV et le parser
function loadCSV(url) {
    return fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('CSV not found');
            return response.text();
        })
        .then(text => {
            const lines = text.trim().split('\n');
            const headers = parseCSVLine(lines[0]);
            return lines.slice(1).map(line => {
                const values = parseCSVLine(line);
                const obj = {};
                headers.forEach((h, i) => obj[h.trim()] = values[i] || '');
                return obj;
            });
        });
}

// Création et gestion des options de tri
function createSortOptions(metadata) {
    const sortBar = document.createElement('div');
    sortBar.className = 'sort-bar';
    sortBar.innerHTML = `
        <button class="sort-option" data-field="date">date</button>
        <button class="sort-option" data-field="valeur">prix</button>
        <button class="sort-option" data-field="largeur">taille</button>
    `;

    // Ajouter la barre de tri au-dessus de la galerie
    const galleryGrid = document.querySelector('.gallery-grid');
    galleryGrid.parentElement.insertBefore(sortBar, galleryGrid);

    // Sauvegarder les métadonnées originales
    const originalMetadata = [...metadata];

    // Gérer les clics sur les options de tri
    const sortOptions = sortBar.querySelectorAll('.sort-option');
    sortOptions.forEach(option => {
        option.addEventListener('click', () => {
            if (option.classList.contains('active')) {
                // Si l'option est déjà active, la désactiver et revenir à l'état original
                option.classList.remove('active');
                renderGallery(originalMetadata);
            } else {
                // Retirer la classe active de toutes les options
                sortOptions.forEach(opt => opt.classList.remove('active'));
                // Ajouter la classe active à l'option cliquée
                option.classList.add('active');
                // Trier la galerie
                sortGallery(option.dataset.field, metadata);
            }
        });
    });
}

// Fonction de tri de la galerie
function sortGallery(field, metadata) {
    const sortedMetadata = [...metadata].sort((a, b) => {
        let valueA = a[field] || '';
        let valueB = b[field] || '';

        if (field === 'valeur') {
            const parseVal = v => {
                const n = parseFloat((v || '').replace('€', '').replace(',', '.'));
                return isNaN(n) ? null : n;
            };
            const numA = parseVal(valueA);
            const numB = parseVal(valueB);
            if (numA === null && numB === null) return 0;
            if (numA === null) return 1;
            if (numB === null) return -1;
            return numB - numA;
        } else if (field === 'largeur') {
            valueA = parseFloat((valueA || '0').replace('cm', '').replace(',', '.')) || 0;
            valueB = parseFloat((valueB || '0').replace('cm', '').replace(',', '.')) || 0;
            return valueA - valueB;
        } else if (field === 'date') {
            // Parse dd/mm/yyyy, placer les sans date à la fin, tri du plus ancien au plus récent
            const parseDate = (dateStr) => {
                if (!dateStr || dateStr === '-' || dateStr === '/' || dateStr.toLowerCase() === 'nan') return null;
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    // yyyy-mm-dd pour le constructeur Date
                    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                }
                // fallback : essayer le parsing direct
                const d = new Date(dateStr);
                return isNaN(d.getTime()) ? null : d;
            };
            const dateA = parseDate(valueA);
            const dateB = parseDate(valueB);
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateA - dateB; // plus ancien en haut
        } else {
            return valueA.toString().localeCompare(valueB.toString(), 'fr');
        }
    });
    renderGallery(sortedMetadata);
}

// Initialisation unique du viewer et de ses enfants
const viewer = document.getElementById('imageViewer');
let viewerImgFrame = viewer.querySelector('.viewer-img-frame');
let viewerImgContainer, viewerImg, viewerImgBack, viewerMetaTop;
if (!viewerImgFrame) {
    viewerImgFrame = document.createElement('div');
    viewerImgFrame.className = 'viewer-img-frame';
    viewerImgContainer = document.createElement('div');
    viewerImgContainer.className = 'viewer-img-container';
    viewerImg = document.createElement('img');
    viewerImg.className = 'viewer-img';
    viewerImgBack = document.createElement('img');
    viewerImgBack.className = 'viewer-img back';
    viewerImgContainer.appendChild(viewerImg);
    viewerImgContainer.appendChild(viewerImgBack);
    viewerImgFrame.appendChild(viewerImgContainer);
    viewer.insertBefore(viewerImgFrame, viewer.firstChild);
} else {
    viewerImgContainer = viewerImgFrame.querySelector('.viewer-img-container');
    viewerImg = viewerImgContainer.querySelector('.viewer-img');
    viewerImgBack = viewerImgContainer.querySelector('.viewer-img.back');
}
let viewerMetaTopEl = document.getElementById('viewerMetaTop');
if (!viewerMetaTopEl) {
    viewerMetaTopEl = document.createElement('div');
    viewerMetaTopEl.className = 'viewer-meta-top';
    viewerMetaTopEl.id = 'viewerMetaTop';
    viewer.appendChild(viewerMetaTopEl);
}
const viewerMeta = document.getElementById('viewerMeta');

// Variable globale pour garder la liste courante des images affichées
window.currentImagesData = [];

// Ajout d'un throttle pour le flip
window.lastFlipTime = 0;

function triggerFlip() {
    const now = Date.now();
    if (now - window.lastFlipTime > 2000) return; // 1 seconde
    window.lastFlipTime = now;
    viewerImgContainer.classList.toggle('flipped');
}

// Flip sur hover (mouseenter/mouseleave) avec throttle uniquement sur mouseenter
viewerImgContainer.addEventListener('mouseenter', () => {
    const now = Date.now();
    if (now - window.lastFlipTime < 500) return;
    window.lastFlipTime = now;
    viewerImgContainer.classList.add('flipped');
});
viewerImgContainer.addEventListener('mouseleave', () => {
    viewerImgContainer.classList.remove('flipped');
});

function renderGallery(metadata = []) {
    const galleryGrid = document.querySelector('.gallery-grid');
    const cacheBuster = Date.now();

    // Générer la liste des images à partir du CSV (toutes les lignes du CSV)
    const imagesData = metadata.map(meta => {
        const num = (meta.numero || '').trim().padStart(3, '0');
        return {
            ...meta,
            path: `images/${num}.png?v=${cacheBuster}`,
            backPath: `images/${num}.1.png?v=${cacheBuster}`,
            numero: num
        };
    });

    // Mettre à jour la liste globale des images affichées (objets enrichis)
    window.currentImagesData = imagesData;

    // Créer le menu de tri si ce n'est pas déjà fait
    if (!document.querySelector('.sort-bar')) {
        createSortOptions(metadata);
    }

    // Déclare openViewer AVANT la boucle de création des images
    function openViewer(idx, imagesData, direction = 0) {
        if (window.animating) return;
        window.animating = true;
        const imgData = imagesData[idx];
        window.currentIndex = idx;
        window.isShowingBack = false;
        viewerImgContainer.classList.remove('flipped');

        // Désactiver le scroll de la page
        document.body.style.overflow = 'hidden';

        // Précharger les deux faces
        const newImg = new Image();
        newImg.src = imgData.path;
        const newImgBack = new Image();
        newImgBack.src = imgData.backPath;

        // Fonction utilitaire pour afficher '-' si valeur vide, NaN ou '/'
        const safeValue = v => {
            if (v === undefined || v === null) return '-';
            const s = String(v).trim();
            if (s === '' || s === '/' || s.toLowerCase() === 'nan') return '-';
            return s;
        };

        const formatNumber = n => n ? n.padStart(3, '0') : '-';
        const formatFloat = (v, unit) => {
            if (!v || v === '/' || v.toLowerCase() === 'nan') return '-';
            const n = parseFloat(v.replace(',', '.'));
            if (isNaN(n)) return '-';
            return n.toLocaleString('fr-FR', {minimumFractionDigits: 1, maximumFractionDigits: 2}) + unit;
        };
        const formatCurrency = v => {
            if (!v || v === '/' || v.toLowerCase() === 'nan') return '-';
            const n = parseFloat((v || '').replace(',', '.').replace('€',''));
            if (isNaN(n)) return '-';
            return n.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'});
        };
        const metaLine = [
            `n° ${formatNumber(imgData.numero)}`,
            `type: ${safeValue(imgData.nom)}`,
            `papier: ${safeValue(imgData.papier)}`,
            `technique d'impression: ${safeValue(imgData["technique d'impression"])}`,
            `date: ${safeValue(imgData.date)}`,
            `émetteur: ${safeValue(imgData["émétteur"])}`,
            `adresse: ${safeValue(imgData.adresse)}`,
            `hauteur: ${formatFloat(imgData.hauteur, ' cm')}`,
            `largeur: ${formatFloat(imgData.largeur, ' cm')}`,
            `valeur: ${formatCurrency(imgData.valeur)}`,
            `quantité: ${safeValue(imgData["quantité"])}`
        ].filter(Boolean).join(' // ').toLowerCase();

        // Fondu croisé du texte et de l'image lors du scroll
        if (viewerMetaTopEl) {
            if (direction !== 0) {
                viewerMetaTopEl.style.transition = 'opacity 0.2s ease-out';
                viewerImgFrame.style.transition = 'opacity 0.2s ease-out';
                setTimeout(() => {
                    viewerMetaTopEl.style.opacity = '0';
                    viewerImgFrame.style.opacity = '0';
                }, 0);
            }
        }

        setTimeout(() => {
            // Mettre à jour les images
            viewerImg.src = imgData.path;
            viewerImgBack.src = imgData.backPath;

            // Apparition progressive du nouveau texte et de l'image
            if (viewerMetaTopEl) {
                if (direction !== 0) {
                    viewerMetaTopEl.textContent = metaLine;
                    viewerMetaTopEl.style.transition = 'opacity 0.7s ease-in';
                    viewerMetaTopEl.style.opacity = '1';
                    viewerImgFrame.style.transition = 'opacity 0.7s ease-in';
                    viewerImgFrame.style.opacity = '1';
                } else {
                    viewerMetaTopEl.textContent = metaLine;
                    viewerMetaTopEl.style.opacity = '1';
                    viewerImgFrame.style.opacity = '1';
                }
            }

            if (direction !== 0) {
                viewerMeta.style.opacity = '1';
            }

            // Animation de zoom initiale seulement à l'ouverture
            if (!viewer.classList.contains('active')) {
                viewer.classList.add('active');
                viewer.style.display = 'flex';
                setTimeout(() => {
                    viewer.style.opacity = '1';
                    window.animating = false;
                }, 10);
            } else {
                window.animating = false;
            }
        }, direction !== 0 ? 200 : 400);
    }

    // Rendu des images
    galleryGrid.innerHTML = '';
    imagesData.forEach((imgData, idx) => {
        const galleryItem = document.createElement('div');
        galleryItem.className = 'gallery-item';
        const img = document.createElement('img');
        img.src = imgData.path;
        img.alt = imgData.nom || 'Image de la galerie';
        galleryItem.appendChild(img);
        galleryGrid.appendChild(galleryItem);
        galleryItem.addEventListener('click', (e) => {
            openViewer(idx, window.currentImagesData, 0);
        });
    });

    function closeZoom() {
        viewer.classList.remove('active');
        viewer.style.opacity = '0';
        
        // Réactiver le scroll de la page
        document.body.style.overflow = '';
        
        setTimeout(() => { 
            viewer.style.display = 'none';
            viewerImgContainer.classList.remove('flipped');
        }, 200);
        window.currentIndex = null;
        window.isShowingBack = false;
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && viewer.classList.contains('active')) closeZoom();
    });

    viewer.addEventListener('click', (e) => {
        if (e.target === viewer) closeZoom();
    });

    // Navigation par scroll (wheel)
    viewer.addEventListener('wheel', (e) => {
        if (!viewer.classList.contains('active') || window.animating) return;
        e.preventDefault();
        if (e.deltaY > 0) {
            if (window.currentIndex < window.currentImagesData.length - 1) openViewer(window.currentIndex + 1, window.currentImagesData, 1);
        } else if (e.deltaY < 0) {
            if (window.currentIndex > 0) openViewer(window.currentIndex - 1, window.currentImagesData, -1);
        }
    }, { passive: false });
}

document.addEventListener('DOMContentLoaded', () => {
    loadCSV('metadata.csv')
        .then(renderGallery)
        .catch(err => {
            console.error('Erreur chargement CSV, fallback sans métadonnées', err);
            renderGallery([]);
        });
}); 