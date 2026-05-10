#!/usr/bin/env python
import os
import sys

# Load .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Check if Selenium mode is enabled
eroc_selenium = os.getenv("EROC_USE_SELENIUM")
print(f"EROC_USE_SELENIUM environment variable: {eroc_selenium}")

# Import and check the module
try:
    from app.employer_verification_model.registration_utils import USE_EROC_SELENIUM
    print(f"USE_EROC_SELENIUM in registration_utils: {USE_EROC_SELENIUM}")
    print("\n✓ Setup successful! Selenium mode is ENABLED." if USE_EROC_SELENIUM else "\n✗ Selenium mode is DISABLED.")
except Exception as e:
    print(f"Error importing registration_utils: {e}")
    sys.exit(1)

# Verify Selenium and ChromeDriver are available
print("\nChecking dependencies...")
try:
    import selenium
    print(f"✓ Selenium {selenium.__version__} is installed")
except ImportError:
    print("✗ Selenium is not installed")

try:
    import webdriver_manager
    print(f"✓ webdriver-manager is installed")
except ImportError:
    print("✗ webdriver-manager is not installed")

print("\nSetup verification complete!")
