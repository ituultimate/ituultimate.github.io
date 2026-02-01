/**
 * Interactive Campus Map Script
 * Uses Leaflet.js for image-based mapping
 */

// ===========================================
// 1. CONFIGURATION & DATA
// ===========================================

// Map Configuration

const MAP_CONFIG = {
    // Bu değerler aşağıdaki fonksiyon tarafından otomatik hesaplanacağı için
    // buraya ne yazdığının (minZoom, initZoom) teknik olarak önemi kalmadı.
    minZoom: -4,
    maxZoom: 2,
    initZoom: -4,
    imagePath: 'campus-places.png' // DİKKAT: .jpg olarak düzelttim
};
// Location Data (JSON Structure)
// Note: Coordinates will need adjustment based on the new image scale
// Use console.log output from map clicks to find correct [y, x] values
const locations = [
    {
        id: 'maslak-gate',
        name: 'Arı Kapı',
        category: 'Giriş',
        categoryClass: 'category-admin',
        description: 'Kampüsün ana girişi. Güvenlik kontrolü ve misafir kaydı buradan yapılır. Metro çıkışına en yakın noktadır.',
        coords: [1375, 1050] // Top-left area
    },
    {
        id: 'rectory',
        name: 'Rektörlük',
        category: 'İdari',
        categoryClass: 'category-admin',
        description: 'Üniversitenin idari merkezi. Öğrenci işleri ve yönetim birimleri burada bulunur.',
        coords: [1300, 950]
    },
    {
        id: 'library',
        name: 'Mustafa İnan Kütüphanesi',
        category: 'Akademik',
        categoryClass: 'category-faculty',
        description: '7/24 açık çalışma alanları, geniş kitap koleksiyonu ve dijital kaynaklara erişim merkezi.',
        coords: [900, 1050]
    },
    {
        id: 'med',
        name: 'MED',
        category: 'Fakülte',
        categoryClass: 'category-faculty',
        description: 'Merkezi Derslik Binası',
        coords: [1150, 1550]
    },
    {
        id: 'yemekhane',
        name: 'Yemekhane',
        category: 'Sosyal',
        categoryClass: 'category-dining',
        description: 'Öğle ve akşam yemeklerinin servis edildiği ana yemekhane binası.',
        coords: [950, 1300]
    },
    {
        id: 'stadium',
        name: 'Stadyum',
        category: 'Spor',
        categoryClass: 'category-social',
        description: 'Futbol sahası, koşu pisti ve spor etkinliklerinin yapıldığı alan.',
        coords: [550, 1950] // Bottom-right area
    },
    {
        id: 'kmb',
        name: 'KMB',
        category: 'Fakülte',
        categoryClass: 'category-faculty',
        description: 'Kimya Metalurji Fakültesi',
        coords: [1250, 2400] // Bottom-right area
    },
    {
        id: 'mdn',
        name: 'Maden',
        category: 'Fakülte',
        categoryClass: 'category-faculty',
        description: 'Maden Fakültesi',
        coords: [1200, 2100] // Bottom-right area
    },
    {
        id: 'eeb',
        name: 'EEB',
        category: 'Fakülte',
        categoryClass: 'category-faculty',
        description: 'Elektrik Elektronik Fakültesi.',
        coords: [1150, 1800] // Bottom-right area
    },
    {
        id: 'gym',
        name: 'Spor Salonu',
        category: 'Spor',
        categoryClass: 'category-social',
        description: 'Spor Salonu',
        coords: [700, 1250] // Bottom-right area
    },
    {
        id: 'ydy',
        name: 'Hazırlık Binası YDY',
        category: 'Fakülte',
        categoryClass: 'category-faculty',
        description: 'YDY Hazırlık Binası',
        coords: [1250, 1400] // Bottom-right area
    },
    {
        id: 'halisaha',
        name: 'Halı Saha',
        category: 'Spor',
        categoryClass: 'category-social',
        description: 'Halı Saha',
        coords: [1050, 850] // Bottom-right area
    },
    {
        id: 'ins',
        name: 'İnşaat Fakültesi',
        category: 'Fakülte',
        categoryClass: 'category-faculty',
        description: 'İnşaat Fakültesi',
        coords: [950, 600] // Bottom-right area
    },
    {
        id: 'uub',
        name: 'UUB',
        category: 'Fakülte',
        categoryClass: 'category-faculty',
        description: 'Uçak Uzay Mühendisliği Fakültesi',
        coords: [400, 1550] // Bottom-right area
    },
    {
        id: 'medc',
        name: 'MED C',
        category: 'Fakülte',
        categoryClass: 'category-faculty',
        description: 'MED C',
        coords: [700, 400] // Bottom-right area
    },
    {
        id: 'FEB',
        name: 'FEB',
        category: 'Fakülte',
        categoryClass: 'category-faculty',
        description: 'Fen Edebiyat Fakültesi',
        coords: [1350, 1500] // Bottom-right area
    },
    {
        id: 'sdkm',
        name: 'SDKM',
        category: 'İdari',
        categoryClass: 'category-admin',
        description: 'Süleyman Demirel Kültür Merkezi',
        coords: [1350, 1250] // Bottom-right area
    },
    {
        id: 'bilgisayar',
        name: 'Bilgisayar',
        category: 'Fakülte',
        categoryClass: 'category-faculty',
        description: 'Bilgisayar Fakültesi',
        coords: [1000, 2350] // Bottom-right area
    },
    {
        id: 'gemiinsaat',
        name: 'Gemi İnşaat Ve Deniz Bilimleri',
        category: 'Fakülte',
        categoryClass: 'category-faculty',
        description: 'Gemi İnşaat Ve Deniz Bilimleri Fakültesi',
        coords: [1000, 2650] // Bottom-right area
    },
    {
        id: 'golet',
        name: 'Gölet',
        category: 'Sosyal',
        categoryClass: 'category-admin',
        description: 'Gölet',
        coords: [1000, 3500] // Bottom-right area
    },
    {
        id: 'medb',
        name: 'MED B',
        category: 'Fakülte',
        categoryClass: 'category-faculty',
        description: 'MED B',
        coords: [1050, 2800] // Bottom-right area
    },
];

