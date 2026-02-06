import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

def setup_driver():
    # Fix 1: Ensure variable names match to avoid 'name not defined' error
    options = Options()
    
    # Essential flags for running Chrome inside a Docker container
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    
    # Fix 2: Ensure Chrome uses the host network 
    # (Since we run docker with --network host, localhost:3000 should be visible)
    try:
        driver = webdriver.Chrome(options=options)
        return driver
    except Exception as e:
        print(f"❌ Failed to initialize Chrome: {e}")
        raise

def test_frontend_loads():
    driver = setup_driver()
    try:
        # Fix 3: Standardize the target URL
        url = "http://localhost:3000"
        print(f">>> Navigating to {url}")
        driver.get(url)
        
        # Wait for page to load
        time.sleep(2)
        
        # Simple assertion to check title or content
        print(f">>> Page title is: {driver.title}")
        assert "Welcome" in driver.page_source or driver.title != ""
        print("✅ E2E Test Passed: Frontend loaded successfully.")
        
    except Exception as e:
        # Take a screenshot on failure (mapped back to your local dir in CI)
        screenshot_path = "tests/error-screenshot.png"
        driver.save_screenshot(screenshot_path)
        print(f"🔥 E2E Failure: {e}")
        print(f"📸 Screenshot saved to {screenshot_path}")
        raise
    finally:
        driver.quit()

def test_status_tab():
    driver = setup_driver()
    try:
        url = "http://localhost:3000"
        print(f">>> Navigating to {url}")
        driver.get(url)
        time.sleep(2)

        # Click the Status tab
        status_btn = driver.find_element("id", "nav-status")
        status_btn.click()
        print(">>> Clicked Status tab")

        # Wait for the status results to render
        time.sleep(3)

        # The probe form should be hidden
        probe_form = driver.find_element("id", "probe-form")
        assert "hidden" in probe_form.get_attribute("class"), "Probe form should be hidden on Status tab"

        # The results area should contain status output (backend type shown)
        results = driver.find_element("id", "results-area")
        results_text = results.text
        print(f">>> Status results: {results_text}")
        assert "Backend:" in results_text or "backend" in results_text.lower(), "Status results should show backend info"
        print("✅ E2E Test Passed: Status tab loaded and rendered results.")

    except Exception as e:
        screenshot_path = "tests/error-screenshot-status.png"
        driver.save_screenshot(screenshot_path)
        print(f"🔥 E2E Failure: {e}")
        print(f"📸 Screenshot saved to {screenshot_path}")
        raise
    finally:
        driver.quit()

def test_webhook_tab():
    driver = setup_driver()
    try:
        url = "http://localhost:3000"
        print(f">>> Navigating to {url}")
        driver.get(url)
        time.sleep(2)

        # Click the Webhook tab
        webhook_btn = driver.find_element("id", "nav-webhook")
        webhook_btn.click()
        print(">>> Clicked Webhook tab")

        # Wait for the webhook results to render
        time.sleep(3)

        # The probe form should be hidden
        probe_form = driver.find_element("id", "probe-form")
        assert "hidden" in probe_form.get_attribute("class"), "Probe form should be hidden on Webhook tab"

        # The results area should contain webhook output (empty state or results)
        results = driver.find_element("id", "results-area")
        results_text = results.text
        print(f">>> Webhook results: {results_text}")
        assert "No webhook events" in results_text or "Recent Sessions" in results_text, "Webhook results should show empty state or sessions"
        print("✅ E2E Test Passed: Webhook tab loaded and rendered results.")

    except Exception as e:
        screenshot_path = "tests/error-screenshot-webhook.png"
        driver.save_screenshot(screenshot_path)
        print(f"🔥 E2E Failure: {e}")
        print(f"📸 Screenshot saved to {screenshot_path}")
        raise
    finally:
        driver.quit()


if __name__ == "__main__":
    test_frontend_loads()
    test_status_tab()
    test_webhook_tab()