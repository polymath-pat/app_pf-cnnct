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

    try:
        # 2. Patch for macOS ARM64 / Linux Driver path issue
        driver_path = ChromeDriverManager().install()
        if "THIRD_PARTY_NOTICES" in driver_path:
            driver_path = os.path.join(os.path.dirname(driver_path), "chromedriver")
        
        # Ensure the binary is executable (Crucial for macOS and CI)
        st = os.stat(driver_path)
        os.chmod(driver_path, st.st_mode | stat.S_IEXEC)
        print(f"✅ Driver ready: {driver_path}")
        
        service = ChromeService(executable_path=driver_path)
        driver = webdriver.Chrome(service=service, options=chrome_options)

        # 3. Load App - Using port 8081 for rootless Podman compatibility
        wait = WebDriverWait(driver, 20) # Increased timeout for CI stability
        target_url = "http://localhost:8081"
        print(f"🚀 Loading app at {target_url}...")
        driver.get(target_url)

        # 4. Verify UI Identity (Modern Glassmorphic Header)
        logo = wait.until(EC.presence_of_element_located((By.TAG_NAME, "h1")))
        if "CNNCT" not in logo.text:
            print(f"❌ UI Mismatch: Found '{logo.text}' but expected 'CNNCT'.")
            sys.exit(1)

        # 5. Perform Interaction
        target_input = wait.until(EC.presence_of_element_located((By.ID, "target-input")))
        print("⌨️  Submitting probe for doompatrol.io...")
        target_input.send_keys("doompatrol.io")
        target_input.send_keys(Keys.ENTER)

        # 6. Verify Results Rendered (Looking for the 'Service Port' label in JS output)
        print("⏳ Waiting for API response results...")
        wait.until(EC.text_to_be_present_in_element((By.ID, "results-area"), "Service Port"))
        
        results = driver.find_element(By.ID, "results-area").text
        if any(status in results for status in ["ONLINE", "OFFLINE"]):
            print("✨ E2E SUCCESS: Results are visible in the modern UI.")
        else:
            print("❌ Results area found but status text is missing.")
            sys.exit(1)

    except Exception as e:
        print(f"🔥 Test Error: {str(e)}")
        if driver:
            driver.save_screenshot("e2e_error.png")
            print("📸 Error screenshot saved to e2e_error.png")
        sys.exit(1)
        
    finally:
        if driver:
            print("🛑 Closing browser.")
            driver.quit()

if __name__ == "__main__":
    run_e2e_test()
