// Fonction utilitaire pour charger le CSV et le parser
function loadCSV(url) {
    return fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('CSV not found');
            return response.text();
        })
        .then(text => {
            const lines = text.trim().split('\n');
            const headers = lines[0].split(',');
            return lines.slice(1).map(line => {
                const values = line.split(',');
                const obj = {};
                headers.forEach((h, i) => obj[h.trim()] = values[i]?.trim());
                return obj;
            });
        });
}

// Création et gestion des options de tri
function createSortOptions(metadata) {
    const sortBar = document.createElement('div');
    sortBar.className = 'sort-bar';
    sortBar.innerHTML = `
        <button class="sort-option" data-field="valeur">Prix</button>
        <button class="sort-option" data-field="date">Date</button>
        <button class="sort-option" data-field="largeur">Largeur</button>
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

        // Traitement spécial selon le type de champ
        if (field === 'valeur') {
            // Convertir les prix en nombres
            valueA = parseFloat((valueA || '0').replace('€', '').replace(',', '.')) || 0;
            valueB = parseFloat((valueB || '0').replace('€', '').replace(',', '.')) || 0;
            return valueA - valueB;
        } else if (field === 'largeur') {
            // Convertir les largeurs en nombres
            valueA = parseFloat((valueA || '0').replace('cm', '').replace(',', '.')) || 0;
            valueB = parseFloat((valueB || '0').replace('cm', '').replace(',', '.')) || 0;
            return valueA - valueB;
        } else if (field === 'date') {
            // Convertir les dates en objets Date pour un tri chronologique
            // Gérer différents formats de date possibles
            const parseDate = (dateStr) => {
                if (!dateStr) return new Date(0); // Date par défaut si vide
                
                // Nettoyer la chaîne de date
                dateStr = dateStr.toLowerCase().trim();
                
                // Gérer les années seules
                if (/^\d{4}$/.test(dateStr)) {
                    return new Date(dateStr);
                }
                
                // Gérer les dates au format "dd/mm/yyyy" ou "dd-mm-yyyy"
                const parts = dateStr.split(/[/-]/);
                if (parts.length === 3) {
                    // Réorganiser en format YYYY-MM-DD pour le constructeur Date
                    if (parts[2].length === 4) {
                        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    }
                }
                
                // Pour tout autre format, essayer le parsing direct
                return new Date(dateStr);
            };

            const dateA = parseDate(valueA);
            const dateB = parseDate(valueB);
            return dateA - dateB;
        } else {
            // Tri alphabétique par défaut
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

function renderGallery(metadata = []) {
    const galleryGrid = document.querySelector('.gallery-grid');
    const cacheBuster = Date.now();

    // Créer le menu de tri si ce n'est pas déjà fait
    if (!document.querySelector('.sort-bar')) {
        createSortOptions(metadata);
    }

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

        // Formatage des métadonnées pour la ligne du haut
        const formatNumber = n => n ? n.padStart(3, '0') : '';
        const formatFloat = (v, unit) => v ? (parseFloat(v.replace(',', '.')).toLocaleString('fr-FR', {minimumFractionDigits: 1, maximumFractionDigits: 2}) + unit) : '';
        const formatCurrency = v => v ? (parseFloat(v.replace(',', '.').replace('€','')).toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})) : '';
        const metaLine = [
            `n° ${formatNumber(imgData.numero)}`,
            `type: ${imgData.nom || ''}`,
            `papier: ${imgData.papier || ''}`,
            `technique d'impression: ${imgData["technique d'impression"] || ''}`,
            `date: ${imgData.date || ''}`,
            `émetteur: ${imgData["émétteur"] || ''}`,
            `adresse: ${imgData.adresse || ''}`,
            `hauteur: ${formatFloat(imgData.hauteur, ' cm')}`,
            `largeur: ${formatFloat(imgData.largeur, ' cm')}`,
            `valeur: ${formatCurrency(imgData.valeur)}`,
            `quantité: ${imgData["quantité"] || ''}`
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
            openViewer(idx, imagesData, 0);
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
            if (window.currentIndex < imagesData.length - 1) openViewer(window.currentIndex + 1, imagesData, 1);
        } else if (e.deltaY < 0) {
            if (window.currentIndex > 0) openViewer(window.currentIndex - 1, imagesData, -1);
        }
    }, { passive: false });
}

document.addEventListener('DOMContentLoaded', () => {
    loadCSV('images_metadata.csv')
        .then(renderGallery)
        .catch(err => {
            console.error('Erreur chargement CSV, fallback sans métadonnées', err);
            renderGallery([]);
        });
}); 