document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 YTS Script Başlatıldı");

    // ============================================================= 
    // 1. FIREBASE CONFIG
    // ============================================================= 
    const firebaseConfig = {
        apiKey: "AIzaSyBxoBmV6dJqcl6YaVJ8eYiEpDkQ1fB5Pfw",
        authDomain: "ituultimate-7d97f.firebaseapp.com",
        projectId: "ituultimate-7d97f",
        storageBucket: "ituultimate-7d97f.firebasestorage.app",
        messagingSenderId: "1000938340000",
        appId: "1:1000938340000:web:bd00e04ff5e74b1d3e93c5"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.firestore();
    const auth = firebase.auth();

    // ============================================================= 
    // 2. SABİTLER
    // ============================================================= 
    const CONTAINER_ID = 'attendance-tracker-container'; 
    const ATTENDANCE_DATA_KEY = 'ituUltimateAttendance'; 

    // ============================================================= 
    // 3. CORE FONKSİYONLAR
    // ============================================================= 
    
    // Yoklama Tiklerini (Local) Getir
    const getAttendanceData = () => {
        const data = localStorage.getItem(ATTENDANCE_DATA_KEY);
        return data ? JSON.parse(data) : {};
    };

    // Yoklama Tiklerini Kaydet
    const saveAttendanceData = (data) => {
        localStorage.setItem(ATTENDANCE_DATA_KEY, JSON.stringify(data));
    };

    // Dersleri Çiz
    const renderAttendanceTrackers = (courses) => {
        console.log("🎨 Dersler çiziliyor...", courses.length, "adet ders var.");
        const container = document.getElementById(CONTAINER_ID);
        if (!container) {
            console.error("❌ HATA: Container bulunamadı! Sayfa YTS değil mi?");
            return;
        }

        container.innerHTML = ''; // Temizle

        if (courses.length === 0) {
            container.innerHTML = `<p class="no-courses-message">Kayıtlı ders yok. Programlayıcı'dan ekle!</p>`;
            return;
        }

        // Gruplama
        const coursesByCrn = courses.reduce((acc, c) => {
            if (!acc[c.crn]) acc[c.crn] = [];
            acc[c.crn].push(c);
            return acc;
        }, {});

        // HTML Oluşturma
        Object.entries(coursesByCrn).forEach(([crn, parts]) => {
            const firstPart = parts[0];
            const attendanceData = getAttendanceData();
            const statusArray = attendanceData[crn] || Array(14).fill(null);

            // İstatistikler
            const totalHeld = statusArray.filter(s => s === 'P' || s === 'A').length;
            const totalPresent = statusArray.filter(s => s === 'P').length;
            const percentage = totalHeld > 0 ? Math.round((totalPresent / totalHeld) * 100) : 0;
            const isHigh = percentage >= 70;

            const card = document.createElement('div');
            card.className = `attendance-card ${isHigh ? 'high-attendance' : ''}`;
            
            // Tablo HTML'i
            let tableHtml = `<table class="attendance-grid"><thead><tr><th>Hafta</th>`;
            for(let i=1; i<=14; i++) tableHtml += `<th>${i}</th>`;
            tableHtml += `</tr></thead><tbody><tr><td>Durum</td>`;
            
            statusArray.forEach((status, i) => {
                const className = status === 'P' ? 'present' : (status === 'A' ? 'absent' : '');
                tableHtml += `<td class="attendance-cell ${className}" data-crn="${crn}" data-week="${i}">${status || ''}</td>`;
            });
            tableHtml += `</tr></tbody></table>`;

            card.innerHTML = `
                <div class="attendance-card-header">
                    <div class="attendance-card-title">${firstPart.code}</div>
                    <div class="attendance-card-subtitle">${firstPart.crn}</div>
                </div>
                <div class="attendance-card-body">
                    ${tableHtml}
                    <div class="attendance-summary">
                         <div>Toplam: ${totalHeld}</div>
                         <div>Katılım: ${totalPresent}</div>
                         <div>%: ${percentage}</div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    };

    // ============================================================= 
    // 4. VERİ ÇEKME (KRİTİK KISIM)
    // ============================================================= 
    const fetchCourses = async (user) => {
        console.log("📡 Veritabanına bağlanılıyor...", user.uid);
        const container = document.getElementById(CONTAINER_ID);
        if(container) container.innerHTML = "<p>Yükleniyor...</p>";

        try {
            const doc = await db.collection('users').doc(user.uid).get();
            
            if (doc.exists) {
                console.log("✅ Kullanıcı dokümanı bulundu.");
                const data = doc.data();
                if (data.schedule && data.schedule.length > 0) {
                    console.log("📚 Ders listesi bulundu:", data.schedule);
                    renderAttendanceTrackers(data.schedule);
                } else {
                    console.warn("⚠️ Doküman var ama 'schedule' boş!");
                    if(container) container.innerHTML = "<p>Listen boş. Programlayıcıdan ders ekle.</p>";
                }
            } else {
                console.warn("⚠️ Kullanıcı dokümanı HİÇ YOK (Programlayıcıda hiç kaydet tuşuna basılmamış).");
                if(container) container.innerHTML = "<p>Veri bulunamadı. Programlayıcı sayfasına gidip bir ders ekleyip çıkararak kaydı tetikle.</p>";
            }
        } catch (error) {
            console.error("🔥 Veri çekme hatası:", error);
            if(container) container.innerHTML = `<p style="color:red">Hata: ${error.message}</p>`;
        }
    };

    // ============================================================= 
    // 5. EVENT LISTENER & AUTH
    // ============================================================= 
    
    // Tıklama Olayı
    const container = document.getElementById(CONTAINER_ID);
    if (container) {
        container.addEventListener('click', (e) => {
            if (e.target.classList.contains('attendance-cell')) {
                const crn = e.target.dataset.crn;
                const week = e.target.dataset.week;
                
                let data = getAttendanceData();
                if(!data[crn]) data[crn] = Array(14).fill(null);
                
                const current = data[crn][week];
                data[crn][week] = current === 'P' ? 'A' : (current === 'A' ? null : 'P');
                
                saveAttendanceData(data);
                
                // Basit UI Güncellemesi (Tekrar fetch yapmadan)
                e.target.className = `attendance-cell ${data[crn][week] === 'P' ? 'present' : (data[crn][week] === 'A' ? 'absent' : '')}`;
                e.target.innerText = data[crn][week] || '';
            }
        });
    }

    // Auth Dinleyicisi
    auth.onAuthStateChanged((user) => {
        if (!document.getElementById(CONTAINER_ID)) return; // YTS sayfası değilse çık

        if (user) {
            console.log("👤 Giriş yapıldı:", user.email);
            fetchCourses(user);
        } else {
            console.log("👤 Çıkış yapıldı / Misafir");
            if(container) container.innerHTML = "<p>Lütfen giriş yapın.</p>";
        }
    });

    // Hamburger Menü (Varsa)
    const hamburger = document.querySelector(".hamburger");
    const navMenu = document.querySelector(".nav-menu");
    if(hamburger && navMenu) {
        hamburger.addEventListener("click", () => {
            hamburger.classList.toggle("active");
            navMenu.classList.toggle("active");
        });
    }
});
