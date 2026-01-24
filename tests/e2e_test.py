import os
import sys
import stat
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

def run_e2e_test():
    # 1. Setup Headless Chrome
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1920,1080")

    driver = None
    current_step = "Initializing Driver"

    try:
        # 2. Patch for macOS ARM64 / Linux Driver path issue
        driver_path = ChromeDriverManager().install()
        if "THIRD_PARTY_NOTICES" in driver_path:
            driver_path = os.path.join(os.path.dirname(driver_path), "chromedriver")
        
        # Ensure the binary is executable
        st = os.stat(driver_path)
        os.chmod(driver_path, st.st_mode | stat.S_IEXEC)
        print(f"✅ Driver ready: {driver_path}")
        
        service = ChromeService(executable_path=driver_path)
        driver = webdriver.Chrome(service=service, options=chrome_options)

        # 3. Load App
        current_step = "Loading Application URL"
        wait = WebDriverWait(driver, 20) 
        target_url = "http://localhost:8081"
        print(f"🚀 [STEP: {current_step}] Loading app at {target_url}...")
        driver.get(target_url)

        # 4. Verify UI Identity
        current_step = "Verifying Branding (H1)"
        logo = wait.until(EC.presence_of_element_located((By.TAG_NAME, "h1")))
        if "CNNCT" not in logo.text:
            print(f"❌ [FAILED: {current_step}] Found '{logo.text}' but expected 'CNNCT'.")
            sys.exit(1)
        print(f"✅ [PASSED: {current_step}]")

        # 5. Perform Interaction
        current_step = "Submitting Target Input"
        target_input = wait.until(EC.presence_of_element_located((By.ID, "target-input")))
        
        test_target = "doompatrol.io"
        print(f"⌨️  [STEP: {current_step}] Submitting probe for {test_target}...")
        target_input.send_keys(test_target)
        target_input.send_keys(Keys.ENTER)

        # 6. Verify Results Rendered
        current_step = "Waiting for Backend Results"
        print(f"⏳ [STEP: {current_step}] Waiting for API response...")
        
        # We wait for the "TCP Port" label to appear
        wait.until(EC.text_to_be_present_in_element((By.ID, "results-area"), "TCP Port"))
        
        results_element = driver.find_element(By.ID, "results-area")
        results_text = results_element.text
        
        current_step = "Validating Result Content"
        # Convert to upper to handle Case Sensitivity ("OPEN" vs "Open")
        normalized_results = results_text.upper()
        
        # Check for icons and text regardless of casing
        if any(status in normalized_results for status in ["✅ OPEN", "❌ CLOSED"]):
            print(f"✅ [PASSED: {current_step}] Results are visible and valid.")
            print(f"✨ E2E SUCCESS")
        else:
            print(f"❌ [FAILED: {current_step}] Status indicators not found.")
            print(f"Captured text was: \n---\n{results_text}\n---")
            sys.exit(1)

    except Exception as e:
        print(f"\n🔥 [CRITICAL FAILURE during: {current_step}]")
        print(f"Error Message: {str(e)}")
        if driver:
            driver.save_screenshot("e2e_error.png")
            print(f"📸 Screenshot saved to e2e_error.png")
        sys.exit(1)
        
    finally:
        if driver:
            print("🛑 Closing browser.")
            driver.quit()

if __name__ == "__main__":
    run_e2e_test()