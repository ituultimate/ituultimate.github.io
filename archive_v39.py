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

# --- v35 PARSER MANTIĞI ---
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
    """Sınıfları ayırır"""
    if not classroom_str: return []
    matches = re.findall(r'([A-Za-z0-9]+(?:-[A-Za-z0-9]+)?)', classroom_str)
    if not matches and len(classroom_str) > 2:
        return [c.strip() for c in classroom_str.replace('/', ',').split(',') if c.strip()]
    return matches if matches else [classroom_str]

def parse_multiple_times(time_str, day_count):
    """Saatleri ayırır ve formatlar"""
    if not time_str: return []
    time_objects = []
    patterns = [r'(\d{2}:\d{2})[-/](\d{2}:\d{2})', r'(\d{2}:\d{2})\s+(\d{2}:\d{2})']
    for pattern in patterns:
        matches = list(re.finditer(pattern, time_str))
        if matches:
            for match in matches:
                time_objects.append({"start": match.group(1), "end": adjust_time(match.group(2))})
            break
    
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
    options.add_argument('--window-size=1920,1080') # Ekran boyutu eklendi
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
            ders_dropdown = Select(driver.find_element(By.ID, "dersBransKoduId"))
            ders_dropdown.select_by_visible_text(department_name)
            
            driver.execute_script("document.getElementById('dersProgramContainer').innerHTML = '';")
            goster_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Göster')]")
            driver.execute_script("arguments[0].click();", goster_btn)
            
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
                    
                    raw_building = clean_building(get_text(5))
                    raw_day = get_text(6)
                    raw_time = get_text(7)
                    raw_classroom = get_text(8)

                    days = parse_multiple_days(raw_day)
                    classrooms = parse_multiple_classrooms(raw_classroom)
                    times = parse_multiple_times(raw_time, len(days))

                    for i, day in enumerate(days):
                        classroom = classrooms[i] if i < len(classrooms) else (classrooms[-1] if classrooms else "")
                        time_obj = times[i] if i < len(times) else (times[0] if times else {"start": "", "end": ""})
                        
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
            
            print(f"✓ {department_name}: {len(local_courses)} ders kaydı.")
            return local_courses

        except Exception as e:
            if attempt < max_retries:
                time.sleep(1)
                driver.refresh()
                try: 
                    # Refresh sonrası tekrar seçim denemesi
                    s = Select(driver.find_element(By.ID, "programSeviyeTipiId"))
                    try: s.select_by_visible_text("Lisans")
                    except: s.select_by_index(0)
                except: pass
            else:
                return []

def worker_process(departments_subset):
    driver = get_driver()
    results = []
    try:
        driver.get("https://obs.itu.edu.tr/public/DersProgram")
        
        # --- DÜZELTİLMİŞ KISIM (Worker) ---
        dropdown_element = WebDriverWait(driver, 20).until(EC.visibility_of_element_located((By.ID, "programSeviyeTipiId")))
        time.sleep(2)
        
        select = Select(dropdown_element)
        try:
            select.select_by_visible_text("Lisans")
        except:
            try:
                select.select_by_visible_text("Undergraduate")
            except:
                select.select_by_index(0)
        
        time.sleep(1)
        # ----------------------------------
        
        for dept in departments_subset:
            results.extend(scrape_single_department(driver, dept))
    except Exception as e:
        print(f"Worker Hatası: {e}")
    finally:
        driver.quit()
    return results

# --- FIREBASE SENKRONİZASYONU ---
def sync_to_firebase(all_courses):
    if not initialize_firebase
