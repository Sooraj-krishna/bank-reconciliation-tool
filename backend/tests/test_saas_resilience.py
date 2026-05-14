import unittest
import requests
from unittest.mock import patch, MagicMock
from app.services.xero_service import get_valid_tokens, fetch_invoices

class TestSaaSResilience(unittest.TestCase):
    """
    Test suite to verify that our SaaS hardening works correctly.
    """

    @patch("app.services.xero_service.get_valid_tokens")
    @patch("requests.Session.get")
    def test_xero_retry_logic(self, mock_get, mock_get_tokens):
        """
        Verify that fetch_invoices retries when it hits a 429 Rate Limit.
        """
        # 1. Setup Mock: First call returns 429, second call returns 200
        mock_get_tokens.return_value = {"access_token": "fake_token", "tenant_id": "fake_tenant"}
        
        # Mocking the two calls (Tenants and Invoices)
        # We'll make the first attempt at Tenants return 429
        mock_resp_429 = MagicMock()
        mock_resp_429.status_code = 429
        
        mock_resp_200 = MagicMock()
        mock_resp_200.status_code = 200
        mock_resp_200.json.return_value = [{"tenantId": "123"}] # For tenants
        
        mock_inv_200 = MagicMock()
        mock_inv_200.status_code = 200
        mock_inv_200.json.return_value = {"Invoices": []} # For invoices
        
        # Define side effects for the GET calls
        # 1. Tenants (429) -> 2. Tenants (200) -> 3. Invoices (200)
        mock_get.side_effect = [mock_resp_429, mock_resp_200, mock_inv_200]

        print("\n[TEST] Simulating Xero 429 Rate Limit...")
        try:
            # This should NOT crash because our new resilient session handles the 429
            result = fetch_invoices("fake_session")
            print("[SUCCESS] App successfully waited and retried after 429!")
            self.assertEqual(result, [])
        except Exception as e:
            print(f"[FAILURE] App crashed instead of retrying: {str(e)}")
            self.fail("Resilience logic failed")

if __name__ == "__main__":
    unittest.main()
