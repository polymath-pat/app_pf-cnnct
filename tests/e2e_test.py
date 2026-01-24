import os
import sys
import stat
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

def run_e2e_test():
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")

    driver = None
    try:
        driver_path = ChromeDriverManager().install()
        # Patch for certain Linux/macOS environments
        if "THIRD_PARTY_NOTICES" in driver_path:
            driver_path = os.path.join(os.path.dirname(driver_path), "chromedriver")
        
        os.chmod(driver_path, os.stat(driver_path).st_mode | stat.S_IEXEC)
        service = ChromeService(executable_path=driver_path)
        driver = webdriver.Chrome(service=service, options=chrome_options)
        wait = WebDriverWait(driver, 15)

        # 1. Load UI
        driver.get("http://localhost:8081")

        # 2. Test Port Probe (Default)
        target_input = wait.until(EC.presence_of_element_located((By.ID, "target-input")))
        target_input.send_keys("google.com")
        driver.find_element(By.ID, "submit-btn").click()
        
        # Verify result contains "ms" (latency measurement)
        wait.until(EC.text_to_be_present_in_element((By.ID, "results-area"), "ms"))
        print("✅ Port Probe & Latency check passed.")

        # 3. Test DNS Tab Switch
        driver.find_element(By.ID, "nav-dns").click()
        if "DNS lookup" not in target_input.get_attribute("placeholder"):
            raise Exception("Tab switch failed: Placeholder did not update.")
        print("✅ DNS Tab switch passed.")

    except Exception as e:
        print(f"🔥 E2E Failure: {e}")
        if driver:
            driver.save_screenshot("e2e_error.png")
        sys.exit(1)
    finally:
        if driver:
            driver.quit()

if __name__ == "__main__":
    run_e2e_test()