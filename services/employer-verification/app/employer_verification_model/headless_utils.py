from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time

def get_website_text_headless(url, wait_time=5):
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--disable-gpu')
    options.add_argument('--no-sandbox')
    options.add_argument('--window-size=1920,1080')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--lang=en-US')
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    try:
        driver.get(url)
        time.sleep(wait_time)  # Wait for JS to render
        body = driver.find_element(By.TAG_NAME, 'body')
        text = body.text
        return text.lower()
    except Exception as e:
        print(f"[ERROR] Headless browser fetch failed: {e}")
        return ""
    finally:
        driver.quit()
