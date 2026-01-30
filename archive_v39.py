import os
import json
import time
import hashlib
import re
import concurrent.futures
import firebase_admin
from firebase_admin import credentials, firestore
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.common.exceptions import TimeoutException
from bs4 import BeautifulSoup

# --- AYARLAR ---
MAX_WORKERS = 4       # Hız için aynı anda çalışan tarayıcı sayısı
HEADLESS_MODE = True  # Arka planda çalışması için True
LOAD_TIMEOUT = 10     # Ders yüklenmesi için beklenecek maks süre

# --- v35 PARSER MANTIĞI (İstediğin Format İçin Kritik) ---
def adjust_time(time_str):
    """Bitiş saatine 1 dakika ekler (v35 mantığı)"""
    if not time_str: return time_str
    try:
        hours, minutes = map(int, time_str.split(':'))
        minutes += 1
        if minutes >= 60:
            minutes = 0
            hours += 1
            if hours >= 24: hours = 0
        return f"{hours:02d}:{minutes:02d}"
    except:
        return time_str

def parse_multiple_days(day_str):
    """Günleri ayırır"""
    if not day_str: return []
    days = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"]
    return [d for d in days if d in day_str]

def parse_multiple_classrooms(classroom_str):
    """Sınıfları ayırır (v35 regex mantığı)"""
    if not classroom_str: return []
    matches = re.findall(r'([A-Za-z0-9]+(?:-[A-Za-z0-9]+)?)', classroom_str)
    if not matches and len(classroom_str) > 2:
        return [c.strip() for c in classroom_str.replace('/', ',').split(',') if c.strip()]
    return matches if matches else [classroom_str]

def parse_multiple_times(time_str, day_count):
    """Saatleri ayırır ve formatlar"""
    if not time_str: return []
    time_objects = []
    # v35'teki regex desenleri
    patterns = [r'(\d{2}:\d{2})[-/](\d{2}:\d{2})', r'(\d{2}:\d{2})\s+(\d{2}:\d{2})']
    for pattern in patterns:
        matches = list(re.finditer(pattern, time_str))
        if matches:
            for match in matches:
                time_objects.append({"start": match.group(1), "end": adjust_time(match.group(2))})
            break
    
    # Eğer yukarıdakiler bulamazsa ve tire varsa (yedek)
    if not time_objects and '-' in time_str:
        parts = time_str.split('-')
        if len(parts) == 2:
            time_objects.append({"start": parts[0], "end": adjust_time(parts[1])})
            
    return time_objects

def clean_building(building_str):
    """Bina ismindeki tekrarları temizler"""
    if not building_str: return building_str
    if len(building_str) > 0 and len(building_str) % len(set(building_str)) == 0:
        half = len(building_str)//2
        if building_str[:half] == building_str[half:]:
            return building_str[:half]
    return building_str

def course_hash(course):
    """Değişiklik kontrolü için unique imza"""
    data = f"{course['crn']}{course['code']}{course['day']}{course['time']['start']}"
    return hashlib.md5(data.encode()).hexdigest()

# --- SİSTEM AYARLARI ---
def get_driver():
    options = webdriver.ChromeOptions()
    if HEADLESS_MODE: options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--blink-settings=imagesEnabled=false')
    return webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

def initialize_firebase():
    try:
        if not firebase_admin._apps:
            if os.path.exists('serviceAccountKey.json'):
                cred = credentials.Certificate('serviceAccountKey.json')
                firebase_admin.initialize_app(cred)
                return True
            else:
                print("⚠ serviceAccountKey.json bulunamadı! Firebase atlanıyor.")
                return False
        return True
    except Exception as e:
        print(f"Firebase Init Hatası: {e}")
        return False

# --- SCRAPING (VERİ ÇEKME) ---
def scrape_single_department(driver, department_name, max_retries=1):
    for attempt in range(max_retries + 1):
        try:
            # Dropdown seç
            ders_dropdown = Select(driver.find_element(By.ID, "dersBransKoduId"))
            ders_dropdown.select_by_visible_text(department_name)
            
            # Tabloyu temizle ve Göster'e bas
            driver.execute_script("document.getElementById('dersProgramContainer').innerHTML = '';")
            goster_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Göster')]")
            driver.execute_script("arguments[0].click();", goster_btn)
            
            # Bekle (Akıllı Timeout)
            try:
                WebDriverWait(driver, LOAD_TIMEOUT).until(
                    lambda d: len(d.find_elements(By.CSS_SELECTOR, "#dersProgramContainer tbody tr")) > 0
                )
            except TimeoutException:
                print(f"⚠ {department_name}: Ders yok (Hızlı geçiliyor).")
                return []

            soup = BeautifulSoup(driver.page_source, 'html.parser')
            table = soup.find('table', {'id': 'dersProgramContainer'})
            
            local_courses = []
            if table and table.tbody:
                rows = table.tbody.find_all('tr')
                for row in rows:
                    cells = row.find_all('td')
                    if len(cells) < 10: continue
                    
                    def get_text(idx): return cells[idx].text.strip().replace('\n', ' ') if len(cells) > idx else ""
                    
                    # Ham verileri al
                    raw_building = clean_building(get_text(5))
                    raw_day = get_text(6)
                    raw_time = get_text(7)
                    raw_classroom = get_text(8)

                    # v35 Parserlarını Kullan
                    days = parse_multiple_days(raw_day)
                    classrooms = parse_multiple_classrooms(raw_classroom)
                    times = parse_multiple_times(raw_time, len(days))

                    # v35 MANTIĞI: Her gün için ayrı satır oluştur
                    for i, day in enumerate(days):
                        classroom = classrooms[i] if i < len(classrooms) else (classrooms[-1] if classrooms else "")
                        time_obj = times[i] if i < len(times) else (times[0] if times else {"start": "", "end": ""})
                        
                        # İSTEDİĞİN FORMAT BU:
                        course_data = {
                            "crn": get_text(0),
                            "code": get_text(1),
                            "name": get_text(2),
                            "teachingMethod": get_text(3),
                            "instructor": get_text(4),
                            "building": raw_building,
                            "day": day,
                            "time": time_obj,
                            "classroom": classroom,
                            "capacity": int(get_text(9)) if get_text(9).isdigit() else 0,
                            "enrolled": int(get_text(10)) if get_text(10).isdigit() else 0
                        }
                        local_courses.append(course_data)
            
            print(f"✓ {department_name}: {len(local_courses)} ders kaydı (v35 formatında).")
            return local_courses

        except Exception as e:
            if attempt < max_retries:
                time.sleep(1)
                driver.refresh()
                try: Select(driver.find_element(By.ID, "programSeviyeTipiId")).select_by_visible_text("Lisans")
                except: pass
            else:
                return []

