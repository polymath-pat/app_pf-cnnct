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
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--remote-debugging-port=9222")

    driver = None
    try:
        driver_path = ChromeDriverManager().install()
        if "THIRD_PARTY_NOTICES" in driver_path:
            driver_path = os.path.join(os.path.dirname(driver_path), "chromedriver")
        
        os.chmod(driver_path, os.stat(driver_path).st_mode | stat.S_IEXEC)
        service = ChromeService(executable_path=driver_path)
        driver = webdriver.Chrome(service=service, options=chrome_options)
        wait = WebDriverWait(driver, 10) # Standard wait
        long_wait = WebDriverWait(driver, 30) # Wait for network-heavy HTTP Diag

        # 1. Load UI
        driver.get("http://localhost:3000")

        # 2. Test Port Probe
        target_input = wait.until(EC.presence_of_element_located((By.ID, "target-input")))
        target_input.send_keys("google.com")
        driver.find_element(By.ID, "submit-btn").click()
        wait.until(EC.text_to_be_present_in_element((By.ID, "results-area"), "ms"))
        print("✅ Port Probe passed.")

        # 3. Test DNS Tab
        driver.find_element(By.ID, "nav-dns").click()
        target_input.clear()
        target_input.send_keys("google.com")
        driver.find_element(By.ID, "submit-btn").click()
        wait.until(EC.text_to_be_present_in_element((By.ID, "results-area"), "A Records"))
        print("✅ DNS Tab passed.")

        # 4. Test HTTP Diag Tab
        driver.find_element(By.ID, "nav-diag").click()
        target_input.clear()
        target_input.send_keys("https://google.com")
        driver.find_element(By.ID, "submit-btn").click()
        
        # --- FIX: Wait for 'Probing...' to be replaced by actual data ---
        # We wait until 'Probing...' is NO LONGER in the text
        long_wait.until_not(EC.text_to_be_present_in_element((By.ID, "results-area"), "Probing..."))
        
        results_text = driver.find_element(By.ID, "results-area").text
        
        # Now we check for metrics
        if "200" in results_text or "HTTP" in results_text:
            print(f"✅ HTTP Diag passed. Result: {results_text.splitlines()[0]}")
        else:
            raise Exception(f"HTTP Diag metrics missing in output. Got: {results_text}")

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