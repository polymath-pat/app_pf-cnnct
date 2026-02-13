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
        print(f"Failed to initialize Chrome: {e}")
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
        print("E2E Test Passed: Frontend loaded successfully.")

    except Exception as e:
        # Take a screenshot on failure (mapped back to your local dir in CI)
        screenshot_path = "tests/error-screenshot.png"
        driver.save_screenshot(screenshot_path)
        print(f"E2E Failure: {e}")
        print(f"Screenshot saved to {screenshot_path}")
        raise
    finally:
        driver.quit()

def test_status_bar():
    driver = setup_driver()
    try:
        url = "http://localhost:3000"
        print(f">>> Navigating to {url}")
        driver.get(url)
        time.sleep(3)

        # The status bar should be visible at the top
        status_bar = driver.find_element("id", "status-bar")
        assert status_bar.is_displayed(), "Status bar should be visible"

        # Status bar should contain CNNCT brand
        bar_text = status_bar.text
        print(f">>> Status bar text: {bar_text}")
        assert "CNNCT" in bar_text, "Status bar should contain CNNCT brand"

        # Status card should also be present
        status_card = driver.find_element("id", "status-card-body")
        assert status_card.is_displayed(), "Status card should be visible"
        print("E2E Test Passed: Status bar and card loaded and visible.")

    except Exception as e:
        screenshot_path = "tests/error-screenshot-status.png"
        driver.save_screenshot(screenshot_path)
        print(f"E2E Failure: {e}")
        print(f"Screenshot saved to {screenshot_path}")
        raise
    finally:
        driver.quit()

def test_webhook_feed():
    driver = setup_driver()
    try:
        url = "http://localhost:3000"
        print(f">>> Navigating to {url}")
        driver.get(url)
        time.sleep(3)

        # The webhook results area should be visible
        webhook_area = driver.find_element("id", "webhook-results-area")
        assert webhook_area.is_displayed(), "Webhook results area should be visible"

        # The webhook feed should contain empty state or results
        webhook_text = webhook_area.text
        print(f">>> Webhook results: {webhook_text}")
        assert "No webhook events" in webhook_text or "Recent Sessions" in webhook_text, "Webhook feed should show empty state or sessions"
        print("E2E Test Passed: Webhook feed loaded and rendered results.")

    except Exception as e:
        screenshot_path = "tests/error-screenshot-webhook.png"
        driver.save_screenshot(screenshot_path)
        print(f"E2E Failure: {e}")
        print(f"Screenshot saved to {screenshot_path}")
        raise
    finally:
        driver.quit()


if __name__ == "__main__":
    test_frontend_loads()
    test_status_bar()
    test_webhook_feed()