// ===========================================
// 2. INITIALIZATION
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    setupEventListeners();
});

let map;
let markers = [];

// Global variable to store bounds
let mapImageBounds;

function initMap() {
    const img = new Image();
    img.src = MAP_CONFIG.imagePath;

    img.onload = function () {
        const w = this.naturalWidth;
        const h = this.naturalHeight;
        mapImageBounds = [[0, 0], [h, w]];

        // --- DÜZELTİLEN KISIM BAŞLANGIÇ ---
        const mapContainer = document.getElementById('map');

        // Bu yardımcı fonksiyon, orandan Leaflet zoom seviyesini hesaplar
        const getZoomFromScale = (scale) => Math.log2(scale);

        const widthRatio = mapContainer.clientWidth / w;
        const heightRatio = mapContainer.clientHeight / h;

        // "Cover" mantığı: Ekranı boşluksuz doldurmak için büyük olan oranı seçiyoruz
        // Math.log2 kullanarak doğru zoom seviyesini buluyoruz
        const minZoom = getZoomFromScale(Math.max(widthRatio, heightRatio));
        // --- DÜZELTİLEN KISIM BİTİŞ ---

        // Leaflet Map Başlatma
        map = L.map('map', {
            crs: L.CRS.Simple,
            minZoom: minZoom,
            maxZoom: 2,
            zoomControl: false,
            attributionControl: false,
            maxBounds: [[0, 0], [h, w]],
            maxBoundsViscosity: 1.0
        });

        L.imageOverlay(MAP_CONFIG.imagePath, mapImageBounds).addTo(map);

        // Haritayı ortala ve hesaplanan zoom seviyesinde aç
        map.setView([h / 2, w / 2], minZoom);

        // Pencere boyutu değişirse zoom sınırını güncelle
        map.on('resize', () => {
            const newRatio = Math.max(
                map.getContainer().clientWidth / w,
                map.getContainer().clientHeight / h
            );
            map.setMinZoom(getZoomFromScale(newRatio));
        });

        // Markerları ekle
        locations.forEach(loc => {
            addMarker(loc);
        });

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // BUTON YERLEŞTİRMEK İÇİN KOORDİNAT BULUCU
        // Konsolu (F12) açıp haritada istediğin yere tıkladığında 
        // [y, x] koordinatlarını burada göreceksin.
        map.on('click', (e) => {
            console.log(`Koordinat: [${Math.round(e.latlng.lat)}, ${Math.round(e.latlng.lng)}]`);
        });
    };
}

function addMarker(location) {
    // Create Custom Icon (Blue circle with yellow border)
    const customIcon = L.divIcon({
        className: 'custom-marker-icon', // defined in CSS
        html: `<div class="marker-dot"></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15] // Center the icon
    });

    // Create Marker
    const marker = L.marker(location.coords, { icon: customIcon }).addTo(map);

    // Bind Tooltip (Hover)
    marker.bindTooltip(location.name, {
        permanent: false,
        direction: 'top',
        className: 'custom-tooltip',
        offset: [0, -15]
    });

    // Click Event
    marker.on('click', () => {
        selectLocation(location);

        // Smooth Zoom to Location
        map.flyTo(location.coords, 1.5, {
            animate: true,
            duration: 1.0
        });
    });

    markers.push(marker);
}

// ===========================================
// 3. INTERACTION LOGIC
// ===========================================

const infoPanel = document.getElementById('info-panel');
const locationCategory = document.getElementById('location-category');
const locationName = document.getElementById('location-name');
const locationDescription = document.getElementById('location-description');

function selectLocation(loc) {
    // Populate Info Panel
    locationCategory.textContent = loc.category;
    locationName.textContent = loc.name;
    locationDescription.textContent = loc.description;

    // Update Category Color (text only as bg is standard blue now)
    locationCategory.className = `location-category ${loc.categoryClass.replace('bg-', 'text-')}`;

    // Show Panel
    infoPanel.classList.add('active');
}

function closePanel() {
    infoPanel.classList.remove('active');
}

function resetMapView() {
    if (map && mapImageBounds) {
        map.fitBounds(mapImageBounds);
    } else if (map) {
        // Fallback if bounds not loaded yet
        map.setZoom(0);
    }
    closePanel();
}

// ===========================================
// 4. EVENT LISTENERS
// ===========================================

function setupEventListeners() {
    document.getElementById('close-panel-btn').addEventListener('click', closePanel);
    document.getElementById('reset-view-btn').addEventListener('click', resetMapView);
}
