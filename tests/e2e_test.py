import sys
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
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

    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=chrome_options
    )

    try:
        # 2. Load the app
        target_url = "http://localhost:80"
        print(f"🚀 Loading app at {target_url}...")
        driver.get(target_url)

        # 3. Wait for the UI to be ready
        wait = WebDriverWait(driver, 15)
        
        # Verify we are on the NEW interface (Checking for the italic CNNCT logo)
        logo = wait.until(EC.presence_of_element_located((By.TAG_NAME, "h1")))
        if "CNNCT" not in logo.text:
            print("❌ STALE UI DETECTED: The page does not look like the modern version.")
            sys.exit(1)

        # 4. Find the input field and submit target
        target_input = wait.until(EC.presence_of_element_located((By.ID, "target-input")))
        test_target = "8.8.8.8"
        print(f"⌨️  Testing target: {test_target} via Enter key...")
        
        target_input.send_keys(test_target)
        target_input.send_keys(Keys.ENTER)

        # 5. Wait for the results-area to render the Modern Status Rows
        # We look for "Service Port" which is part of the new renderModernResults() output
        print("⏳ Waiting for backend probe results...")
        wait.until(EC.text_to_be_present_in_element((By.ID, "results-area"), "Service Port"))

        # 6. Final Validation
        results_text = driver.find_element(By.ID, "results-area").text
        print(f"📋 Captured Results:\n{results_text}")

        if "ONLINE" in results_text or "OFFLINE" in results_text:
            print("✨ E2E SUCCESS: Modern UI responded correctly.")
        else:
            print("❌ E2E FAILURE: Results container found but status text missing.")
            sys.exit(1)

    except Exception as e:
        print(f"🔥 Test Error: {str(e)}")
        # Save a screenshot so you can see what the browser saw
        driver.save_screenshot("e2e_error.png")
        print("📸 Screenshot saved as e2e_error.png")
        sys.exit(1)
        
    finally:
        # 7. Always shut down the browser
        print("🛑 Closing browser.")
        driver.quit()

if __name__ == "__main__":
    run_e2e_test()