def worker_process(departments_subset):
    """Worker fonksiyonu: Bir tarayıcı açar, listedeki departmanları gezer"""
    driver = get_driver()
    results = []
    try:
        driver.get("https://obs.itu.edu.tr/public/DersProgram")
        WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.ID, "programSeviyeTipiId")))
        Select(driver.find_element(By.ID, "programSeviyeTipiId")).select_by_visible_text("Lisans")
        time.sleep(1)
        
        for dept in departments_subset:
            results.extend(scrape_single_department(driver, dept))
    except Exception as e:
        print(f"Worker Hatası: {e}")
    finally:
        driver.quit()
    return results

# --- FIREBASE SENKRONİZASYONU ---
def sync_to_firebase(all_courses):
    """v35 formatındaki veriyi Firebase'e basar"""
    if not initialize_firebase(): return

    print("\n🔥 Firebase Senkronizasyonu Başlıyor...")
    db = firestore.client()
    collection = db.collection('2025-2026-bahar')
    
    # Mevcut verileri indir (Snapshot)
    existing_docs = {d.id: course_hash(d.to_dict()) for d in collection.stream()}
    
    batch = db.batch()
    batch_count = 0
    stats = {'new': 0, 'updated': 0, 'unchanged': 0}
    
    for course in all_courses:
        # Doküman ID'si (Türkçe karakterleri güvenli hale getir)
        safe_day = course['day'].replace('İ', 'I').replace('ç', 'c').replace('ş', 's').replace('ı', 'i').replace('ğ', 'g').replace('ü', 'u').replace('ö', 'o')
        doc_id = f"{course['crn']}_{course['code']}_{safe_day}"
        new_h = course_hash(course)
        
        doc_ref = collection.document(doc_id)
        
        # Sadece değişiklik varsa yaz (Maliyet/Hız optimizasyonu)
        if doc_id not in existing_docs:
            batch.set(doc_ref, course)
            stats['new'] += 1
            batch_count += 1
        elif existing_docs[doc_id] != new_h:
            batch.set(doc_ref, course)
            stats['updated'] += 1
            batch_count += 1
        else:
            stats['unchanged'] += 1
            
        if batch_count >= 400:
            batch.commit()
            print(f"  -> 400 ders işlendi...")
            batch = db.batch()
            batch_count = 0
            
    if batch_count > 0: batch.commit()
    print(f"✅ Firebase Bitti: +{stats['new']} Yeni, ~{stats['updated']} Güncel, ={stats['unchanged']} Değişmeyen.")

# --- ANA PROGRAM ---
def main():
    start_time = time.time()
    
    # 1. Departman Listesini Al
    print("🚀 İTÜ OBS Bot Başlatılıyor (Hızlı + v35 Formatı + Firebase)...")
    driver = get_driver()
    try:
        driver.get("https://obs.itu.edu.tr/public/DersProgram")
        WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.ID, "programSeviyeTipiId")))
        Select(driver.find_element(By.ID, "programSeviyeTipiId")).select_by_visible_text("Lisans")
        time.sleep(2)
        opts = Select(driver.find_element(By.ID, "dersBransKoduId")).options
        departments = [o.text for o in opts if o.text != "Ders Kodu Seçiniz" and o.text.strip()]
    finally:
        driver.quit()

    # 2. İşleri Bölüştür (Chunking)
    chunk_size = (len(departments) // MAX_WORKERS) + 1
    chunks = [departments[i:i + chunk_size] for i in range(0, len(departments), chunk_size)]
    
    all_courses = []
    print(f"📡 {len(departments)} departman {MAX_WORKERS} tarayıcı ile taranıyor...")
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(worker_process, chunk) for chunk in chunks]
        for future in concurrent.futures.as_completed(futures):
            all_courses.extend(future.result())
    
    # 3. Sırala ve Raporla
    all_courses.sort(key=lambda x: (x['code'], x['crn']))
    print(f"\n🏁 TOPLAM: {len(all_courses)} ders çekildi. ({time.time()-start_time:.1f}sn)")
    
    # 4. Dosyaya Kaydet (Tam istediğin v35 JS formatı)
    try:
        js_content = f"const courseData = {json.dumps(all_courses, ensure_ascii=False, indent=2)};"
        with open('course_data.js', 'w', encoding='utf-8') as f:
            f.write(js_content)
        print("✓ 'course_data.js' dosyası (const courseData formatında) oluşturuldu.")
    except Exception as e:
        print(f"Dosya hatası: {e}")

    # 5. Firebase'e Yükle (Aynı format)
    sync_to_firebase(all_courses)

if __name__ == "__main__":
    main()
